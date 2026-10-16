-- 걸린 시간 = 서버의 시작 시각부터 끝낸 시각까지 전부
-- 화면을 내려놓은 시간, 나갔다가 다시 들어와 이어 푼 경우의 사이 시간도 모두 넣는다(0012의 '푼 구간만 합치기'를 바꿈).
-- 이미 끝난 판의 시간·자기 기록도 같은 기준으로 다시 계산한다(지우지 않음).

-- 화면의 시계도 같은 기준: open_attempt가 시작부터 지금까지를 돌려준다
create or replace function public.open_attempt(attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts;
begin
  select * into a from public.puzzle_attempts where id = attempt;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  return jsonb_build_object('played_sec', greatest(0, extract(epoch from coalesce(a.completed_at, now()) - a.started_at)::int));
end $$;

create or replace function public.complete_attempt(attempt uuid, board text, op_id uuid, elapsed_sec int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.puzzle_attempts; pz public.puzzle_catalog; sol text; amount int; q public.quest_progress;
  step public.journey_steps; res jsonb; jr jsonb := null; bal int; before_pts int; after_pts int; th int;
  secs int; prev int; rec jsonb := null; gift_id uuid := null; bonus int := 0;
  ttl text; paid_hints int; first_today boolean; skill int := 0; titles jsonb; ok boolean;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status = 'completed' then return a.result || jsonb_build_object('repeat', true); end if;
  if a.status <> 'active' then perform private.fail('not_active', '그만둔 퍼즐이에요.'); end if;
  select * into pz from public.puzzle_catalog where id = a.puzzle_id;
  perform private.check_board(board, pz.givens, pz.size);
  select solution into sol from private.puzzle_solutions where puzzle_id = a.puzzle_id;
  if board <> sol then perform private.fail('not_solved', '아직 맞지 않는 칸이 있어요.'); end if;
  ttl := private.title_of(a.profile_id);

  -- 시간: 서버에 남은 시작 시각부터 지금(서버 시각)까지 전부. 화면을 내리거나 나갔다 다시 들어온 시간도 포함
  secs := greatest(1, extract(epoch from now() - a.started_at)::int);
  ok := secs >= private.blanks(pz.givens);

  -- 보상: 힌트 한 번마다 10%씩 줄어듦. 올림포스의 현자·지혜의 눈은 첫 힌트가 깎이지 않음
  paid_hints := a.hints_used - case when ttl in ('sage', 'wise30') and a.hints_used > 0 then 1 else 0 end;
  select r.amount into amount from public.reward_rules r where r.size = pz.size and r.difficulty = pz.difficulty;
  amount := amount * (10 - least(paid_hints, 10)) / 10;
  insert into public.reward_ledger (profile_id, event_key, amount, reason) values (a.profile_id, 'complete:' || a.id, amount, 'puzzle:' || pz.id);
  update public.wallets set balance = balance + amount where profile_id = a.profile_id returning balance into bal;
  first_today := not exists (select 1 from public.puzzle_attempts where profile_id = a.profile_id and status = 'completed'
    and completed_at >= private.day_start());

  before_pts := private.points_of(a.profile_id);
  insert into public.score_events (profile_id, attempt_id, size, difficulty, points) values (a.profile_id, a.id, pz.size, pz.difficulty, amount);
  after_pts := before_pts + amount;
  foreach th in array array[100, 300, 500, 1000, 2000, 3000, 5000, 10000] loop
    if before_pts < th and after_pts >= th then perform private.add_activity(a.profile_id, 'points', jsonb_build_object('points', th)); end if;
  end loop;

  update public.quest_progress set completed_count = completed_count + 1,
    no_hint_count = no_hint_count + case when a.hints_used = 0 then 1 else 0 end
    where profile_id = a.profile_id returning * into q;
  if q.completed_count = any (array[10, 25, 50, 100, 150, 200, 300, 500, 1000]) then
    perform private.add_activity(a.profile_id, 'clears', jsonb_build_object('count', q.completed_count));
  end if;

  -- 자기 기록: 힌트 없이 끝낸 판, 시간을 제대로 잰 판만
  if a.hints_used = 0 and ok then
    select best_sec into prev from public.personal_records where profile_id = a.profile_id and size = pz.size and difficulty = pz.difficulty;
    if prev is null then
      insert into public.personal_records (profile_id, size, difficulty, best_sec, attempt_id) values (a.profile_id, pz.size, pz.difficulty, secs, a.id);
      rec := jsonb_build_object('sec', secs, 'prev', null, 'first', true);
    elsif secs < prev then
      update public.personal_records set best_sec = secs, attempt_id = a.id, set_at = now()
        where profile_id = a.profile_id and size = pz.size and difficulty = pz.difficulty;
      rec := jsonb_build_object('sec', secs, 'prev', prev, 'first', false);
      perform private.add_activity(a.profile_id, 'record', jsonb_build_object('size', pz.size, 'difficulty', pz.difficulty, 'sec', secs, 'prev', prev));
    end if;
  end if;

  -- 칭호 스킬 별빛(지갑에만, 점수에는 넣지 않음)
  if first_today then
    skill := skill + case ttl when 'apprentice' then 2 when 'play100' then 4 when 'play150' then 6 when 'play200' then 8
      when 'play300' then 10 when 'play500' then 12 when 'streak7' then 5 else 0 end;
  end if;
  skill := skill + case ttl when 'tr64' then 2 else 0 end;
  if rec is not null and not (rec->>'first')::boolean then
    skill := skill + case ttl when 'fast9e' then 5 when 'fast9m' then 8 when 'fast9h' then 12 else 0 end;
  end if;
  if skill > 0 then
    insert into public.reward_ledger (profile_id, event_key, amount, reason) values (a.profile_id, 'skill:' || a.id, skill, 'title:' || ttl);
    update public.wallets set balance = balance + skill where profile_id = a.profile_id returning balance into bal;
  end if;

  -- 여정
  select * into step from public.journey_steps where need = q.completed_count;
  if found then
    if step.reward ? 'bonus' then
      bonus := (step.reward->>'bonus')::int;
      insert into public.reward_ledger (profile_id, event_key, amount, reason) values (a.profile_id, 'journey:' || a.profile_id || ':' || step.step, bonus, 'journey');
      update public.wallets set balance = balance + bonus where profile_id = a.profile_id returning balance into bal;
    end if;
    if step.reward ? 'tier' then
      insert into public.unlocks (profile_id, key) values (a.profile_id, 'tier:' || (step.reward->>'tier')) on conflict do nothing;
      if found then perform private.add_activity(a.profile_id, 'tier', jsonb_build_object('tier', (step.reward->>'tier')::int)); end if;
    end if;
    if step.reward ? 'title' then perform private.grant_title(a.profile_id, step.reward->>'title'); end if;
    if step.reward ? 'gift' then gift_id := private.make_gift(a.profile_id, (step.reward->>'gift')::int); end if;
    jr := jsonb_build_object('step', step.step, 'title', step.title, 'reward', step.reward, 'gift_id', gift_id);
  end if;

  update public.puzzle_attempts set status = 'completed', board = complete_attempt.board, completed_at = now(),
    updated_at = now(), elapsed_sec = secs, played_sec = secs, active_since = null, time_ok = ok where id = attempt;
  titles := private.check_titles(a.profile_id);

  res := jsonb_build_object('reward', amount, 'balance', bal, 'completed_count', q.completed_count,
    'no_hint', a.hints_used = 0, 'hints_used', a.hints_used, 'paid_hints', least(paid_hints, 10), 'journey', jr, 'puzzle_id', pz.id,
    'size', pz.size, 'difficulty', pz.difficulty, 'elapsed', secs, 'record', rec, 'points', after_pts,
    'skill_bonus', skill, 'skill_title', case when skill > 0 then ttl end, 'titles', titles);
  update public.puzzle_attempts set result = res where id = attempt;
  return res;
end $$;

-- ---------- 이미 끝난 판 다시 계산 ----------
update public.puzzle_attempts at set
  elapsed_sec = greatest(1, extract(epoch from at.completed_at - at.started_at)::int),
  played_sec = greatest(1, extract(epoch from at.completed_at - at.started_at)::int),
  time_ok = extract(epoch from at.completed_at - at.started_at) >= private.blanks(c.givens),
  result = case when at.result is null then null
    else jsonb_set(at.result, '{elapsed}', to_jsonb(greatest(1, extract(epoch from at.completed_at - at.started_at)::int))) end
from public.puzzle_catalog c
where c.id = at.puzzle_id and at.status = 'completed' and at.completed_at is not null;

delete from public.personal_records;
insert into public.personal_records (profile_id, size, difficulty, best_sec, attempt_id, set_at)
select distinct on (at.profile_id, c.size, c.difficulty) at.profile_id, c.size, c.difficulty, at.elapsed_sec, at.id, at.completed_at
from public.puzzle_attempts at join public.puzzle_catalog c on c.id = at.puzzle_id
where at.status = 'completed' and at.hints_used = 0 and at.time_ok and at.elapsed_sec is not null
order by at.profile_id, c.size, c.difficulty, at.elapsed_sec, at.completed_at;

-- 빠르기 칭호: 새 기준으로 조건에 맞으면 주고(소식 없이), 맞지 않게 된 것은 거둔다
do $$
declare pid uuid;
begin
  for pid in select id from public.profiles loop perform private.check_titles(pid, true); end loop;
end $$;
with bad as (
  select u.profile_id, substr(u.key, 7) as tid from public.unlocks u
  join public.title_catalog t on t.id = substr(u.key, 7)
  where u.key like 'title:fast%' and coalesce((private.title_stats(u.profile_id)->>t.stat)::int, 999999) > t.need
), del as (
  delete from public.unlocks u using bad where u.profile_id = bad.profile_id and u.key = 'title:' || bad.tid returning bad.profile_id, bad.tid
), act as (
  delete from public.activities ac using del where ac.profile_id = del.profile_id and ac.kind = 'title' and ac.payload->>'title' = del.tid
)
update public.profiles pr set title = '' from del where pr.id = del.profile_id and pr.title = del.tid;

-- ---------- 실행 권한 ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.prokind = 'f' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.nspname = 'public' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
grant execute on function private.can_act(uuid) to authenticated;
