-- 집 꾸미기를 없애고, 초상화 수집·순위·친구 소식으로 바꾼다.
-- - 초상화: 4티어, 별빛으로 구입, 여정에서 티어 해금·무료 선물. 새 프로필은 초상화 없이(빈칸) 시작.
-- - 점수: 한 판 끝낼 때 받은 별빛(힌트로 깎인 뒤)을 난이도별로 쌓아 전체 순위(누적·이번 주)를 만든다.
-- - 친구: 상대 구글 이메일로 요청 → 상대가 수락하면 두 가족(계정)이 친구.
-- - 친구 소식: 판 수·누적 점수 구간, 자기 기록 경신, 칭호, 티어 해금. 친구는 소식마다 이모티콘 하나.
-- 데이터(초상화 목록·여정·칭호)는 0009_portrait_data.sql.

-- ===================== 표 =====================
create table if not exists public.portrait_catalog (
  id text primary key,
  tier int not null check (tier between 1 and 4),
  price int not null check (price > 0),
  name_ko text not null
);
create table if not exists public.title_catalog (
  id text primary key,
  name_ko text not null
);
create table if not exists public.owned_portraits (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  portrait_id text not null references public.portrait_catalog (id),
  source text not null,
  acquired_at timestamptz not null default now(),
  primary key (profile_id, portrait_id)
);
create table if not exists public.portrait_gifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tier int not null,
  options text[] not null,
  claimed text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists portrait_gifts_open on public.portrait_gifts (profile_id) where claimed is null;

create table if not exists public.score_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid not null unique references public.puzzle_attempts (id) on delete cascade,
  size int not null,
  difficulty text not null,
  points int not null check (points >= 0),
  created_at timestamptz not null default now()
);
create index if not exists score_events_time on public.score_events (created_at);
create index if not exists score_events_profile on public.score_events (profile_id);

create table if not exists public.personal_records (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  size int not null,
  difficulty text not null,
  best_sec int not null,
  attempt_id uuid not null,
  set_at timestamptz not null default now(),
  primary key (profile_id, size, difficulty)
);

alter table public.puzzle_attempts add column if not exists elapsed_sec int;
alter table public.profiles add column if not exists title text not null default '';
alter table public.profiles alter column avatar_id set default '';
alter table public.journey_steps add column if not exists need int;

