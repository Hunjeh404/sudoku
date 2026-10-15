// npm run gen:portraits → supabase/migrations/0009_portrait_data.sql
// 초상화 목록(public/data/people.json의 분류로 티어), 칭호, 새 여정, 기존 사용자 옮기기
import { readFileSync, writeFileSync } from 'node:fs';
import { TIERS, tierOfCat, TITLES, JOURNEY } from '../src/data/catalog';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const people: { id: string; ko: string; cat: string }[] = JSON.parse(readFileSync('public/data/people.json', 'utf8'));
const rows = people.map((p) => ({ p, t: tierOfCat(p.cat) })).filter((x) => x.t !== null)
  .map(({ p, t }) => `(${q(p.id)},${t},${TIERS[t! - 1].price},${q(p.ko)})`);
const counts = TIERS.map((t) => people.filter((p) => tierOfCat(p.cat) === t.tier).length);

writeFileSync('supabase/migrations/0009_portrait_data.sql', `-- 자동 생성: npm run gen:portraits (src/data/catalog.ts, public/data/people.json이 원본)
-- 초상화 ${rows.length}장: 티어별 ${counts.join('/')}장
insert into public.portrait_catalog (id,tier,price,name_ko) values
${rows.join(',\n')}
on conflict (id) do update set tier=excluded.tier,price=excluded.price,name_ko=excluded.name_ko;

insert into public.title_catalog (id,name_ko) values
${TITLES.map((t) => `(${q(t.id)},${q(t.name)})`).join(',\n')}
on conflict (id) do update set name_ko=excluded.name_ko;

delete from public.journey_steps;
insert into public.journey_steps (step,need,title,reward) values
${JOURNEY.map((j) => `(${j.step},${j.need},${q(j.title)},${q(JSON.stringify(j.reward))}::jsonb)`).join(',\n')};
alter table public.journey_steps alter column need set not null;
create unique index if not exists journey_need on public.journey_steps (need);

-- ---------- 기존 사용자 옮기기 ----------
-- 지금 쓰는 얼굴 그림은 가진 초상화로 남긴다
insert into public.owned_portraits (profile_id, portrait_id, source)
select pr.id, pr.avatar_id, 'legacy' from public.profiles pr
where exists (select 1 from public.portrait_catalog c where c.id = pr.avatar_id)
on conflict do nothing;
update public.profiles set avatar_id = '' where avatar_id <> '' and not exists (select 1 from public.portrait_catalog c where c.id = avatar_id);
-- 지금까지 끝낸 판의 별빛을 점수로
insert into public.score_events (profile_id, attempt_id, size, difficulty, points, created_at)
select a.profile_id, a.id, c.size, c.difficulty, greatest(0, coalesce((a.result->>'reward')::int, 0)), coalesce(a.completed_at, a.updated_at)
from public.puzzle_attempts a join public.puzzle_catalog c on c.id = a.puzzle_id
where a.status = 'completed'
on conflict (attempt_id) do nothing;
-- 이미 지난 여정 칸의 티어·칭호(별빛·선물은 다시 주지 않는다)
insert into public.unlocks (profile_id, key)
select q.profile_id, 'tier:' || (j.reward->>'tier') from public.quest_progress q join public.journey_steps j on j.need <= q.completed_count
where j.reward ? 'tier' on conflict do nothing;
insert into public.unlocks (profile_id, key)
select q.profile_id, 'title:' || (j.reward->>'title') from public.quest_progress q join public.journey_steps j on j.need <= q.completed_count
where j.reward ? 'title' on conflict do nothing;
-- 한 판 이상 끝냈는데 초상화가 하나도 없으면 첫 선물 상자
do \$\$ begin
  perform private.make_gift(q.profile_id, 1) from public.quest_progress q
  where q.completed_count >= 1 and not exists (select 1 from public.owned_portraits o where o.profile_id = q.profile_id)
    and not exists (select 1 from public.portrait_gifts g where g.profile_id = q.profile_id);
end \$\$;
`);
console.log('portraits', rows.length, counts);