create table if not exists public.family_friends (
  family_a uuid not null references public.families (id) on delete cascade,
  family_b uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_a, family_b),
  check (family_a < family_b)
);
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.profiles (id) on delete cascade,
  from_family uuid not null references public.families (id) on delete cascade,
  to_family uuid not null references public.families (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists friend_requests_to on public.friend_requests (to_family) where status = 'pending';

create table if not exists public.activities (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('clears', 'points', 'record', 'title', 'tier')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activities_profile on public.activities (profile_id, created_at desc);

create table if not exists public.activity_reactions (
  activity_id bigint not null references public.activities (id) on delete cascade,
  reactor uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  updated_at timestamptz not null default now(),
  primary key (activity_id, reactor)
);

do $$
declare t text;
begin
  foreach t in array array['portrait_catalog', 'title_catalog', 'owned_portraits', 'portrait_gifts', 'score_events', 'personal_records',
                           'family_friends', 'friend_requests', 'activities', 'activity_reactions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
  end loop;
end $$;
grant select on public.portrait_catalog, public.title_catalog to authenticated;
drop policy if exists portrait_read on public.portrait_catalog;
create policy portrait_read on public.portrait_catalog for select to authenticated using (true);
drop policy if exists title_read on public.title_catalog;
create policy title_read on public.title_catalog for select to authenticated using (true);

-- 예전 프로필 친구 관계 → 가족 친구 관계
insert into public.family_friends (family_a, family_b)
select distinct least(ma.family_id, mb.family_id), greatest(ma.family_id, mb.family_id)
from public.friendships f
join public.family_members ma on ma.profile_id = f.profile_a
join public.family_members mb on mb.profile_id = f.profile_b
where ma.family_id <> mb.family_id
on conflict do nothing;

-- ===================== 예전 기능 정리(집·방문·방명록·가구 상점) =====================
drop function if exists public.purchase_item(uuid, text, uuid);
drop function if exists public.claim_choice(uuid, text);
drop function if exists public.save_home(uuid, int, jsonb, uuid);
drop function if exists public.visit_home(uuid, uuid);
drop function if exists public.discover_note(uuid, uuid, text);
drop function if exists public.post_guestbook(uuid, uuid, text, text, uuid);
drop function if exists public.list_guestbook(uuid, uuid);
drop function if exists public.delete_guestbook(uuid, uuid);
drop function if exists public.list_connections(uuid);
drop function if exists public.set_goal(uuid, text);
drop function if exists private.validate_home(uuid, jsonb);
drop function if exists private.can_visit(uuid, uuid);
drop function if exists public.complete_attempt(uuid, text, uuid);

-- ===================== 공통 =====================
create or replace function private.are_friends(fa uuid, fb uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select fa = fb or exists (select 1 from public.family_friends where family_a = least(fa, fb) and family_b = greatest(fa, fb));
$$;

-- viewer 프로필이 other 프로필의 소식을 볼 수 있는가(같은 가족 또는 친구 가족)
create or replace function private.connected(viewer uuid, other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.are_friends(private.family_of(viewer), private.family_of(other));
$$;

create or replace function private.add_activity(p uuid, k text, payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.activities (profile_id, kind, payload) values (p, k, payload);
$$;

create or replace function private.tier_open(p uuid, t int) returns boolean
language sql stable security definer set search_path = '' as $$
  select t = 1 or exists (select 1 from public.unlocks where profile_id = p and key = 'tier:' || t);
$$;

-- 아직 없는 그 티어 초상화 중 셋을 골라 선물 상자를 만든다
create or replace function private.make_gift(p uuid, t int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare opts text[]; gid uuid;
begin
  select array_agg(id) into opts from (
    select c.id from public.portrait_catalog c
    where c.tier = t and not exists (select 1 from public.owned_portraits o where o.profile_id = p and o.portrait_id = c.id)
    order by random() limit 3) s;
  if opts is null then return null; end if;
  insert into public.portrait_gifts (profile_id, tier, options) values (p, t, opts) returning id into gid;
  return gid;
end $$;

create or replace function private.grant_title(p uuid, tid text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.unlocks (profile_id, key) values (p, 'title:' || tid) on conflict do nothing;
  if found then
    update public.profiles set title = tid where id = p and title = '';
    perform private.add_activity(p, 'title', jsonb_build_object('title', tid, 'name', (select name_ko from public.title_catalog where id = tid)));
  end if;
end $$;

create or replace function private.points_of(p uuid, since timestamptz default null) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(points), 0)::int from public.score_events where profile_id = p and (since is null or created_at >= since);
$$;

create or replace function private.week_start() returns timestamptz
language sql stable as $$
  select (date_trunc('week', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;

-- 새 프로필: 지갑·여정·기본 안내 친구. 초상화는 없이 시작한다.
create or replace function private.setup_new_profile(p uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.wallets (profile_id, balance) values (p, 0);
  insert into public.quest_progress (profile_id) values (p);
  insert into public.unlocks (profile_id, key) values (p, 'guide:hestia'), (p, 'guide:athena');
end $$;

-- ===================== 프로필 =====================
create or replace function public.create_my_profile(nickname text, avatar_id text, guide_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; fid uuid;
begin
  if auth.uid() is null then perform private.fail('not_signed_in', '다시 로그인해 주세요.'); end if;
  if exists (select 1 from public.profile_access where auth_user_id = auth.uid() and role = 'self' and revoked_at is null) then
    perform private.fail('already_exists', '이미 내 프로필이 있어요.');
  end if;
  if char_length(btrim(coalesce(nickname, ''))) not between 1 and 12 then perform private.fail('bad_name', '이름은 1~12자로 적어 주세요.'); end if;
  insert into public.profiles (nickname, avatar_id, guide_id) values (btrim(nickname), '', 'hestia') returning id into pid;
  insert into public.profile_access (profile_id, auth_user_id, role) values (pid, auth.uid(), 'self');
  insert into public.families default values returning id into fid;
  insert into public.family_members (family_id, profile_id, role) values (fid, pid, 'guardian');
  perform private.setup_new_profile(pid);
  return pid;
end $$;

create or replace function public.create_child_profile(guardian uuid, nickname text, avatar_id text, guide_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; fid uuid;
begin
  perform private.require_act(guardian);
  if not private.is_adult(guardian) then perform private.fail('forbidden', '보호자만 아이 프로필을 만들 수 있어요.'); end if;
  if char_length(btrim(coalesce(nickname, ''))) not between 1 and 12 then perform private.fail('bad_name', '이름은 1~12자로 적어 주세요.'); end if;
  fid := private.family_of(guardian);
  if (select count(*) from public.family_members where family_id = fid and role = 'child') >= 6 then
    perform private.fail('limit', '아이 프로필은 6개까지 만들 수 있어요.');
  end if;
  insert into public.profiles (nickname, avatar_id, guide_id, is_child) values (btrim(nickname), '', 'hestia', true) returning id into pid;
  insert into public.profile_access (profile_id, auth_user_id, role) values (pid, auth.uid(), 'guardian');
  insert into public.family_members (family_id, profile_id, role) values (fid, pid, 'child');
  perform private.setup_new_profile(pid);
  return pid;
end $$;

-- 이름·초상화(가진 것만)·칭호(받은 것만)·설정
create or replace function public.update_profile(p uuid, patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  if patch ? 'nickname' and char_length(btrim(patch->>'nickname')) not between 1 and 12 then
    perform private.fail('bad_name', '이름은 1~12자로 적어 주세요.');
  end if;
  if coalesce(patch->>'avatar_id', '') <> '' and not exists (
    select 1 from public.owned_portraits where profile_id = p and portrait_id = patch->>'avatar_id') then
    perform private.fail('not_owned', '아직 모으지 않은 초상화예요.');
  end if;
  if coalesce(patch->>'title', '') <> '' and not exists (
    select 1 from public.unlocks where profile_id = p and key = 'title:' || (patch->>'title')) then
    perform private.fail('locked', '아직 받지 않은 칭호예요.');
  end if;
  update public.profiles set
    nickname = coalesce(btrim(patch->>'nickname'), nickname),
    avatar_id = coalesce(patch->>'avatar_id', avatar_id),
    title = coalesce(patch->>'title', title),
    settings = case when patch ? 'settings' then patch->'settings' else settings end,
    updated_at = now()
  where id = p;
end $$;

create or replace function public.get_state(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.require_act(p);
  select jsonb_build_object(
    'profile', jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'title', pr.title,
      'is_child', pr.is_child, 'settings', pr.settings),
    'balance', (select balance from public.wallets where profile_id = p),
    'quest', (select jsonb_build_object('completed_count', q.completed_count, 'no_hint_count', q.no_hint_count) from public.quest_progress q where q.profile_id = p),
    'unlocks', coalesce((select jsonb_agg(key) from public.unlocks where profile_id = p), '[]'::jsonb),
    'owned', coalesce((select jsonb_agg(portrait_id order by acquired_at) from public.owned_portraits where profile_id = p), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'tier', g.tier, 'options', g.options) order by g.created_at)
      from public.portrait_gifts g where g.profile_id = p and g.claimed is null), '[]'::jsonb),
    'points', jsonb_build_object('total', private.points_of(p), 'week', private.points_of(p, private.week_start())),
    'records', coalesce((select jsonb_object_agg(size || ':' || difficulty, best_sec) from public.personal_records where profile_id = p), '{}'::jsonb),
    'active', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'puzzle_id', a.puzzle_id, 'size', c.size,
        'difficulty', c.difficulty, 'updated_at', a.updated_at) order by a.updated_at desc)
      from public.puzzle_attempts a join public.puzzle_catalog c on c.id = a.puzzle_id
      where a.profile_id = p and a.status = 'active'), '[]'::jsonb),
    'unread', (select count(*) from public.notifications where recipient_profile_id = p and read_at is null),
    'family_role', (select role from public.family_members where profile_id = p)
  ) into r from public.profiles pr where pr.id = p;
  return r;
end $$;

-- ===================== 초상화 =====================
create or replace function public.purchase_portrait(p uuid, portrait text, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.portrait_catalog; done jsonb; bal int; res jsonb;
begin
  perform private.require_act(p);
  select result into done from private.operations where operations.op_id = purchase_portrait.op_id;
  if found then return done || jsonb_build_object('repeat', true); end if;
  select * into c from public.portrait_catalog where id = portrait;
  if not found then perform private.fail('bad_item', '없는 초상화예요.'); end if;
  if not private.tier_open(p, c.tier) then perform private.fail('locked', '여정을 더 걸으면 이 티어가 열려요.'); end if;
  if exists (select 1 from public.owned_portraits where profile_id = p and portrait_id = portrait) then
    perform private.fail('owned', '이미 가진 초상화예요.');
  end if;
  update public.wallets set balance = balance - c.price where profile_id = p and balance >= c.price returning balance into bal;
  if not found then perform private.fail('not_enough', '별빛이 부족해요.'); end if;
  insert into public.reward_ledger (profile_id, event_key, amount, reason) values (p, 'buy:' || op_id, -c.price, 'portrait:' || portrait);
  insert into public.owned_portraits (profile_id, portrait_id, source) values (p, portrait, 'buy');
  res := jsonb_build_object('portrait', portrait, 'price', c.price, 'balance', bal);
  insert into private.operations (op_id, profile_id, kind, result) values (purchase_portrait.op_id, p, 'purchase', res);
  return res;
end $$;

-- 여정 선물: 셋 중 하나 고르기(한 번만). 처음 받은 초상화는 바로 프로필 얼굴이 된다.
create or replace function public.claim_gift(p uuid, gift uuid, portrait text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.portrait_gifts;
begin
  perform private.require_act(p);
  select * into g from public.portrait_gifts where id = gift and profile_id = p for update;
  if not found then perform private.fail('not_found', '선물을 찾을 수 없어요.'); end if;
  if g.claimed is not null then perform private.fail('claimed', '이미 고른 선물이에요.'); end if;
  if not (portrait = any (g.options)) then perform private.fail('bad_item', '선물 상자에 없는 초상화예요.'); end if;
  update public.portrait_gifts set claimed = portrait, claimed_at = now() where id = gift;
  insert into public.owned_portraits (profile_id, portrait_id, source) values (p, portrait, 'gift') on conflict do nothing;
  update public.profiles set avatar_id = portrait where id = p and avatar_id = '';
  return jsonb_build_object('portrait', portrait);
end $$;

-- ===================== 스도쿠 완료 =====================
-- 판 수·점수 구간 소식, 자기 기록(힌트 없이 끝낸 판의 시간), 여정 보상(별빛·티어·칭호·초상화 선물)
create or replace function public.complete_attempt(attempt uuid, board text, op_id uuid, elapsed_sec int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.puzzle_attempts; pz public.puzzle_catalog; sol text; amount int; q public.quest_progress;
  step public.journey_steps; res jsonb; jr jsonb := null; bal int; before_pts int; after_pts int; th int;
  secs int; wall int; prev int; rec jsonb := null; gift_id uuid := null; bonus int := 0; k text;
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

  -- 시간: 기기가 잰 시간(화면을 보고 있던 시간). 서버 시계보다 길 수 없다.
  wall := greatest(1, extract(epoch from now() - a.started_at)::int);
  secs := least(greatest(coalesce(complete_attempt.elapsed_sec, wall), 1), wall);

  -- 보상: 힌트 한 번마다 10%씩 줄어듦
  select r.amount into amount from public.reward_rules r where r.size = pz.size and r.difficulty = pz.difficulty;
  amount := amount * (10 - least(a.hints_used, 10)) / 10;
  insert into public.reward_ledger (profile_id, event_key, amount, reason) values (a.profile_id, 'complete:' || a.id, amount, 'puzzle:' || pz.id);
  update public.wallets set balance = balance + amount where profile_id = a.profile_id returning balance into bal;

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

  -- 자기 기록: 힌트 없이 끝낸 판만
  if a.hints_used = 0 then
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

  res := jsonb_build_object('reward', amount, 'balance', bal, 'completed_count', q.completed_count,
    'no_hint', a.hints_used = 0, 'hints_used', least(a.hints_used, 10), 'journey', jr, 'puzzle_id', pz.id,
    'size', pz.size, 'difficulty', pz.difficulty, 'elapsed', secs, 'record', rec, 'points', after_pts);
  update public.puzzle_attempts set status = 'completed', board = complete_attempt.board, completed_at = now(),
    updated_at = now(), elapsed_sec = secs, result = res where id = attempt;
  return res;
end $$;

-- ===================== 순위 =====================
-- board: all | 4 | 6 | 9e | 9m | 9h, period: all | week. 전체 플레이어 상위 50명 + 내 순위.
create or replace function public.get_leaderboard(p uuid, board text, period text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := null; sz int := null; df text := null; rows jsonb; me jsonb;
begin
  perform private.require_act(p);
  if period = 'week' then since := private.week_start(); elsif period <> 'all' then perform private.fail('bad_period', '기간이 맞지 않아요.'); end if;
  case board
    when 'all' then null;
    when '4' then sz := 4; df := 'intro';
    when '6' then sz := 6; df := 'intro';
    when '9e' then sz := 9; df := 'easy';
    when '9m' then sz := 9; df := 'medium';
    when '9h' then sz := 9; df := 'hard';
    else perform private.fail('bad_board', '순위표 종류가 맞지 않아요.');
  end case;
  with s as (
    select e.profile_id, sum(e.points)::int as pts, count(*)::int as games, max(e.created_at) as last_at
    from public.score_events e
    where (since is null or e.created_at >= since) and (sz is null or (e.size = sz and e.difficulty = df))
    group by e.profile_id having sum(e.points) > 0
  ), ranked as (
    select s.*, rank() over (order by s.pts desc) as rnk, row_number() over (order by s.pts desc, s.last_at) as rn from s
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'id', r.profile_id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id,
        'title', pr.title, 'points', r.pts, 'games', r.games, 'me', r.profile_id = p) order by r.rn)
      from ranked r join public.profiles pr on pr.id = r.profile_id where r.rn <= 50), '[]'::jsonb),
    (select jsonb_build_object('rank', r.rnk, 'points', r.pts, 'games', r.games) from ranked r where r.profile_id = p)
  into rows, me;
  return jsonb_build_object('rows', rows, 'me', me);
end $$;

-- ===================== 친구 =====================
create or replace function public.send_friend_request(p uuid, email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare my_fid uuid; target_uid uuid; target_profile uuid; target_fid uuid; req public.friend_requests; rev public.friend_requests;
begin
  perform private.require_act(p);
  my_fid := private.family_of(p);
  if (select count(*) from public.friend_requests where from_family = my_fid and created_at > now() - interval '1 hour') >= 20 then
    perform private.fail('rate_limited', '요청을 너무 많이 보냈어요. 잠시 뒤에 다시 해 주세요.', true);
  end if;
  select u.id into target_uid from auth.users u where lower(u.email) = lower(btrim(coalesce(send_friend_request.email, '')));
  if target_uid is null then perform private.fail('no_user', '이 이메일로 가입한 사람이 없어요. 철자를 확인해 주세요.'); end if;
  select a.profile_id into target_profile from public.profile_access a
    where a.auth_user_id = target_uid and a.role = 'self' and a.revoked_at is null limit 1;
  if target_profile is null then perform private.fail('no_user', '그 사람은 아직 게임 프로필을 만들지 않았어요.'); end if;
  target_fid := private.family_of(target_profile);
  if target_fid = my_fid then perform private.fail('same_family', '이미 같은 가족이에요.'); end if;
  if private.are_friends(my_fid, target_fid) then perform private.fail('already', '이미 친구예요.'); end if;
  -- 상대가 먼저 보낸 요청이 있으면 바로 친구
  select * into rev from public.friend_requests where from_family = target_fid and to_family = my_fid and status = 'pending' for update;
  if found then
    return public.respond_friend_request(p, rev.id, true);
  end if;
  select * into req from public.friend_requests where from_family = my_fid and to_family = target_fid and status = 'pending';
  if found then return jsonb_build_object('ok', true, 'status', 'pending', 'repeat', true); end if;
  insert into public.friend_requests (from_profile, from_family, to_family) values (p, my_fid, target_fid) returning * into req;
  insert into public.notifications (recipient_profile_id, kind, ref, payload)
    select m.profile_id, 'friend_request', req.id::text,
      jsonb_build_object('nickname', (select nickname from public.profiles where id = p), 'avatar_id', (select avatar_id from public.profiles where id = p))
    from public.family_members m where m.family_id = target_fid;
  return jsonb_build_object('ok', true, 'status', 'pending');
end $$;

create or replace function public.respond_friend_request(p uuid, request uuid, accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare req public.friend_requests;
begin
  perform private.require_act(p);
  select * into req from public.friend_requests where id = request for update;
  if not found or req.to_family <> private.family_of(p) then perform private.fail('not_found', '친구 요청을 찾을 수 없어요.'); end if;
  if req.status <> 'pending' then return jsonb_build_object('ok', true, 'status', req.status, 'repeat', true); end if;
  update public.friend_requests set status = case when accept then 'accepted' else 'declined' end, responded_at = now() where id = request;
  if accept then
    insert into public.family_friends (family_a, family_b) values (least(req.from_family, req.to_family), greatest(req.from_family, req.to_family))
      on conflict do nothing;
    insert into public.notifications (recipient_profile_id, kind, ref, payload)
      values (req.from_profile, 'friend_accepted', p::text, jsonb_build_object('nickname', (select nickname from public.profiles where id = p)));
  end if;
  return jsonb_build_object('ok', true, 'status', case when accept then 'accepted' else 'declined' end,
    'with', (select nickname from public.profiles where id = req.from_profile));
end $$;

create or replace function public.cancel_friend_request(p uuid, request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where id = request and from_family = private.family_of(p) and status = 'pending';
end $$;

-- 우리 가족·친구 가족·받은/보낸 요청
create or replace function public.list_friends(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare fid uuid;
begin
  perform private.require_act(p);
  fid := private.family_of(p);
  return jsonb_build_object(
    'family', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'title', pr.title,
        'is_child', pr.is_child, 'points', private.points_of(pr.id)) order by pr.is_child, pr.created_at)
      from public.family_members m join public.profiles pr on pr.id = m.profile_id where m.family_id = fid and pr.id <> p), '[]'::jsonb),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('family', ff.other, 'since', ff.created_at, 'members',
        (select jsonb_agg(jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'title', pr.title,
           'is_child', pr.is_child, 'points', private.points_of(pr.id)) order by pr.is_child, pr.created_at)
         from public.family_members m join public.profiles pr on pr.id = m.profile_id where m.family_id = ff.other)) order by ff.created_at)
      from (select case when family_a = fid then family_b else family_a end as other, created_at
            from public.family_friends where family_a = fid or family_b = fid) ff), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'created_at', r.created_at) order by r.created_at desc)
      from public.friend_requests r join public.profiles pr on pr.id = r.from_profile where r.to_family = fid and r.status = 'pending'), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'to', (select string_agg(pr.nickname, ', ' order by pr.created_at)
        from public.family_members m join public.profiles pr on pr.id = m.profile_id where m.family_id = r.to_family and m.role <> 'child'),
        'created_at', r.created_at) order by r.created_at desc)
      from public.friend_requests r where r.from_family = fid and r.status = 'pending'), '[]'::jsonb)
  );
end $$;

-- 친구 끊기: 상대 가족의 아무 프로필 id로
create or replace function public.remove_friend(p uuid, other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a uuid; b uuid;
begin
  perform private.require_act(p);
  a := private.family_of(p); b := private.family_of(other);
  delete from public.family_friends where family_a = least(a, b) and family_b = greatest(a, b);
end $$;

-- 가족 초대 코드만 남긴다(친구는 이메일 요청으로)
create or replace function public.create_invite(p uuid, kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare code text := ''; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; bytes bytea; i int; exp timestamptz := now() + interval '72 hours';
begin
  perform private.require_act(p);
  if not private.is_adult(p) then perform private.fail('forbidden', '초대는 어른 프로필에서 만들 수 있어요.'); end if;
  if kind <> 'family' then perform private.fail('bad_kind', '친구는 이메일로 요청해 주세요.'); end if;
  if (select count(*) from public.invites where from_profile = p and created_at > now() - interval '1 hour') >= 10 then
    perform private.fail('rate_limited', '잠시 뒤에 다시 만들어 주세요.', true);
  end if;
  bytes := extensions.gen_random_bytes(10);
  for i in 0..9 loop code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1); end loop;
  insert into public.invites (code_hash, kind, from_profile, family_id, expires_at)
    values (encode(extensions.digest(code, 'sha256'), 'hex'), 'family', p, private.family_of(p), exp);
  return jsonb_build_object('code', substr(code, 1, 5) || '-' || substr(code, 6, 5), 'expires_at', exp, 'kind', 'family');
end $$;

-- ===================== 친구 소식·이모티콘 =====================
create or replace function public.list_feed(p uuid, before_id bigint default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare fid uuid;
begin
  perform private.require_act(p);
  fid := private.family_of(p);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', ac.id, 'kind', ac.kind, 'payload', ac.payload, 'created_at', ac.created_at, 'mine', ac.profile_id = p,
      'who', jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'title', pr.title),
      'my_emoji', (select emoji from public.activity_reactions where activity_id = ac.id and reactor = p),
      'reactions', coalesce((select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'id', rp.id, 'nickname', rp.nickname, 'avatar_id', rp.avatar_id)
          order by r.updated_at) from public.activity_reactions r join public.profiles rp on rp.id = r.reactor where r.activity_id = ac.id), '[]'::jsonb)
    ) order by ac.id desc)
    from (select a.* from public.activities a
          join public.family_members m on m.profile_id = a.profile_id
          where private.are_friends(fid, m.family_id) and (before_id is null or a.id < before_id)
          order by a.id desc limit 40) ac
    join public.profiles pr on pr.id = ac.profile_id), '[]'::jsonb);
end $$;

-- 소식 하나에 이모티콘 하나. 같은 것을 다시 보내거나 빈 값이면 지운다. 내 소식에는 달 수 없다.
create or replace function public.set_reaction(p uuid, activity bigint, emoji text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ac public.activities; cur text;
begin
  perform private.require_act(p);
  select * into ac from public.activities where id = activity;
  if not found or not private.connected(p, ac.profile_id) then perform private.fail('not_found', '소식을 찾을 수 없어요.'); end if;
  if ac.profile_id = p then perform private.fail('own', '내 소식에는 이모티콘을 달 수 없어요.'); end if;
  select r.emoji into cur from public.activity_reactions r where activity_id = activity and reactor = p;
  if coalesce(emoji, '') = '' or emoji = cur then
    delete from public.activity_reactions where activity_id = activity and reactor = p;
    return jsonb_build_object('emoji', null);
  end if;
  if not (emoji = any (array['👍', '❤️', '👏', '🎉', '😆', '😮', '🔥', '🌟'])) then perform private.fail('bad_emoji', '고를 수 없는 이모티콘이에요.'); end if;
  insert into public.activity_reactions (activity_id, reactor, emoji) values (activity, p, emoji)
    on conflict (activity_id, reactor) do update set emoji = excluded.emoji, updated_at = now();
  insert into public.notifications (recipient_profile_id, kind, ref, payload)
    values (ac.profile_id, 'reaction', activity::text, jsonb_build_object('nickname', (select nickname from public.profiles where id = p),
      'avatar_id', (select avatar_id from public.profiles where id = p), 'emoji', emoji, 'activity_kind', ac.kind, 'activity', ac.payload));
  return jsonb_build_object('emoji', emoji);
end $$;

-- 우편함: 친구 요청은 지금 상태(대기·수락·거절)를 함께
create or replace function public.list_mail(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  return coalesce((select jsonb_agg(to_jsonb(n) - 'recipient_profile_id'
      || case when n.kind = 'friend_request' then jsonb_build_object('request_status', (select status from public.friend_requests where id::text = n.ref)) else '{}'::jsonb end
      order by n.created_at desc)
    from (select * from public.notifications where recipient_profile_id = p order by created_at desc limit 50) n), '[]'::jsonb);
end $$;

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
