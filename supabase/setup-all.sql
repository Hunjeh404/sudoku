-- 올림포스의 작은 정원: 기본 스키마
-- 원칙: 모든 표 RLS 활성화. 클라이언트는 읽기 일부만 직접 가능하고, 쓰기는 전부 검증 함수(RPC)로만.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

-- ---------- 카탈로그(서버 기준값) ----------
create table public.item_catalog (
  id text primary key,
  kind text not null check (kind in ('furniture', 'treasure')),
  name_ko text not null,
  price int not null check (price >= 0),
  surface text not null check (surface in ('floor', 'rug', 'wallRight', 'supportSlot', 'artifact')),
  fw int not null check (fw between 1 and 4),
  fh int not null check (fh between 1 and 4),
  blocking boolean not null,
  spaces text[] not null,
  supports text[] not null default '{}',
  unlock_step int not null default 0,
  sort int not null default 0
);

create table public.journey_steps (
  step int primary key check (step between 1 and 12),
  title text not null,
  reward jsonb not null
);

create table public.reward_rules (
  size int not null,
  difficulty text not null,
  amount int not null check (amount > 0),
  primary key (size, difficulty)
);

create table public.scene_catalog (
  file text primary key,
  chapter int not null
);

create table public.puzzle_catalog (
  id text primary key,
  size int not null check (size in (4, 6, 9)),
  difficulty text not null check (difficulty in ('intro', 'easy', 'medium', 'hard')),
  givens text not null,
  techniques jsonb not null default '{}',
  version int not null default 1,
  check (char_length(givens) = size * size)
);
create index on public.puzzle_catalog (size, difficulty);

create table private.puzzle_solutions (
  puzzle_id text primary key references public.puzzle_catalog (id) on delete cascade,
  solution text not null
);

-- ---------- 프로필·권한 ----------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 12),
  avatar_id text not null default 'hestia',
  guide_id text not null default 'hestia',
  is_child boolean not null default false,
  home_name text not null default '' check (char_length(home_name) <= 20),
  welcome_text text not null default '' check (char_length(welcome_text) <= 60),
  home_visibility text not null default 'friends' check (home_visibility in ('friends', 'private')),
  goal_item text references public.item_catalog (id),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('self', 'guardian')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index profile_access_active on public.profile_access (profile_id, auth_user_id) where revoked_at is null;
create index on public.profile_access (auth_user_id) where revoked_at is null;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 가족',
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null check (role in ('guardian', 'adult', 'child')),
  joined_at timestamptz not null default now(),
  primary key (family_id, profile_id)
);

create table public.friendships (
  profile_a uuid not null references public.profiles (id) on delete cascade,
  profile_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_a, profile_b),
  check (profile_a < profile_b)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  kind text not null check (kind in ('family', 'friend')),
  from_profile uuid not null references public.profiles (id) on delete cascade,
  family_id uuid references public.families (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table private.invite_attempts (
  auth_user_id uuid not null,
  at timestamptz not null default now()
);
create index on private.invite_attempts (auth_user_id, at);

-- 아이 기기 연결(후속 단계용 표. 1차 버전에서는 사용하지 않음)
create table public.device_requests (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  requester_uid uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 집·재화·보유 ----------
create table public.homes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  room_layout jsonb not null default '[]',
  garden_layout jsonb not null default '[]',
  exhibits jsonb not null default '{}',   -- {액자 uid: 장면 파일}
  notes jsonb not null default '{}',      -- {가구 uid: 숨은 쪽지(60자)}
  featured_uid text,
  music text,
  revision int not null default 0,
  saved_at timestamptz not null default now()
);

create table public.inventory (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.item_catalog (id),
  quantity int not null check (quantity >= 0),
  primary key (profile_id, item_id)
);

create table public.wallets (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  balance int not null default 0 check (balance >= 0)
);

create table public.reward_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_key text not null unique,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index on public.reward_ledger (profile_id, created_at desc);

create table private.operations (
  op_id uuid primary key,
  profile_id uuid not null,
  kind text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- 퍼즐·여정 ----------
create table public.puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_id text not null references public.puzzle_catalog (id),
  board text not null,
  notes jsonb not null default '{}',
  revision int not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  hints_used int not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb
);
create index on public.puzzle_attempts (profile_id, status, updated_at desc);

create table public.quest_progress (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  completed_count int not null default 0,
  no_hint_count int not null default 0,
  choice_pending boolean not null default false
);

create table public.unlocks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, key)
);

-- ---------- 방명록·우편함 ----------
create table public.guestbook (
  id uuid primary key default gen_random_uuid(),
  home_owner uuid not null references public.profiles (id) on delete cascade,
  author uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 0 and 80),
  sticker text,
  op_id uuid not null unique,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(text) > 0 or sticker is not null)
);
create index on public.guestbook (home_owner, created_at desc);
create index on public.guestbook (author, created_at desc);

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  ref text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (recipient_profile_id, created_at desc);

create table public.discovered_notes (
  visitor_profile_id uuid not null references public.profiles (id) on delete cascade,
  home_id uuid not null references public.profiles (id) on delete cascade,
  note_id text not null,
  created_at timestamptz not null default now(),
  primary key (visitor_profile_id, home_id, note_id)
);

-- 가족 공동 목표(후속 범위, 표만 준비)
create table public.family_goals (
  family_id uuid not null references public.families (id) on delete cascade,
  goal_key text not null,
  progress int not null default 0,
  primary key (family_id, goal_key)
);
create table public.family_contributions (
  attempt_id uuid primary key references public.puzzle_attempts (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  contribution int not null default 1
);

-- ---------- 권한: RLS + grant ----------
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_tables where schemaname in ('public', 'private') loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    execute format('revoke all on %I.%I from anon, authenticated, public', t.schemaname, t.tablename);
  end loop;
end $$;

-- 내 계정이 접근 권한을 가진 프로필인가
create or replace function private.can_act(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile_access a
    where a.profile_id = p and a.auth_user_id = auth.uid() and a.revoked_at is null
  );
$$;
revoke all on function private.can_act(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_act(uuid) to authenticated;

-- 공개 카탈로그는 로그인 사용자 읽기 허용
grant select on public.item_catalog, public.journey_steps, public.reward_rules, public.scene_catalog, public.puzzle_catalog to authenticated;
create policy catalog_read on public.item_catalog for select to authenticated using (true);
create policy journey_read on public.journey_steps for select to authenticated using (true);
create policy reward_read on public.reward_rules for select to authenticated using (true);
create policy scene_read on public.scene_catalog for select to authenticated using (true);
create policy puzzle_read on public.puzzle_catalog for select to authenticated using (true);

-- 본인 데이터 읽기만 허용(쓰기 정책 없음 = 직접 쓰기 불가)
grant select on public.profiles, public.wallets, public.inventory, public.homes, public.puzzle_attempts,
  public.quest_progress, public.unlocks, public.notifications, public.reward_ledger to authenticated;
create policy own_profile on public.profiles for select to authenticated using (private.can_act(id));
create policy own_wallet on public.wallets for select to authenticated using (private.can_act(profile_id));
create policy own_inventory on public.inventory for select to authenticated using (private.can_act(profile_id));
create policy own_home on public.homes for select to authenticated using (private.can_act(profile_id));
create policy own_attempts on public.puzzle_attempts for select to authenticated using (private.can_act(profile_id));
create policy own_quest on public.quest_progress for select to authenticated using (private.can_act(profile_id));
create policy own_unlocks on public.unlocks for select to authenticated using (private.can_act(profile_id));
create policy own_mail on public.notifications for select to authenticated using (private.can_act(recipient_profile_id));
create policy own_ledger on public.reward_ledger for select to authenticated using (private.can_act(profile_id));
-- 서버 함수(RPC). 모두 security definer로 실행하되, 함수 안에서 호출자 인증·프로필 권한·입력을 검증한다.
-- 오류: message=기계용 코드, detail=사용자용 문구, hint='retry'(다시 시도 가능) 또는 'final'.

create or replace function private.fail(code text, msg text, retry boolean default false) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = code, detail = msg, hint = case when retry then 'retry' else 'final' end;
end $$;

-- 아이 프로필은 같은 가족의 보호자·어른 계정도 사용할 수 있다(보호자 관리 프로필)
create or replace function private.can_act(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile_access a
    where a.profile_id = p and a.auth_user_id = auth.uid() and a.revoked_at is null
  ) or exists (
    select 1
    from public.family_members child
    join public.family_members adult on adult.family_id = child.family_id and adult.role in ('guardian', 'adult')
    join public.profile_access a on a.profile_id = adult.profile_id and a.role = 'self' and a.revoked_at is null
    where child.profile_id = p and child.role = 'child' and a.auth_user_id = auth.uid()
  );
$$;

create or replace function private.require_act(p uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.fail('not_signed_in', '다시 로그인해 주세요.'); end if;
  if p is null or not private.can_act(p) then perform private.fail('forbidden', '이 프로필로는 할 수 없는 일이에요.'); end if;
end $$;

create or replace function private.family_of(p uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.family_members where profile_id = p;
$$;

create or replace function private.is_adult(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not is_child from public.profiles where id = p;
$$;

-- 방문 가능: 본인, 같은 가족, 또는 두 가족 사이에 친구 관계가 있고 집이 비공개가 아닐 때
create or replace function private.can_visit(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = owner or (
    (select home_visibility from public.profiles where id = owner) = 'friends' and (
      private.family_of(viewer) = private.family_of(owner)
      or exists (
        select 1 from public.friendships f
        join public.family_members ma on ma.profile_id in (f.profile_a, f.profile_b)
        join public.family_members mb on mb.profile_id in (f.profile_a, f.profile_b) and mb.profile_id <> ma.profile_id
        where ma.family_id = private.family_of(viewer) and mb.family_id = private.family_of(owner)
      )
    )
  );
$$;

create or replace function private.grant_item(p uuid, item text, qty int) returns void
language sql security definer set search_path = '' as $$
  insert into public.inventory (profile_id, item_id, quantity) values (p, item, qty)
  on conflict (profile_id, item_id) do update set quantity = public.inventory.quantity + excluded.quantity;
$$;

-- 새 프로필의 기본 집(빈 집 대신 기본 가구 배치)
create or replace function private.setup_new_profile(p uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.wallets (profile_id, balance) values (p, 0);
  insert into public.quest_progress (profile_id) values (p);
  perform private.grant_item(p, i.item, i.q)
  from (values ('laurel_rug', 1), ('tea_table', 1), ('round_stool', 1), ('cloud_cushion', 1), ('laurel_door', 1),
               ('owl_mailbox', 1), ('display_pedestal', 1), ('laurel_bench', 1), ('treasure_chest', 1)) as i(item, q);
  insert into public.homes (profile_id, room_layout, garden_layout) values (p,
    '[{"uid":"r1","item":"laurel_rug","x":4,"y":4},
      {"uid":"r2","item":"tea_table","x":5,"y":4},
      {"uid":"r3","item":"round_stool","x":8,"y":5},
      {"uid":"r4","item":"cloud_cushion","x":2,"y":6},
      {"uid":"r5","item":"laurel_door","x":8},
      {"uid":"r6","item":"display_pedestal","x":1,"y":1},
      {"uid":"r7","item":"treasure_chest","x":9,"y":1}]'::jsonb,
    '[{"uid":"g1","item":"laurel_bench","x":4,"y":2},
      {"uid":"g2","item":"owl_mailbox","x":9,"y":7}]'::jsonb);
  insert into public.unlocks (profile_id, key) values (p, 'guide:hestia'), (p, 'guide:athena');
end $$;

-- ===================== 프로필 =====================
create or replace function public.my_profiles() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.fail('not_signed_in', '다시 로그인해 주세요.'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar_id', p.avatar_id,
      'is_child', p.is_child, 'mine', exists (select 1 from public.profile_access a where a.profile_id = p.id
        and a.auth_user_id = auth.uid() and a.role = 'self' and a.revoked_at is null)) order by p.is_child, p.created_at)
    from public.profiles p where private.can_act(p.id)), '[]'::jsonb);
end $$;

create or replace function public.create_my_profile(nickname text, avatar_id text, guide_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; fid uuid;
begin
  if auth.uid() is null then perform private.fail('not_signed_in', '다시 로그인해 주세요.'); end if;
  if exists (select 1 from public.profile_access where auth_user_id = auth.uid() and role = 'self' and revoked_at is null) then
    perform private.fail('already_exists', '이미 내 프로필이 있어요.');
  end if;
  if guide_id not in ('hestia', 'athena') then guide_id := 'hestia'; end if;
  insert into public.profiles (nickname, avatar_id, guide_id, home_name)
    values (btrim(nickname), avatar_id, guide_id, left(btrim(nickname), 14) || '의 집') returning id into pid;
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
  fid := private.family_of(guardian);
  if (select count(*) from public.family_members where family_id = fid and role = 'child') >= 6 then
    perform private.fail('limit', '아이 프로필은 6개까지 만들 수 있어요.');
  end if;
  if guide_id not in ('hestia', 'athena') then guide_id := 'hestia'; end if;
  insert into public.profiles (nickname, avatar_id, guide_id, is_child, home_name)
    values (btrim(nickname), avatar_id, guide_id, true, left(btrim(nickname), 14) || '의 집') returning id into pid;
  insert into public.profile_access (profile_id, auth_user_id, role) values (pid, auth.uid(), 'guardian');
  insert into public.family_members (family_id, profile_id, role) values (fid, pid, 'child');
  perform private.setup_new_profile(pid);
  return pid;
end $$;

create or replace function public.update_profile(p uuid, patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  if patch ? 'guide_id' and not exists (select 1 from public.unlocks where profile_id = p and key = 'guide:' || (patch->>'guide_id')) then
    perform private.fail('locked', '아직 만나지 않은 안내 친구예요.');
  end if;
  update public.profiles set
    nickname = coalesce(btrim(patch->>'nickname'), nickname),
    avatar_id = coalesce(patch->>'avatar_id', avatar_id),
    guide_id = coalesce(patch->>'guide_id', guide_id),
    home_name = coalesce(patch->>'home_name', home_name),
    welcome_text = coalesce(patch->>'welcome_text', welcome_text),
    home_visibility = coalesce(patch->>'home_visibility', home_visibility),
    settings = case when patch ? 'settings' then patch->'settings' else settings end,
    updated_at = now()
  where id = p;
end $$;

create or replace function public.set_goal(p uuid, item text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  update public.profiles set goal_item = item where id = p;
end $$;

-- 화면 첫 로드에 필요한 내 상태 전부
create or replace function public.get_state(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.require_act(p);
  select jsonb_build_object(
    'profile', to_jsonb(pr),
    'balance', (select balance from public.wallets where profile_id = p),
    'inventory', coalesce((select jsonb_object_agg(item_id, quantity) from public.inventory where profile_id = p), '{}'::jsonb),
    'home', (select to_jsonb(h) from public.homes h where h.profile_id = p),
    'quest', (select to_jsonb(q) - 'profile_id' from public.quest_progress q where q.profile_id = p),
    'unlocks', coalesce((select jsonb_agg(key) from public.unlocks where profile_id = p), '[]'::jsonb),
    'active', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'puzzle_id', a.puzzle_id, 'size', c.size,
        'difficulty', c.difficulty, 'updated_at', a.updated_at) order by a.updated_at desc)
      from public.puzzle_attempts a join public.puzzle_catalog c on c.id = a.puzzle_id
      where a.profile_id = p and a.status = 'active'), '[]'::jsonb),
    'unread', (select count(*) from public.notifications where recipient_profile_id = p and read_at is null),
    'family_role', (select role from public.family_members where profile_id = p)
  ) into r from public.profiles pr where pr.id = p;
  return r;
end $$;

-- ===================== 스도쿠 =====================
create or replace function public.start_attempt(p uuid, board_size int, difficulty text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  perform private.require_act(p);
  select at.* into a from public.puzzle_attempts at join public.puzzle_catalog c on c.id = at.puzzle_id
    where at.profile_id = p and at.status = 'active' and c.size = board_size and c.difficulty = start_attempt.difficulty
    order by at.updated_at desc limit 1;
  if not found then
    select c.* into pz from public.puzzle_catalog c
      where c.size = board_size and c.difficulty = start_attempt.difficulty
        and c.id not in (select puzzle_id from public.puzzle_attempts where profile_id = p order by started_at desc limit 30)
      order by random() limit 1;
    if not found then
      select c.* into pz from public.puzzle_catalog c
        where c.size = board_size and c.difficulty = start_attempt.difficulty order by random() limit 1;
    end if;
    if not found then perform private.fail('no_puzzle', '이 크기와 난이도의 문제가 없어요.'); end if;
    insert into public.puzzle_attempts (profile_id, puzzle_id, board) values (p, pz.id, pz.givens) returning * into a;
  end if;
  select * into pz from public.puzzle_catalog where id = a.puzzle_id;
  return jsonb_build_object('id', a.id, 'puzzle_id', a.puzzle_id, 'size', pz.size, 'difficulty', pz.difficulty,
    'givens', pz.givens, 'board', a.board, 'notes', a.notes, 'revision', a.revision, 'hints_used', a.hints_used);
end $$;

create or replace function public.get_attempt(attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  select * into a from public.puzzle_attempts where id = attempt;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  select * into pz from public.puzzle_catalog where id = a.puzzle_id;
  return jsonb_build_object('id', a.id, 'puzzle_id', a.puzzle_id, 'size', pz.size, 'difficulty', pz.difficulty,
    'givens', pz.givens, 'board', a.board, 'notes', a.notes, 'revision', a.revision, 'hints_used', a.hints_used, 'status', a.status);
end $$;

create or replace function private.check_board(board text, givens text, n int) returns void
language plpgsql immutable as $$
declare i int; ch text;
begin
  if board is null or char_length(board) <> n * n then perform private.fail('bad_board', '퍼즐 형식이 맞지 않아요.'); end if;
  for i in 1..n * n loop
    ch := substr(board, i, 1);
    if ch <> '.' and (ch !~ '^[1-9]$' or ch::int > n) then perform private.fail('bad_board', '퍼즐 형식이 맞지 않아요.'); end if;
    if substr(givens, i, 1) <> '.' and substr(givens, i, 1) <> ch then
      perform private.fail('given_changed', '처음부터 있던 숫자는 바꿀 수 없어요.');
    end if;
  end loop;
end $$;

create or replace function public.save_attempt(attempt uuid, expected_revision int, board text, notes jsonb, hints_used int, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status <> 'active' then perform private.fail('not_active', '이미 끝난 퍼즐이에요.'); end if;
  if a.revision <> expected_revision then
    raise exception using errcode = 'P0001', message = 'conflict', detail = '다른 기기에서 먼저 저장했어요.', hint = 'final:' || a.revision;
  end if;
  select * into pz from public.puzzle_catalog where id = a.puzzle_id;
  perform private.check_board(board, pz.givens, pz.size);
  if pg_column_size(notes) > 8000 then perform private.fail('bad_notes', '메모가 너무 많아요.'); end if;
  update public.puzzle_attempts set board = save_attempt.board, notes = coalesce(save_attempt.notes, '{}'::jsonb),
    hints_used = greatest(a.hints_used, coalesce(save_attempt.hints_used, 0)),
    revision = a.revision + 1, updated_at = now() where id = attempt;
  return jsonb_build_object('revision', a.revision + 1);
end $$;

create or replace function public.abandon_attempt(attempt uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status = 'active' then update public.puzzle_attempts set status = 'abandoned', updated_at = now() where id = attempt; end if;
end $$;

-- 완료: 서버가 초기칸·최종해를 검증하고, 상태 전환·별빛·여정·알림을 한 트랜잭션에서 처리. 반복 호출은 같은 결과.
create or replace function public.complete_attempt(attempt uuid, board text, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.puzzle_attempts; pz public.puzzle_catalog; sol text; amount int; q public.quest_progress;
  step public.journey_steps; res jsonb; unlocked jsonb := '[]'::jsonb; k text; it record; bal int;
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

  select r.amount into amount from public.reward_rules r where r.size = pz.size and r.difficulty = pz.difficulty;
  insert into public.reward_ledger (profile_id, event_key, amount, reason)
    values (a.profile_id, 'complete:' || a.id, amount, 'puzzle:' || pz.id);
  update public.wallets set balance = balance + amount where profile_id = a.profile_id returning balance into bal;
  update public.quest_progress set completed_count = completed_count + 1,
    no_hint_count = no_hint_count + case when a.hints_used = 0 then 1 else 0 end
    where profile_id = a.profile_id returning * into q;

  select * into step from public.journey_steps where journey_steps.step = q.completed_count;
  if found then
    for it in select key, value from jsonb_each_text(coalesce(step.reward->'items', '{}'::jsonb)) loop
      perform private.grant_item(a.profile_id, it.key, it.value::int);
    end loop;
    for k in select jsonb_array_elements_text(coalesce(step.reward->'unlock', '[]'::jsonb)) loop
      insert into public.unlocks (profile_id, key) values (a.profile_id, k) on conflict do nothing;
    end loop;
    if (step.reward->>'choice')::boolean then
      update public.quest_progress set choice_pending = true where profile_id = a.profile_id;
    end if;
    unlocked := jsonb_build_object('step', step.step, 'title', step.title, 'reward', step.reward);
  end if;

  res := jsonb_build_object('reward', amount, 'balance', bal, 'completed_count', q.completed_count,
    'no_hint', a.hints_used = 0, 'journey', unlocked, 'puzzle_id', pz.id);
  update public.puzzle_attempts set status = 'completed', board = complete_attempt.board, completed_at = now(),
    updated_at = now(), result = res where id = attempt;
  return res;
end $$;

-- 첫 완료 보상: 세 장식 중 하나 무료 선택(한 번만)
create or replace function public.claim_choice(p uuid, item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  if item not in ('olive_planter', 'star_lantern', 'music_stand') then perform private.fail('bad_item', '고를 수 없는 장식이에요.'); end if;
  update public.quest_progress set choice_pending = false where profile_id = p and choice_pending;
  if not found then perform private.fail('no_choice', '이미 선물을 골랐어요.'); end if;
  perform private.grant_item(p, item, 1);
  insert into public.unlocks (profile_id, key) values (p, 'choice:' || item) on conflict do nothing;
  return jsonb_build_object('item', item);
end $$;

-- ===================== 상점 =====================
create or replace function public.purchase_item(p uuid, item text, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.item_catalog; done jsonb; bal int; cnt int; res jsonb;
begin
  perform private.require_act(p);
  select result into done from private.operations where operations.op_id = purchase_item.op_id;
  if found then return done || jsonb_build_object('repeat', true); end if;
  select * into c from public.item_catalog where id = item;
  if not found then perform private.fail('bad_item', '없는 물건이에요.'); end if;
  select completed_count into cnt from public.quest_progress where profile_id = p;
  if c.unlock_step > cnt then perform private.fail('locked', '여정을 더 진행하면 살 수 있어요.'); end if;
  update public.wallets set balance = balance - c.price where profile_id = p and balance >= c.price returning balance into bal;
  if not found then perform private.fail('not_enough', '별빛이 부족해요.'); end if;
  insert into public.reward_ledger (profile_id, event_key, amount, reason) values (p, 'buy:' || op_id, -c.price, 'item:' || item);
  perform private.grant_item(p, item, 1);
  res := jsonb_build_object('item', item, 'price', c.price, 'balance', bal,
    'quantity', (select quantity from public.inventory where profile_id = p and item_id = item));
  insert into private.operations (op_id, profile_id, kind, result) values (purchase_item.op_id, p, 'purchase', res);
  return res;
end $$;

-- ===================== 집 =====================
create or replace function private.validate_home(p uuid, home jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  sp text; arr jsonb; el jsonb; c public.item_catalog; pc public.item_catalog; parent jsonb;
  uids text[] := '{}'; counts jsonb := '{}'; i int; j int; a jsonb; b jsonb; ca public.item_catalog; cb public.item_catalog;
  x int; y int; kids text[] := '{}'; k text; v text; frames text[] := '{}'; all_uids text[] := '{}';
begin
  foreach sp in array array['room', 'garden'] loop
    arr := home->(sp || '_layout');
    if arr is null or jsonb_typeof(arr) <> 'array' then perform private.fail('bad_layout', '배치 형식이 맞지 않아요.'); end if;
    if jsonb_array_length(arr) > 60 then perform private.fail('too_many', '한 공간에는 60개까지 놓을 수 있어요.'); end if;
    for el in select * from jsonb_array_elements(arr) loop
      if jsonb_typeof(el->'uid') <> 'string' or char_length(el->>'uid') not between 1 and 24 or (el->>'uid') = any (all_uids) then
        perform private.fail('bad_layout', '배치 형식이 맞지 않아요.');
      end if;
      all_uids := all_uids || (el->>'uid');
      select * into c from public.item_catalog where id = el->>'item';
      if not found or not (sp = any (c.spaces)) then perform private.fail('bad_place', '여기에 놓을 수 없는 물건이 있어요.'); end if;
      counts := jsonb_set(counts, array[c.id], to_jsonb(coalesce((counts->>c.id)::int, 0) + 1));
      if c.surface in ('floor', 'rug') then
        if jsonb_typeof(el->'x') <> 'number' or jsonb_typeof(el->'y') <> 'number' then perform private.fail('bad_layout', '배치 형식이 맞지 않아요.'); end if;
        x := (el->>'x')::int; y := (el->>'y')::int;
        if x < 0 or y < 0 or x + c.fw > 12 or y + c.fh > 10 then perform private.fail('out_of_bounds', '바닥 밖으로 나간 물건이 있어요.'); end if;
      elsif c.surface = 'wallRight' then
        if jsonb_typeof(el->'x') <> 'number' then perform private.fail('bad_layout', '배치 형식이 맞지 않아요.'); end if;
        x := (el->>'x')::int;
        if x < 0 or x + c.fw > 12 then perform private.fail('out_of_bounds', '벽 밖으로 나간 물건이 있어요.'); end if;
      else
        parent := null;
        select e into parent from jsonb_array_elements(arr) e where e->>'uid' = el->>'parent';
        if parent is null then perform private.fail('no_support', '받침 가구 위에만 놓을 수 있어요.'); end if;
        select * into pc from public.item_catalog where id = parent->>'item';
        if not (c.surface = any (pc.supports) or c.id = any (pc.supports)) then perform private.fail('no_support', '받침 가구 위에만 놓을 수 있어요.'); end if;
        if (el->>'parent') = any (kids) then perform private.fail('slot_taken', '받침 하나에는 하나만 놓을 수 있어요.'); end if;
        kids := kids || (el->>'parent');
      end if;
      if c.id = 'picture_frame' then frames := frames || (el->>'uid'); end if;
    end loop;
    -- 겹침 검사(바닥 막힘 가구끼리, 벽 장식끼리)
    for i in 0 .. jsonb_array_length(arr) - 1 loop
      a := arr->i; select * into ca from public.item_catalog where id = a->>'item';
      for j in i + 1 .. jsonb_array_length(arr) - 1 loop
        b := arr->j; select * into cb from public.item_catalog where id = b->>'item';
        if (ca.surface = 'floor' and cb.surface = 'floor' and ca.blocking and cb.blocking)
           or (ca.surface = 'wallRight' and cb.surface = 'wallRight') then
          if (a->>'x')::int < (b->>'x')::int + cb.fw and (b->>'x')::int < (a->>'x')::int + ca.fw
             and (ca.surface = 'wallRight' or ((a->>'y')::int < (b->>'y')::int + cb.fh and (b->>'y')::int < (a->>'y')::int + ca.fh)) then
            perform private.fail('overlap', '겹친 물건이 있어요.');
          end if;
        end if;
      end loop;
    end loop;
  end loop;
  -- 보유 수량
  for k, v in select key, value from jsonb_each_text(counts) loop
    if v::int > coalesce((select quantity from public.inventory where profile_id = p and item_id = k), 0) then
      perform private.fail('not_owned', '가진 것보다 많이 놓았어요.');
    end if;
  end loop;
  -- 액자 그림: 해금한 장 그림만
  for k, v in select key, value from jsonb_each_text(coalesce(home->'exhibits', '{}'::jsonb)) loop
    if not (k = any (frames)) then perform private.fail('bad_exhibit', '액자가 없는 그림 설정이 있어요.'); end if;
    if not exists (select 1 from public.scene_catalog s join public.unlocks u on u.key = 'chapter:' || s.chapter and u.profile_id = p where s.file = v) then
      perform private.fail('bad_exhibit', '아직 열지 않은 그림이에요.');
    end if;
  end loop;
  -- 숨은 쪽지
  for k, v in select key, value from jsonb_each_text(coalesce(home->'notes', '{}'::jsonb)) loop
    if not (k = any (all_uids)) or char_length(v) > 60 then perform private.fail('bad_note', '쪽지는 60자까지 쓸 수 있어요.'); end if;
  end loop;
  if home->>'music' is not null and (home->>'music') !~ '^[A-Za-z_]{1,40}$' then
    perform private.fail('bad_layout', '음악을 다시 골라 주세요.');
  end if;
  if home->>'featured_uid' is not null and not ((home->>'featured_uid') = any (all_uids)) then
    perform private.fail('bad_layout', '오늘의 전시품을 다시 골라 주세요.');
  end if;
end $$;

create or replace function public.save_home(p uuid, expected_revision int, home jsonb, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.homes; done jsonb; res jsonb;
begin
  perform private.require_act(p);
  select result into done from private.operations where operations.op_id = save_home.op_id;
  if found then return done || jsonb_build_object('repeat', true); end if;
  select * into h from public.homes where profile_id = p for update;
  if h.revision <> expected_revision then
    raise exception using errcode = 'P0001', message = 'conflict', detail = '다른 기기에서 먼저 저장했어요.', hint = 'final:' || h.revision;
  end if;
  perform private.validate_home(p, home);
  update public.homes set room_layout = home->'room_layout', garden_layout = home->'garden_layout',
    exhibits = coalesce(home->'exhibits', '{}'::jsonb), notes = coalesce(home->'notes', '{}'::jsonb),
    featured_uid = home->>'featured_uid', music = home->>'music',
    revision = h.revision + 1, saved_at = now() where profile_id = p;
  res := jsonb_build_object('revision', h.revision + 1, 'saved_at', now());
  insert into private.operations (op_id, profile_id, kind, result) values (save_home.op_id, p, 'save_home', res);
  return res;
end $$;

-- 방문: 권한 확인 뒤 공개용 데이터만(이메일·인증정보·재화·퍼즐 기록 없음)
create or replace function public.visit_home(viewer uuid, owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_act(viewer);
  if not private.can_visit(viewer, owner) then perform private.fail('no_access', '지금은 이 집에 놀러 갈 수 없어요.'); end if;
  return (select jsonb_build_object(
    'owner', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar_id', p.avatar_id, 'home_name', p.home_name,
      'welcome_text', p.welcome_text, 'guide_id', p.guide_id),
    'room_layout', h.room_layout, 'garden_layout', h.garden_layout, 'exhibits', h.exhibits, 'notes', h.notes,
    'featured_uid', h.featured_uid, 'music', h.music, 'saved_at', h.saved_at,
    'discovered', coalesce((select jsonb_agg(note_id) from public.discovered_notes d where d.visitor_profile_id = viewer and d.home_id = owner), '[]'::jsonb))
    from public.profiles p join public.homes h on h.profile_id = p.id where p.id = owner);
end $$;

create or replace function public.discover_note(viewer uuid, owner uuid, note_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(viewer);
  if viewer = owner or not private.can_visit(viewer, owner) then return; end if;
  if not exists (select 1 from public.homes where profile_id = owner and notes ? note_id) then return; end if;
  insert into public.discovered_notes (visitor_profile_id, home_id, note_id) values (viewer, owner, note_id) on conflict do nothing;
end $$;

-- ===================== 가족·친구 =====================
create or replace function public.list_connections(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare fid uuid;
begin
  perform private.require_act(p);
  fid := private.family_of(p);
  return coalesce((
    select jsonb_agg(x order by x->>'relation', x->>'nickname') from (
      select jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'home_name', pr.home_name,
        'saved_at', h.saved_at, 'relation', case when m.family_id = fid then 'family' else 'friend' end,
        'can_visit', private.can_visit(p, pr.id), 'is_child', pr.is_child) as x
      from public.profiles pr
      join public.family_members m on m.profile_id = pr.id
      join public.homes h on h.profile_id = pr.id
      where pr.id <> p and (m.family_id = fid or exists (
        select 1 from public.friendships f
        join public.family_members ma on ma.profile_id in (f.profile_a, f.profile_b) and ma.family_id = fid
        join public.family_members mb on mb.profile_id in (f.profile_a, f.profile_b) and mb.profile_id <> ma.profile_id
        where mb.family_id = m.family_id))
    ) s), '[]'::jsonb);
end $$;

create or replace function public.create_invite(p uuid, kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare code text := ''; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; bytes bytea; i int; exp timestamptz := now() + interval '72 hours';
begin
  perform private.require_act(p);
  if not private.is_adult(p) then perform private.fail('forbidden', '초대는 어른 프로필에서 만들 수 있어요.'); end if;
  if kind not in ('family', 'friend') then perform private.fail('bad_kind', '초대 종류가 맞지 않아요.'); end if;
  if (select count(*) from public.invites where from_profile = p and created_at > now() - interval '1 hour') >= 10 then
    perform private.fail('rate_limited', '잠시 뒤에 다시 만들어 주세요.', true);
  end if;
  bytes := extensions.gen_random_bytes(10);
  for i in 0..9 loop code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1); end loop;
  insert into public.invites (code_hash, kind, from_profile, family_id, expires_at)
    values (encode(extensions.digest(code, 'sha256'), 'hex'), kind, p, case when kind = 'family' then private.family_of(p) end, exp);
  return jsonb_build_object('code', substr(code, 1, 5) || '-' || substr(code, 6, 5), 'expires_at', exp, 'kind', kind);
end $$;

create or replace function public.accept_invite(p uuid, code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare inv public.invites; norm text; old_fid uuid; a uuid; b uuid;
begin
  perform private.require_act(p);
  if (select count(*) from private.invite_attempts where auth_user_id = auth.uid() and at > now() - interval '10 minutes') >= 10 then
    perform private.fail('rate_limited', '시도가 너무 많아요. 10분 뒤에 다시 해 주세요.', true);
  end if;
  insert into private.invite_attempts (auth_user_id) values (auth.uid());
  norm := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  select * into inv from public.invites where code_hash = encode(extensions.digest(norm, 'sha256'), 'hex') for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    -- 예외 대신 결과로 돌려줘야 시도 기록이 롤백되지 않는다(대입 시도 제한용)
    return jsonb_build_object('ok', false, 'error', 'bad_code', 'message', '초대 코드가 맞지 않거나 시간이 지났어요.');
  end if;
  if not private.is_adult(p) then perform private.fail('forbidden', '어른 프로필로 받아 주세요.'); end if;
  if private.family_of(p) = private.family_of(inv.from_profile) then perform private.fail('already', '이미 같은 가족이에요.'); end if;
  if inv.kind = 'family' then
    old_fid := private.family_of(p);
    if (select count(*) from public.family_members where family_id = old_fid) > 1 then
      perform private.fail('has_family', '이미 다른 가족과 함께 있어요. 친구 초대로 연결해 주세요.');
    end if;
    delete from public.family_members where profile_id = p;
    delete from public.families where id = old_fid;
    insert into public.family_members (family_id, profile_id, role) values (inv.family_id, p, 'adult');
  else
    a := least(p, inv.from_profile); b := greatest(p, inv.from_profile);
    insert into public.friendships (profile_a, profile_b) values (a, b) on conflict do nothing;
  end if;
  update public.invites set used_at = now(), used_by = p where id = inv.id;
  insert into public.notifications (recipient_profile_id, kind, ref, payload)
    values (inv.from_profile, 'invite_accepted', p::text, jsonb_build_object('nickname', (select nickname from public.profiles where id = p), 'kind', inv.kind));
  return jsonb_build_object('ok', true, 'kind', inv.kind, 'with', (select nickname from public.profiles where id = inv.from_profile));
end $$;

create or replace function public.remove_friend(p uuid, other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  if not private.is_adult(p) then perform private.fail('forbidden', '어른 프로필에서 할 수 있어요.'); end if;
  delete from public.friendships f where exists (
    select 1 from public.family_members ma, public.family_members mb
    where ma.family_id = private.family_of(p) and mb.family_id = private.family_of(other)
      and ((f.profile_a = ma.profile_id and f.profile_b = mb.profile_id) or (f.profile_b = ma.profile_id and f.profile_a = mb.profile_id)));
end $$;

-- ===================== 방명록·우편함 =====================
create or replace function public.post_guestbook(viewer uuid, owner uuid, body text, sticker text, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.guestbook; t text := btrim(coalesce(body, ''));
begin
  perform private.require_act(viewer);
  select * into g from public.guestbook where guestbook.op_id = post_guestbook.op_id;
  if found then
    if g.author <> viewer then perform private.fail('forbidden', '다시 써 주세요.'); end if;
    return jsonb_build_object('id', g.id, 'created_at', g.created_at, 'repeat', true);
  end if;
  if not private.can_visit(viewer, owner) then perform private.fail('no_access', '지금은 이 집에 글을 남길 수 없어요.'); end if;
  if char_length(t) > 80 then perform private.fail('too_long', '80자까지 쓸 수 있어요.'); end if;
  if t = '' and sticker is null then perform private.fail('empty', '글이나 스티커를 남겨 주세요.'); end if;
  if sticker is not null and sticker !~ '^[a-z_]{1,20}$' then perform private.fail('bad_sticker', '스티커를 다시 골라 주세요.'); end if;
  if exists (select 1 from public.guestbook where author = viewer and created_at > now() - interval '30 seconds') then
    perform private.fail('rate_limited', '30초 뒤에 다시 남길 수 있어요.', true);
  end if;
  insert into public.guestbook (home_owner, author, text, sticker, op_id) values (owner, viewer, t, sticker, op_id) returning * into g;
  if owner <> viewer then
    insert into public.notifications (recipient_profile_id, kind, ref, payload)
      values (owner, 'guestbook', g.id::text, jsonb_build_object('nickname', (select nickname from public.profiles where id = viewer), 'preview', left(t, 30), 'sticker', sticker));
  end if;
  return jsonb_build_object('id', g.id, 'created_at', g.created_at);
end $$;

create or replace function public.list_guestbook(viewer uuid, owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_act(viewer);
  if not private.can_visit(viewer, owner) then perform private.fail('no_access', '지금은 이 집의 방명록을 볼 수 없어요.'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'text', g.text, 'sticker', g.sticker, 'created_at', g.created_at,
      'author', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar_id', p.avatar_id),
      'can_delete', g.author = viewer or g.home_owner = viewer) order by g.created_at desc)
    from (select * from public.guestbook where home_owner = owner and deleted_at is null order by created_at desc limit 100) g
    join public.profiles p on p.id = g.author), '[]'::jsonb);
end $$;

create or replace function public.delete_guestbook(actor uuid, entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(actor);
  update public.guestbook set deleted_at = now() where id = entry and deleted_at is null and (author = actor or home_owner = actor);
  if not found then perform private.fail('forbidden', '지울 수 없는 글이에요.'); end if;
end $$;

create or replace function public.list_mail(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  return coalesce((select jsonb_agg(to_jsonb(n) - 'recipient_profile_id' order by n.created_at desc)
    from (select * from public.notifications where recipient_profile_id = p order by created_at desc limit 50) n), '[]'::jsonb);
end $$;

create or replace function public.mark_mail_read(p uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  update public.notifications set read_at = now() where recipient_profile_id = p and read_at is null;
end $$;

-- ---------- 실행 권한: 로그인 사용자만, private 함수는 직접 호출 불가 ----------
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
-- 자동 생성: npm run gen:catalog (src/data/catalog.ts가 원본)
insert into public.item_catalog (id,kind,name_ko,price,surface,fw,fh,blocking,spaces,supports,unlock_step,sort) values
('cloud_bed','furniture','구름 침대',60,'floor',3,2,true,array['room']::text[],array[]::text[],3,0),
('cloud_cushion','furniture','구름 쿠션',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,1),
('display_pedestal','furniture','보물 받침대',60,'floor',1,1,true,array['room','garden']::text[],array['artifact']::text[],0,2),
('garden_trellis','furniture','꽃 아치',60,'floor',3,1,true,array['garden']::text[],array[]::text[],5,3),
('laurel_bench','furniture','월계수 벤치',60,'floor',1,3,true,array['room','garden']::text[],array[]::text[],0,4),
('laurel_door','furniture','월계수 문',60,'wallRight',2,1,false,array['room']::text[],array[]::text[],0,5),
('laurel_rug','furniture','월계수 러그',60,'rug',3,2,false,array['room']::text[],array[]::text[],0,6),
('linen_curtain','furniture','리넨 커튼',60,'wallRight',2,1,false,array['room']::text[],array[]::text[],3,7),
('music_stand','furniture','악보대',60,'floor',1,1,true,array['room','garden']::text[],array[]::text[],2,8),
('olive_planter','furniture','올리브 화분',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,9),
('owl_mailbox','furniture','올빼미 우편함',60,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,10),
('picture_frame','furniture','신화 액자',20,'supportSlot',1,1,false,array['room']::text[],array[]::text[],7,11),
('round_stool','furniture','둥근 의자',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,12),
('scroll_bookcase','furniture','두루마리 책장',60,'floor',2,1,true,array['room']::text[],array[]::text[],4,13),
('shell_fountain','furniture','조개 분수',60,'floor',3,3,true,array['garden']::text[],array[]::text[],8,14),
('star_lantern','furniture','별빛 등불',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,15),
('star_mobile','furniture','별 모빌',60,'floor',1,1,true,array['room']::text[],array[]::text[],8,16),
('stepping_stones','furniture','정원 디딤돌',20,'floor',3,1,true,array['garden']::text[],array[]::text[],0,17),
('tea_table','furniture','찻상',60,'floor',2,2,true,array['room','garden']::text[],array['picture_frame']::text[],0,18),
('treasure_chest','furniture','보물 상자',60,'floor',2,1,true,array['room','garden']::text[],array[]::text[],0,19),
('lyre','treasure','작은 리라',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],3,20),
('psyche_lamp','treasure','프시케의 등불',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],6,21),
('cornucopia','treasure','풍요의 뿔',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],6,22),
('olive_tree','treasure','아테나의 올리브 나무',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],6,23),
('wind_bag','treasure','바람 자루',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],9,24),
('golden_fleece','treasure','황금 양털',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],9,25),
('mirror_shield','treasure','거울 방패',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],9,26),
('ariadne_thread','treasure','아리아드네의 실타래',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],10,27),
('ariadne_crown','treasure','아리아드네의 왕관',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],11,28),
('pandora_jar','treasure','판도라의 항아리',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],11,29)
on conflict (id) do update set kind=excluded.kind,name_ko=excluded.name_ko,price=excluded.price,surface=excluded.surface,fw=excluded.fw,fh=excluded.fh,
  blocking=excluded.blocking,spaces=excluded.spaces,supports=excluded.supports,unlock_step=excluded.unlock_step,sort=excluded.sort;

insert into public.journey_steps (step,title,reward) values
(1,'첫 별빛','{"choice":true}'::jsonb),
(2,'아폴론의 노래','{"unlock":["guide:apollo"]}'::jsonb),
(3,'리라 선물','{"items":{"lyre":1}}'::jsonb),
(4,'첫 이야기','{"unlock":["chapter:1"]}'::jsonb),
(5,'아르테미스의 정원','{"unlock":["guide:artemis"]}'::jsonb),
(6,'보물 진열실','{}'::jsonb),
(7,'그림 액자','{"unlock":["chapter:4"],"items":{"picture_frame":1}}'::jsonb),
(8,'반짝이는 물','{}'::jsonb),
(9,'영웅의 보물','{}'::jsonb),
(10,'미궁의 실','{"unlock":["chapter:9"]}'::jsonb),
(11,'별의 왕관','{}'::jsonb),
(12,'올림포스 정원사','{"unlock":["badge:gardener"],"items":{"star_mobile":1}}'::jsonb)
on conflict (step) do update set title=excluded.title,reward=excluded.reward;

insert into public.reward_rules (size,difficulty,amount) values
(4,'intro',10),
(6,'intro',20),
(9,'easy',30),
(9,'medium',40),
(9,'hard',50)
on conflict (size,difficulty) do update set amount=excluded.amount;

insert into public.scene_catalog (file,chapter) values
('assets/scenes/c01-00.webp',1),
('assets/scenes/c01-01.webp',1),
('assets/scenes/c01-03.webp',1),
('assets/scenes/c01-02.webp',1),
('assets/scenes/c04-00.webp',4),
('assets/scenes/c04-01.webp',4),
('assets/scenes/c04-02.webp',4),
('assets/scenes/c04-03.webp',4),
('assets/scenes/c04-04.webp',4),
('assets/scenes/c04-05.webp',4),
('assets/scenes/c09-00.webp',9),
('assets/scenes/c09-01.webp',9),
('assets/scenes/c09-02.webp',9),
('assets/scenes/c09-03.webp',9),
('assets/scenes/c09-04.webp',9),
('assets/scenes/c09-05.webp',9),
('assets/scenes/c09-06.webp',9)
on conflict (file) do update set chapter=excluded.chapter;
-- 자동 생성: npm run gen:puzzles (유일해·논리 풀이 검증 완료 252문제)
insert into public.puzzle_catalog (id,size,difficulty,givens,techniques,version) values
('p4-001',4,'intro','1..24......43..1','{"nakedSingle":10}'::jsonb,1),
('p4-002',4,'intro','24..13....42..31','{"nakedSingle":8}'::jsonb,1),
('p4-003',4,'intro','3..1.4....3.2..4','{"nakedSingle":10}'::jsonb,1),
('p4-004',4,'intro','24....4..3....31','{"nakedSingle":10}'::jsonb,1),
('p4-005',4,'intro','23.1...33...1.32','{"nakedSingle":8}'::jsonb,1),
('p4-006',4,'intro','..3232....4343..','{"nakedSingle":8}'::jsonb,1),
('p4-007',4,'intro','.31..1....3..42.','{"nakedSingle":10}'::jsonb,1),
('p4-008',4,'intro','13....1..4....42','{"nakedSingle":10}'::jsonb,1),
('p4-009',4,'intro','12..3......4..21','{"nakedSingle":10}'::jsonb,1),
('p4-010',4,'intro','...113....233...','{"nakedSingle":10}'::jsonb,1),
('p4-011',4,'intro','.2.4..3..3..1.2.','{"nakedSingle":10}'::jsonb,1),
('p4-012',4,'intro','3..14..22..31..4','{"nakedSingle":8}'::jsonb,1),
('p4-013',4,'intro','..41..3242..31..','{"nakedSingle":8}'::jsonb,1),
('p4-014',4,'intro','..43..2114..32..','{"nakedSingle":8}'::jsonb,1),
('p4-015',4,'intro','..3.31....42.4..','{"nakedSingle":10}'::jsonb,1),
('p4-016',4,'intro','34..12....21..43','{"nakedSingle":8}'::jsonb,1),
('p4-017',4,'intro','..2.4.1..1.2.4..','{"nakedSingle":10}'::jsonb,1),
('p4-018',4,'intro','4.1...4224...1.4','{"nakedSingle":8}'::jsonb,1),
('p4-019',4,'intro','2.1.4......1.4.3','{"nakedSingle":10}'::jsonb,1),
('p4-020',4,'intro','..21..4..1..34..','{"nakedSingle":10}'::jsonb,1),
('p4-021',4,'intro','.2.44......32.4.','{"nakedSingle":10}'::jsonb,1),
('p4-022',4,'intro','2...1.2442.3...2','{"nakedSingle":8}'::jsonb,1),
('p4-023',4,'intro','..41..3223..41..','{"nakedSingle":8}'::jsonb,1),
('p4-024',4,'intro','...2.34..12.4...','{"nakedSingle":10}'::jsonb,1),
('p6-001',6,'intro','1...2..62.155..1....1..265.24..1...6','{"nakedSingle":20}'::jsonb,1),
('p6-002',6,'intro','1...6.54....3.4......2.3....12.6...4','{"nakedSingle":24}'::jsonb,1),
('p6-003',6,'intro','6..254.....6...1.54.1...1.....562..1','{"nakedSingle":22}'::jsonb,1),
('p6-004',6,'intro','....6....4.32.1.5663.1.41.3....2....','{"nakedSingle":22}'::jsonb,1),
('p6-005',6,'intro','.4126...54.......41.......35...5634.','{"nakedSingle":22}'::jsonb,1),
('p6-006',6,'intro','6.......4..1436.5..5.6341..5.......6','{"nakedSingle":22}'::jsonb,1),
('p6-007',6,'intro','62...4.43.6..5........2..6.24.2...36','{"nakedSingle":22}'::jsonb,1),
('p6-008',6,'intro','..2......62..562.42.435..61......5..','{"nakedSingle":22}'::jsonb,1),
('p6-009',6,'intro','4......136..6.4..15..4.3..214......6','{"nakedSingle":22}'::jsonb,1),
('p6-010',6,'intro','4.3.2..2......6.1214.6......5..5.3.4','{"nakedSingle":22}'::jsonb,1),
('p6-011',6,'intro','..251...1..2...256625...2..4...561..','{"nakedSingle":20}'::jsonb,1),
('p6-012',6,'intro','.5136..63..2..5......6..3..25..2643.','{"nakedSingle":20}'::jsonb,1),
('p6-013',6,'intro','.56..124.5.3...3....3...1.2.354..61.','{"nakedSingle":20}'::jsonb,1),
('p6-014',6,'intro','.2.413..1.....415..126.....5..256.4.','{"nakedSingle":20}'::jsonb,1),
('p6-015',6,'intro','3...5.5..4.3....2..1....4.5..1.3...5','{"nakedSingle":24}'::jsonb,1),
('p6-016',6,'intro','4...2..5...1..5.6..4.3..5...3..3...2','{"nakedSingle":24}'::jsonb,1),
('p6-017',6,'intro','32.1..1..52..4........6..16..5..3.12','{"nakedSingle":22}'::jsonb,1),
('p6-018',6,'intro','.....6.4.5...12..43..26...5.2.2.....','{"nakedSingle":24}'::jsonb,1),
('p6-019',6,'intro','13.2...6...3.51......16.4...3...5.41','{"nakedSingle":22}'::jsonb,1),
('p6-020',6,'intro','.1324..5..311..........452..6..6451.','{"nakedSingle":20}'::jsonb,1),
('p6-021',6,'intro','..5..6.2....3..51..41..2....6.4..1..','{"nakedSingle":24}'::jsonb,1),
('p6-022',6,'intro','.5...4.4.6...12......21...1.3.3...6.','{"nakedSingle":24}'::jsonb,1),
('p6-023',6,'intro','46.5.....6......2332......3.....4.56','{"nakedSingle":24}'::jsonb,1),
('p6-024',6,'intro','.3...2.1...3....6116....4...2.3...5.','{"nakedSingle":24}'::jsonb,1),
('p6-025',6,'intro','1..4...25.3.6...4..5...1.3.62...6..5','{"nakedSingle":22}'::jsonb,1),
('p6-026',6,'intro','2.4..6..3...4..56..62..3...6..3..2.5','{"nakedSingle":22}'::jsonb,1),
('p6-027',6,'intro','...32..2...14..5....6..42...6..61...','{"hiddenSingle":2,"nakedSingle":22}'::jsonb,1),
('p6-028',6,'intro','...1633....4.54......54.5....1412...','{"nakedSingle":22}'::jsonb,1),
('p6-029',6,'intro','....34.....115.26..63.156.....43....','{"nakedSingle":22}'::jsonb,1),
('p6-030',6,'intro','...23.53..6...16.32.31...1..42.24...','{"nakedSingle":20}'::jsonb,1),
('p6-031',6,'intro','.6.31..14...65........56...54..42.3.','{"nakedSingle":22}'::jsonb,1),
('p6-032',6,'intro','..6..4.....3..23.66.14..4.....1..5..','{"nakedSingle":24}'::jsonb,1),
('p6-033',6,'intro','.4.6....3...4.2..31..2.4...3....6.5.','{"nakedSingle":24}'::jsonb,1),
('p6-034',6,'intro','.2.3.1..5...4635....1463...1..1.6.4.','{"nakedSingle":20}'::jsonb,1),
('p6-035',6,'intro','.36.1...5....123....412....6...2.45.','{"nakedSingle":22}'::jsonb,1),
('p6-036',6,'intro','6.....5..4.121........161.4..2.....5','{"nakedSingle":21,"hiddenSingle":3}'::jsonb,1),
('p6-037',6,'intro','..3....2..45..2.3463.1..24..6....4..','{"nakedSingle":22}'::jsonb,1),
('p6-038',6,'intro','....64...21...634..436...54...13....','{"nakedSingle":22}'::jsonb,1),
('p6-039',6,'intro','6..5...3...1...4.32.3...4...1...1..2','{"nakedSingle":24}'::jsonb,1),
('p6-040',6,'intro','25...1...2......3543......6...5...13','{"hiddenSingle":1,"nakedSingle":23}'::jsonb,1),
('p6-041',6,'intro','.1.5..2.6.......4646.......1.3..2.5.','{"nakedSingle":24}'::jsonb,1),
('p6-042',6,'intro','32.6.1.15......1....2......31.5.1.46','{"nakedSingle":22}'::jsonb,1),
('p6-043',6,'intro','..5.642.....5..1....1..5.....215.4..','{"nakedSingle":24}'::jsonb,1),
('p6-044',6,'intro','.2....1.4..3.6.5.22.5.4.5..2.4....3.','{"nakedSingle":22}'::jsonb,1),
('p6-045',6,'intro','...41.6......42.5..6.32......3.23...','{"nakedSingle":24}'::jsonb,1),
('p6-046',6,'intro','4..5.1.5.4.22..........35.4.2.1.6..5','{"nakedSingle":22}'::jsonb,1),
('p6-047',6,'intro','.....2..36.54..35..56..41.25..5.....','{"nakedSingle":22}'::jsonb,1),
('p6-048',6,'intro','5....662..43....3..5....46..123....4','{"nakedSingle":22}'::jsonb,1),
('p9e-001',9,'easy','.5....94.2495..73......3125.6.82..9....3.4....1..65.8.7962......21..9873.35....6.','{"nakedSingle":44,"hiddenSingle":1}'::jsonb,1),
('p9e-002',9,'easy','...25196.1....37.5...976.188..4....1.4.5.7.3.5....2..478.165...2.47....6.95324...','{"nakedSingle":43}'::jsonb,1),
('p9e-003',9,'easy','5...6....2..37...9973.2165.83.....6.12..3..98.6.....31.9245.8163...16..5....9...7','{"nakedSingle":44}'::jsonb,1),
('p9e-004',9,'easy','...7.4.5..65.1.7497..5.93.....4...81..72.19..18...3.....31.8..5892.4.61..1.6.7...','{"nakedSingle":45}'::jsonb,1),
('p9e-005',9,'easy','......1..6.493.72...371..491.5..9..4.6.....8.8..6..9.735..948...41.635.2..6......','{"nakedSingle":47}'::jsonb,1),
('p9e-006',9,'easy','45....93...18.4.....6359.21.....13.42.......58.35.....92.6481.....1.27...34....86','{"nakedSingle":47}'::jsonb,1),
('p9e-007',9,'easy','1....7.5...54..67..6..9...24.9261.3..12...79..3.8792.46...8..2..47..21...5.7....9','{"nakedSingle":45}'::jsonb,1),
('p9e-008',9,'easy','...567.9.1.64..3.597.1.2.6.5...78.2...8...7...3.62...8.8.2.5.166.2..34.7.5.796...','{"nakedSingle":43}'::jsonb,1),
('p9e-009',9,'easy','..3.9.....19...8.28.51.....35.82.49.98..7..31.71.39.58.....51.41.4...32.....1.7..','{"nakedSingle":46}'::jsonb,1),
('p9e-010',9,'easy','1.57.6.4346852...1....4...8..125.9.....3.4.....4.685..8...1....2...3518951.8.94.2','{"nakedSingle":43}'::jsonb,1),
('p9e-011',9,'easy','3185..2...6.3..8.1..7.9....832..74...9.....5...16..987....4.7..5.9..3.6...4..9523','{"nakedSingle":47}'::jsonb,1),
('p9e-012',9,'easy','.92.4....4.....7....7.5..4257.214.832.1.3.9.763.597.1438..2.4....4.....9....7.32.','{"nakedSingle":37,"hiddenSingle":7}'::jsonb,1),
('p9e-013',9,'easy','..3.251.8.2..38.46...1.4..2.....73.983..1..646.13.....7..2.3...31.49..8.9.587.6..','{"nakedSingle":44}'::jsonb,1),
('p9e-014',9,'easy','.8415......98.3...1.3..957....9.58.15.13.62.99.84.2....425..9.7...7.46......9845.','{"nakedSingle":43}'::jsonb,1),
('p9e-015',9,'easy','..7.6..5151.4.9.83.8..1...67..1.24.....795.....13.6..21...5..3.35.9.1.2427..3.1..','{"nakedSingle":44}'::jsonb,1),
('p9e-016',9,'easy','7.3..2.98825.7...49..6..7.2297..3....8.....5....7..8234.8..5..65...6.48967.8..2.5','{"nakedSingle":38,"hiddenSingle":5}'::jsonb,1),
('p9e-017',9,'easy','9278..4.13.4.9....6..1...7....5.879..713.968..496.2....3...6..7....5.8.61.6..7945','{"nakedSingle":43}'::jsonb,1),
('p9e-018',9,'easy','6.2..9.5.5.48..91..71..6.8.2..93.8.....6.4.....8.72..9.1.2..74..59..31.2.2.1..3.8','{"nakedSingle":45}'::jsonb,1),
('p9e-019',9,'easy','.843..6..1....65.276.945..3........16.3...9.88........3..591.744.57....9..8..321.','{"nakedSingle":47}'::jsonb,1),
('p9e-020',9,'easy','..2..5.4.8.6...2751.7..8...4.5291...38.....29...8537.4...3..4.7763...8.2.9.5..6..','{"nakedSingle":45}'::jsonb,1),
('p9e-021',9,'easy','85....1...1...76..3.6.9...2...25478..23.7.51..87361...6...1.8.7..87...2...5....61','{"nakedSingle":39,"hiddenSingle":7}'::jsonb,1),
('p9e-022',9,'easy','2..9..1.5..45.7..8.75..3.69.1.8549......6......2179.8.53.4..61.9..7.13..4.1..5..7','{"nakedSingle":44}'::jsonb,1),
('p9e-023',9,'easy','....786.45.6.4.379.7..6...2.....781.64.....25.219.....3...9..4.754.1.2.81.278....','{"nakedSingle":45}'::jsonb,1),
('p9e-024',9,'easy','96.2....5.375...185.8..34..745.2.1.............1.4.697..21..8.615...824.8....2.71','{"nakedSingle":45}'::jsonb,1),
('p9e-025',9,'easy','5.6.37.42...692.58.....5..3..8.....47.51.82.99.....5..3..5.....25.379...61.28.3.5','{"nakedSingle":45}'::jsonb,1),
('p9e-026',9,'easy','7..2.....23...58..5...3.76..1.3.8297.2.....4.4739.1.5..67.1...9..46...23.....3..6','{"nakedSingle":45,"hiddenSingle":2}'::jsonb,1),
('p9e-027',9,'easy','..8..965.3....54..9..4..3...2978..63..79218..18..6327...1..2..6..51....4.436..9..','{"nakedSingle":44}'::jsonb,1),
('p9e-028',9,'easy','96.52.......13...22...784.183..651..1...8...6..634..593.425...86...93.......16.37','{"nakedSingle":44}'::jsonb,1),
('p9e-029',9,'easy','7..52389.5..74..6..3.6..7.2....1.9...4.....2...3.7....6.5..2.7..7..86..9.84157..6','{"nakedSingle":47}'::jsonb,1),
('p9e-030',9,'easy','.19...5...5..286..8...7139.9.5.3......68.91......4.9.3.4138...9..761..3...3...74.','{"nakedSingle":47}'::jsonb,1),
('p9e-031',9,'easy','1..63.9.27..18.4....6..4.7.6..89.....7.4.2.3.....76..9.6.7..3....7.48..65.8.69..4','{"nakedSingle":47}'::jsonb,1),
('p9e-032',9,'easy','6..27..3..9.8.154.1...54.7.359..7.6...6...7...1.3..295.7.98...4.625.3.8..3..12..9','{"nakedSingle":43}'::jsonb,1),
('p9e-033',9,'easy','63....9...2.81.36.8...3.42....6..7.34..5.8..91.9..3....82.4...6.16.82.7...5....98','{"nakedSingle":47}'::jsonb,1),
('p9e-034',9,'easy','856..471..796....8.2..8.9..3..4.8..2.8.....6.6..5.1..7..4.1..7.7....984..987..231','{"nakedSingle":45}'::jsonb,1),
('p9e-035',9,'easy','.....7....9648.5717...6.8.4..59..36.8..1.6..5.37..49..4.8.2...9971.4562....6.....','{"nakedSingle":45}'::jsonb,1),
('p9e-036',9,'easy','.2.4.1.731....98...49...5....26.5..7.76...15.4..9.26....8...31...45....963.1.8.4.','{"nakedSingle":47}'::jsonb,1),
('p9e-037',9,'easy','2.7.489....96...5.358..167..1..26..5...4.9...6..78..9..869..147.9...72....186.5.9','{"nakedSingle":43}'::jsonb,1),
('p9e-038',9,'easy','6..34.7828....7...4..86.5..1.5.23..9...5.4...3..17.4.5..3.19..8...2....6928.36..7','{"nakedSingle":45}'::jsonb,1),
('p9e-039',9,'easy','9..34..82.4.7....1632..5..4...53.1.93.8...6.55.7.29...7..9..2431....4.5.45..73..6','{"nakedSingle":43}'::jsonb,1),
('p9e-040',9,'easy','.3...7.5.7..9.63...421...9.4817529.6.........9.6314827.9...857...85.3..4.6.4...8.','{"nakedSingle":43}'::jsonb,1),
('p9e-041',9,'easy','.7.6.58..3467.8.....9...1.6..39.168..5.....3..918.72..7.4...3.....2.3768..81.6.9.','{"nakedSingle":45}'::jsonb,1),
('p9e-042',9,'easy','4..6..9189.153.7.....9.1...3..4..2..87.196.35..4..3..1...8.5.....5.491.2138..7..9','{"nakedSingle":44}'::jsonb,1),
('p9e-043',9,'easy','..49..3....1.....6...461.987.68.29.51..749..29.23.64.762.137...5.....7....3..81..','{"nakedSingle":44}'::jsonb,1),
('p9e-044',9,'easy','..91.7.4..74.286.3......9.57..5.48.92.8.7.4.14.58.2..69.6......3.728.16..2.6.53..','{"nakedSingle":42}'::jsonb,1),
('p9e-045',9,'easy','6879.2.5139..7.........697.4..7532.....4.8.....6219..7.681.........2..9597.8.5416','{"nakedSingle":43}'::jsonb,1),
('p9e-046',9,'easy','...6....77.423..6596..8..4.....6..8..7189365..5..7.....2..1..9381..542.65....6...','{"nakedSingle":46}'::jsonb,1),
('p9e-047',9,'easy','4.86.5.7....487.6..9......8..58.379.37..4..82.827.14..2......1..5.138....6.2.49.7','{"nakedSingle":44}'::jsonb,1),
('p9e-048',9,'easy','........5.732984...9.513.27..1..4982.........8459..6..13.829.5...916723.7........','{"nakedSingle":45}'::jsonb,1),
('p9e-049',9,'easy','...5.14.8.682.7.9.5..8932...25..6.4.7.......2.9.1..78...7318..4.3.6.495.6.19.2...','{"nakedSingle":43}'::jsonb,1),
('p9e-050',9,'easy','.4852....5..7..8.2.2....5.7.8.1.4.79.97...15.31.9.5.8.2.3....6.1.4..3..5....5631.','{"nakedSingle":45}'::jsonb,1),
('p9e-051',9,'easy','3....8...8265...17.94.3.68....78392...7...1...63251....79.1.86.61...5734...8....1','{"nakedSingle":43}'::jsonb,1),
('p9e-052',9,'easy','.....7...63....5..8.49.5.7..7982.631.6..1..9.318.7945..8.7.19.5..6....13...3.....','{"nakedSingle":44,"hiddenSingle":2}'::jsonb,1),
('p9e-053',9,'easy','..4629..76..4.59...29..85...572.......65.48.......315...18..23...39.1..84..3627..','{"nakedSingle":45}'::jsonb,1),
('p9e-054',9,'easy','.....84.731.6.7.2...7..56..5..7.12.66.2...1.91.39.2..8..94..5...6.1.9.827.15.....','{"nakedSingle":45}'::jsonb,1),
('p9e-055',9,'easy','1.725...8.9.1.36...36..7.52.1..7.2....98.17....8.2..1.26.7..53...35.2.6.7...398.1','{"nakedSingle":43}'::jsonb,1),
('p9e-056',9,'easy','..29...65..7.81..939.56...84...53..6...6.7...7..49...18...49.526..72.8..25...69..','{"nakedSingle":45}'::jsonb,1),
('p9e-057',9,'easy','..5729.6...4513.....268..5.8...7.51..29...87..51.9...2.4..576.....3617...6.2489..','{"nakedSingle":43}'::jsonb,1),
('p9e-058',9,'easy','.26.931........7...435..69.1.74..25..52...98..89..54.3.15..682...8........427.51.','{"nakedSingle":45}'::jsonb,1),
('p9e-059',9,'easy','7...2915...6.3.....1..78..4.693...41.7..1..6.35...672.5..89..1.....6.4...4815...9','{"nakedSingle":46}'::jsonb,1),
('p9e-060',9,'easy','.314.5..62.6..359..5..6..37...3....84.76891.33....1...59..3..1..725..3.98..9.467.','{"nakedSingle":42}'::jsonb,1),
('p9m-001',9,'medium','....69....96...7..57.......1...7..534.71.86.986..9...4.......41..1...38....51....','{"nakedSingle":47,"hiddenSingle":6,"pointing":2}'::jsonb,1),
('p9m-002',9,'medium','.6.42...5.746.....2.........4.7..86..2..5..3..81..3.7.........8.....921.1...78.4.','{"hiddenSingle":6,"pointing":1,"claiming":4,"nakedPair":1,"nakedSingle":48}'::jsonb,1),
('p9m-003',9,'medium','..5.......26........47..83..13.9..7....145....6..2.91..59..64........39.......1..','{"nakedSingle":52,"hiddenSingle":4,"pointing":1,"nakedPair":1}'::jsonb,1),
('p9m-004',9,'medium','..385...4.843.....1...4...9...43.9....1.9.5....2.65...3...7...2.....349.5...147..','{"nakedSingle":46,"hiddenSingle":6,"pointing":2}'::jsonb,1),
('p9m-005',9,'medium','4..1...........1627....8..4...71..35.4.8.6.2.52..94...6..5....8258...........9..7','{"nakedSingle":48,"hiddenSingle":5,"pointing":4}'::jsonb,1),
('p9m-006',9,'medium','2.5.69.3...18....4....4.61.......46....7.3....29.......72.8....9....21...8.97.2.3','{"nakedSingle":42,"hiddenSingle":11,"pointing":5,"claiming":1,"nakedPair":1}'::jsonb,1),
('p9m-007',9,'medium','...3.47.8........5.7..5.93...56.....68.7.3.24.....56...21.4..6.3........9.68.2...','{"nakedSingle":44,"hiddenSingle":9,"pointing":1,"claiming":1,"nakedPair":1}'::jsonb,1),
('p9m-008',9,'medium','.1....8....3..5941..64.12....7..9..3....7....1..3..4....28.73..3749..1....1....2.','{"hiddenSingle":18,"pointing":2,"nakedSingle":34}'::jsonb,1),
('p9m-009',9,'medium','4..9......8..1....5193.2..413.........8.4.6.........792..5.9743....3..2......4..5','{"nakedSingle":44,"hiddenSingle":10,"pointing":1}'::jsonb,1),
('p9m-010',9,'medium','47.8.....3.9.6......132....9......71..5.4.6..74......2....931......5.7.6.....2.89','{"nakedSingle":35,"hiddenSingle":19,"pointing":2}'::jsonb,1),
('p9m-011',9,'medium','2...17....3.25.9...783.....8.....7....19.32....5.....1.....264...2.65.7....79...3','{"nakedSingle":36,"hiddenSingle":17,"pointing":5}'::jsonb,1),
('p9m-012',9,'medium','6.31..4..429.7.6......2.....7....324.........234....6.....3......2.9.751..8..29.3','{"nakedSingle":34,"hiddenSingle":19,"pointing":2}'::jsonb,1),
('p9m-013',9,'medium','8.3..6......7.....2..8..947...4.7.6.9.4.1.3.2.5.3.2...438..9..6.....4......2..4.5','{"nakedSingle":39,"hiddenSingle":13,"pointing":4,"nakedPair":1}'::jsonb,1),
('p9m-014',9,'medium','8593..7...........1.79.5....7....3..93.8.7.41..1....8....7.89.4...........4..1675','{"nakedSingle":39,"hiddenSingle":14,"pointing":2,"claiming":2}'::jsonb,1),
('p9m-015',9,'medium','.....8...2.8.4...7.63.2.4......75..6.5.493.7.1..86......5.8.23.4...3.6.1...2.....','{"nakedSingle":42,"hiddenSingle":10,"pointing":3,"nakedPair":1}'::jsonb,1),
('p9m-016',9,'medium','........9...3.47.87......61.13..6...87.....56...4..17.48......23.21.8...5........','{"nakedSingle":41,"hiddenSingle":14,"pointing":2}'::jsonb,1),
('p9m-017',9,'medium','..8..2.696..8....5...9...2..6.....4.2.9.7.6.3.8.....7..1...3...8....7..493.4..1..','{"hiddenSingle":12,"pointing":4,"claiming":1,"hiddenPair":1,"nakedSingle":42}'::jsonb,1),
('p9m-018',9,'medium','.49....8...8..5.73...86....5..137.......2.......658..1....86...15.7..4...8....29.','{"nakedSingle":47,"hiddenSingle":7,"pointing":3,"hiddenPair":1}'::jsonb,1),
('p9m-019',9,'medium','.61.5.79.....9..6.........55..1..4..3..762..9..7..9..68.........7..1.....43.7.98.','{"hiddenSingle":7,"pointing":5,"hiddenPair":1,"nakedSingle":47}'::jsonb,1),
('p9m-020',9,'medium','......7..8..9...3.4....51.6.....628.7..3.9..4.418.....9.56....2.8...2..9..6......','{"nakedSingle":48,"hiddenSingle":7,"pointing":3,"claiming":1}'::jsonb,1),
('p9m-021',9,'medium','3.....97.......2.59..6258...3.4.2..8.........8..3.7.4...3854..71.4.......78.....9','{"nakedSingle":43,"hiddenSingle":10,"pointing":2,"nakedPair":1}'::jsonb,1),
('p9m-022',9,'medium','..68..75...5....6..2.54...1.....427..1..2..9..529.....2...35.4..6....9...31..95..','{"hiddenSingle":8,"pointing":1,"nakedSingle":44}'::jsonb,1),
('p9m-023',9,'medium','4.56......86.1.75............2.719.6.3..2..4.6.185.3............69.8.13......36.8','{"nakedSingle":46,"hiddenSingle":6,"pointing":1,"hiddenPair":1}'::jsonb,1),
('p9m-024',9,'medium','..1.....9.....27.3.23..684..74.3.......478.......1.48..378..95.6.53.....9.....1..','{"nakedSingle":41,"hiddenSingle":11,"pointing":2}'::jsonb,1),
('p9m-025',9,'medium','....759...78.....24..3...7.7.5....1.86.....94.1....8.5.8...2..91.....35...679....','{"hiddenSingle":11,"pointing":3,"nakedSingle":42}'::jsonb,1),
('p9m-026',9,'medium','....72..3..3..19..1.5.8...7.4.......3.82.47.6.......9.7...1.5.4..98..3..5..43....','{"hiddenSingle":16,"nakedSingle":37,"pointing":1}'::jsonb,1),
('p9m-027',9,'medium','.35....4..27.5....8....7...9.67........582........18.7...3....9....6.27..9....16.','{"hiddenSingle":13,"pointing":4,"nakedSingle":43}'::jsonb,1),
('p9m-028',9,'medium','.3....9.55....3.7.1..9..3267..........38251..........9341..7..2.5.3....46.2....5.','{"nakedSingle":45,"hiddenSingle":7,"pointing":3}'::jsonb,1),
('p9m-029',9,'medium','7..1...4...12.63...4.3.91...18...6.............7...53...37.5.1...26.48...9...3..5','{"nakedSingle":47,"hiddenSingle":6,"pointing":2,"claiming":1,"nakedPair":2}'::jsonb,1),
('p9m-030',9,'medium','.....4.8.94....3.7..83....9..4.52.1...7.1.8...6.89.7..8....91..7.9....65.3.5.....','{"nakedSingle":42,"hiddenSingle":10,"pointing":1}'::jsonb,1),
('p9m-031',9,'medium','....8....4.9..2.6....15.47.6......9...23.67...5......1.81.65....7.9..5.4....7....','{"nakedSingle":44,"hiddenSingle":11,"pointing":2}'::jsonb,1),
('p9m-032',9,'medium','..4..5.8..2.3.....19...46..852......6...7...1......456..17...49.....9.1..7.4..2..','{"hiddenSingle":16,"nakedSingle":38,"pointing":1,"claiming":1,"nakedPair":1}'::jsonb,1),
('p9m-033',9,'medium','893......7..3.5..8.5....9.....67..3...95.32...4..12.....4....6.5..2.1..4......871','{"nakedSingle":42,"hiddenSingle":11,"pointing":3,"nakedPair":2}'::jsonb,1),
('p9m-034',9,'medium','.7..5.94..........46.1....2.85..3..9...5.2...3..8..15.9....5.78..........47.2..3.','{"nakedSingle":44,"hiddenSingle":11,"pointing":1}'::jsonb,1),
('p9m-035',9,'medium','..31.69.5...2...3....7....2.....75.1..2...8..9.13.....3....2....4...5...8.56.41..','{"nakedSingle":41,"hiddenSingle":14,"pointing":1,"claiming":1}'::jsonb,1),
('p9m-036',9,'medium','.8..521.....7..5...9.4...8..1..7.6..5...8...7..8.6..3..7...6.2...2..3.....392..5.','{"nakedSingle":34,"hiddenSingle":20,"pointing":1}'::jsonb,1),
('p9m-037',9,'medium','..2..74.....3..61.1.9.....7..37.9..49..1.4..54..6.29..7.....2.8.24..3.....12..7..','{"hiddenSingle":17,"nakedSingle":34,"pointing":5}'::jsonb,1),
('p9m-038',9,'medium','.8.....7....34...9..9685..2....6.2...53.2.81...4.1....2..8597..8...36....9.....2.','{"nakedSingle":42,"hiddenSingle":10,"pointing":2,"claiming":1}'::jsonb,1),
('p9m-039',9,'medium','.32.8.7.......3...7..2.9..52.6.......1.....9.......3.18..6.1..9...4.......5.2.86.','{"nakedSingle":44,"hiddenSingle":13,"pointing":5,"nakedPair":2}'::jsonb,1),
('p9m-040',9,'medium','.8.4..3..1.98....76.35....1..1.......5..3..1.......5..7....61.99....46.2..2..9.4.','{"hiddenSingle":13,"nakedSingle":41,"pointing":2}'::jsonb,1),
('p9m-041',9,'medium','........1..3879...5..1.2.38...3...97.5.....8.67...8...76.4.5..9...2831..2........','{"nakedSingle":37,"hiddenSingle":16,"pointing":2}'::jsonb,1),
('p9m-042',9,'medium','..72.63...1...7...9.....75....5...24..27.85..65...3....35.....2...3...8...89.21..','{"hiddenSingle":14,"pointing":2,"nakedSingle":39}'::jsonb,1),
('p9m-043',9,'medium','.42.3.97..8.......5....4.1...39...6....372....1...58...9.4....1.......2..21.8.64.','{"nakedSingle":50,"hiddenSingle":4,"pointing":1,"nakedPair":1,"hiddenPair":2,"claiming":1}'::jsonb,1),
('p9m-044',9,'medium','51...7.3....5.9..6.2......1..61..3..3...4...2..1..37..8......6.9..3.6....6.2...49','{"hiddenSingle":23,"nakedSingle":31,"pointing":1}'::jsonb,1),
('p9m-045',9,'medium','.89.3...6.1.4.62......97.....3...4.1.7.....6.6.8...3.....64......48.9.5.2...5.18.','{"nakedSingle":44,"hiddenSingle":9,"pointing":1}'::jsonb,1),
('p9m-046',9,'medium','.1....5.2..73...9.4.5....6....45....56.....17....78....4....2.5.9...23..6.2....7.','{"nakedSingle":43,"hiddenSingle":12,"pointing":1}'::jsonb,1),
('p9m-047',9,'medium','6.94...8.....82...3.2.......98576...1.......9...89176.......5.8...32.....1...92.7','{"nakedSingle":41,"hiddenSingle":12,"pointing":1}'::jsonb,1),
('p9m-048',9,'medium','.....813.5321.....1...4.....65.....3.2..3..9.9.....64.....8...4.....9726.965.....','{"nakedSingle":40,"hiddenSingle":14,"nakedPair":1}'::jsonb,1),
('p9m-049',9,'medium','9...4512....2..6....6.....9....8794..3..6..7..6912....2.....7....7..8....9173...4','{"hiddenSingle":18,"nakedSingle":34,"hiddenPair":1}'::jsonb,1),
('p9m-050',9,'medium','8.1..5....69..3..4....8..3.......67.5.36.91.8.76.......8..3....3..8..71....2..4.3','{"hiddenSingle":18,"nakedSingle":35,"pointing":3}'::jsonb,1),
('p9m-051',9,'medium','5.79..1.6.....8....9.146..7.8.4.......2.9.4.......2.9.4..237.5....6.....7.9..42.8','{"nakedSingle":46,"hiddenSingle":6,"pointing":2,"nakedPair":2}'::jsonb,1),
('p9m-052',9,'medium','..6958..7..5.....2..4..69...8...17.....7.5.....76...8...85..1..9.....3..7..8436..','{"nakedSingle":45,"hiddenSingle":8,"pointing":1}'::jsonb,1),
('p9m-053',9,'medium','43.1.....2..35.4.9..........26..5..8..8.2.9..5..4..67..........9.5.61..4.....3.65','{"hiddenSingle":14,"nakedSingle":40,"pointing":2,"claiming":2,"nakedPair":1}'::jsonb,1),
('p9m-054',9,'medium','.1.2...8...5.3..4...2..6.....7..2.1..5.397.2..2.4..3.....9..4...3..1.9...6...4.7.','{"hiddenSingle":16,"pointing":1,"nakedSingle":38}'::jsonb,1),
('p9m-055',9,'medium','84..9..6.57.......6..15..89.6..7..1....4.2....8..6..2.72..49..8.......94.9..2..37','{"nakedSingle":44,"hiddenSingle":7,"claiming":1,"nakedPair":1}'::jsonb,1),
('p9m-056',9,'medium','..5....39....8.7.....3.7...6.2.9..4..7.6.4.9..9..7.1.8...1.3.....7.2....83....2..','{"hiddenSingle":16,"nakedSingle":39,"pointing":3,"claiming":1,"nakedPair":1}'::jsonb,1),
('p9m-057',9,'medium','9.8......3..5...87.6...4...7.58.36.............19.78.5...4...7.82...1..9......3.4','{"nakedSingle":37,"hiddenSingle":18,"pointing":1}'::jsonb,1),
('p9m-058',9,'medium','9.4.5.1..58.1...7.3....8......836.....7...9.....972......7....4.2...9.65..9.8.7.1','{"hiddenSingle":9,"nakedSingle":44,"pointing":2,"nakedPair":1}'::jsonb,1),
('p9m-059',9,'medium','8.9....2..6........3.6..4....6.28.177..9.4..892.71.6....1..6.4........9..4....5.2','{"nakedSingle":49,"hiddenSingle":4,"claiming":1,"nakedPair":2}'::jsonb,1),
('p9m-060',9,'medium','.6297.3.......3...7..61..4..48...6...5.....7...6...41..8..64..7...5.......4.2713.','{"nakedSingle":42,"hiddenSingle":11,"pointing":4}'::jsonb,1),
('p9h-001',9,'hard','..3.5..2.2....1....1.6...57...4..7..6.5...1.8..9..3...46...8.1....5....6.3..4.8..','{"hiddenSingle":14,"pointing":6,"claiming":2,"nakedPair":1,"xWing":1,"nakedTriple":1,"nakedSingle":41}'::jsonb,1),
('p9h-002',9,'hard','3.1.2.....98......2....9..66..1...87....5....58...2..98..3....2......87.....7.9.4','{"nakedSingle":45,"hiddenSingle":11,"pointing":2,"hiddenPair":1,"nakedPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-003',9,'hard','.812.....4....93.....16.....2...39.6..3...5..1.78...3.....28.....24....9.....145.','{"nakedSingle":37,"hiddenSingle":18,"pointing":6,"claiming":1,"nakedPair":1,"hiddenPair":2,"xWing":1}'::jsonb,1),
('p9h-004',9,'hard','.6....1.....7.9.5.....81..6.71...3....32.78....9...52.7..65.....4.8.3.....6....4.','{"nakedSingle":47,"hiddenSingle":8,"pointing":2,"nakedPair":2,"hiddenPair":2,"xWing":1}'::jsonb,1),
('p9h-005',9,'hard','..97.2.......3.7.9.5.1.6.8..9.6.....6.......3.....8.7..6.5.7.9.4.7.1.......8.31..','{"nakedSingle":49,"hiddenSingle":6,"claiming":3,"hiddenPair":2,"xWing":1}'::jsonb,1),
('p9h-006',9,'hard','56....91..8...94..........8..5.3...18...4...53...7.8..1..........62...8..43....57','{"hiddenSingle":11,"pointing":5,"hiddenTriple":1,"nakedSingle":45}'::jsonb,1),
('p9h-007',9,'hard','.1......9..96..5..3..2.14..2.6..7...9.......3...5..7.2..31.4..5..4..98..5......4.','{"hiddenSingle":16,"nakedSingle":39,"pointing":1,"xWing":1,"nakedPair":1}'::jsonb,1),
('p9h-008',9,'hard','.....3.2.96..2.1...4......931..5.69...........26.1..384......1...2.8..57.7.1.....','{"hiddenSingle":12,"nakedSingle":43,"pointing":4,"hiddenPair":1,"hiddenTriple":1,"xWing":1}'::jsonb,1),
('p9h-009',9,'hard','.....6.2..26..9.75...2..6...9.5....6..2.8.4..6....4.5...9..3...35.7..84..4.9.....','{"nakedSingle":39,"hiddenSingle":15,"pointing":2,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-010',9,'hard','1..3...9......15..3.2.....6..71.6..58...5...95..4.98..6.....3.8..17......7...8..1','{"nakedSingle":43,"hiddenSingle":11,"xWing":1}'::jsonb,1),
('p9h-011',9,'hard','.59...8.7...5...9...1...3..73..8.......6.9.......5..68..4...9...1...6...8.5...72.','{"nakedSingle":49,"hiddenSingle":8,"pointing":2,"claiming":1,"nakedTriple":1}'::jsonb,1),
('p9h-012',9,'hard','..5........316...24..3..6..6..58....35.....97....19..5..7..5..42...915........1..','{"hiddenSingle":19,"nakedSingle":36,"pointing":2,"xWing":1}'::jsonb,1),
('p9h-013',9,'hard','...2.5..8....73..2..9....5...15....67.6...2.52....68...9....4..6..31....4..9.2...','{"hiddenSingle":14,"pointing":3,"hiddenPair":1,"nakedTriple":1,"nakedSingle":41}'::jsonb,1),
('p9h-014',9,'hard','.3.7.2.6...139....24............5.47....6....78.9............19....243...2.8.9.5.','{"hiddenSingle":14,"pointing":9,"nakedSingle":42,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-015',9,'hard','..8.1....6..5.....7329..5..92....6.....3.4.....4....13..5..8162.....2..8....9.4..','{"nakedSingle":44,"hiddenSingle":11,"pointing":4,"claiming":2,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-016',9,'hard','8.9....3.2....5....5.1..4......2.8.4...9.8...6.8.3......7..3.5....7....3.1....9.2','{"hiddenSingle":20,"nakedSingle":37,"pointing":1,"xWing":1}'::jsonb,1),
('p9h-017',9,'hard','7....8.34...5..1...2...3..8......691...3.7...498......6..2...1...7..6...81.7....3','{"hiddenSingle":11,"nakedSingle":44,"pointing":3,"claiming":2,"nakedPair":1,"hiddenPair":3,"nakedTriple":1}'::jsonb,1),
('p9h-018',9,'hard','...75...4..5.6..1.1..9...8.......13..61...54..39.......1...4..2.7..2.8..8...93...','{"nakedSingle":43,"hiddenSingle":12,"pointing":4,"nakedPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-019',9,'hard','...32.1.......6.324...5.8.9..1....2.....3.....5....7..3.4.6...829.5.......6.87...','{"nakedSingle":46,"hiddenSingle":10,"nakedTriple":1,"pointing":1,"hiddenPair":1,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-020',9,'hard','...34...8..6.97....8.2...6.4.......7..37298..8.......5.7...8.4....67.9..6...32...','{"nakedSingle":44,"hiddenSingle":10,"pointing":5,"xWing":1}'::jsonb,1),
('p9h-021',9,'hard','......358.6.1..9...2......4..692...3...5.1...1...375..7......9...3..4.2.214......','{"nakedSingle":45,"hiddenSingle":10,"pointing":3,"claiming":1,"nakedPair":3,"nakedTriple":1}'::jsonb,1),
('p9h-022',9,'hard','...8...52....9.8.....2.6...76......42.1.4.6.59......23...9.4.....5.7....32...8...','{"hiddenSingle":9,"nakedSingle":47,"pointing":4,"hiddenPair":1,"xWing":1}'::jsonb,1),
('p9h-023',9,'hard','.2...9.....3..7.6.91.5.8...4....2..8.9.....4.2..1....7...8.3.25.6.7..9.....2...7.','{"nakedSingle":49,"hiddenSingle":6,"pointing":5,"nakedPair":1,"hiddenPair":1,"claiming":1,"xWing":1}'::jsonb,1),
('p9h-024',9,'hard','1.....5....84...31...7...9.....25....82...75....68.....1...9...59...64....4.....8','{"nakedSingle":44,"hiddenSingle":13,"pointing":4,"claiming":1,"nakedTriple":1}'::jsonb,1),
('p9h-025',9,'hard','6...19.3...5..8...9.....4.7....83..5..9...6..2..75....1.3.....6...6..8...4.59...2','{"nakedSingle":37,"hiddenSingle":18,"pointing":4,"nakedTriple":1}'::jsonb,1),
('p9h-026',9,'hard','........5.5.9.2..7.8....94.....461..8..7.5..2..638.....91....3.4..1.8.2.7........','{"nakedSingle":39,"hiddenSingle":16,"pointing":1,"hiddenTriple":1}'::jsonb,1),
('p9h-027',9,'hard','......4..16.3...7...7.....37..5.1.8.95..7..31.8.4.6..22.....1...3...8.27..8......','{"nakedSingle":50,"hiddenSingle":4,"hiddenPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-028',9,'hard','.1...8...5.9..7.8.7..61.....98.....31...4...53.....12.....95..6.5.8..4.7...3...5.','{"hiddenSingle":16,"pointing":1,"xWing":1,"nakedSingle":38}'::jsonb,1),
('p9h-029',9,'hard','.3..7............7.726.8..9.413.9...6.......5...8.136.3..2.574.4............8..2.','{"hiddenSingle":14,"nakedSingle":41,"pointing":4,"claiming":1,"nakedTriple":1}'::jsonb,1),
('p9h-030',9,'hard','..89.5....9..6..3...648.2..82.........3.1.6.........53..1.384...8..9..6....6.79..','{"hiddenSingle":21,"pointing":4,"claiming":1,"xWing":1,"nakedPair":1,"nakedSingle":33}'::jsonb,1),
('p9h-031',9,'hard','1.4..8.3..7.9.....29..6......52...67.........71...98......2..74.....4.8..4.5..3.1','{"nakedSingle":46,"hiddenSingle":9,"pointing":3,"claiming":1,"nakedTriple":1,"xWing":1}'::jsonb,1),
('p9h-032',9,'hard','...36......69...5..49..1.......4.9.74.......21.8.7.......1..48..6...51......32...','{"nakedSingle":46,"hiddenSingle":11,"pointing":4,"hiddenTriple":1}'::jsonb,1),
('p9h-033',9,'hard','..9.3.6....8..5.4.6....9.7.1......2...7...4...2......3.1.9....2.5.2..8....2.6.9..','{"hiddenSingle":13,"nakedSingle":44,"pointing":2,"nakedTriple":1,"xWing":1,"nakedPair":1}'::jsonb,1),
('p9h-034',9,'hard','.....52.72...3..1..4....6....198.....68.5.97.....471....4....6..2..1...83.57.....','{"nakedSingle":44,"hiddenSingle":10,"pointing":3,"claiming":1,"nakedTriple":1}'::jsonb,1),
('p9h-035',9,'hard','..87....46......12..4.2...5.3...6..7..9...5..4..8...3.7...9.1..54......93....78..','{"nakedSingle":39,"hiddenSingle":16,"pointing":2,"nakedPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-036',9,'hard','..........5.4...79..3..9..532.6.15......9......18.3.671..7..2..76...8.3..........','{"hiddenSingle":6,"nakedSingle":50,"pointing":4,"hiddenPair":2,"claiming":2,"nakedPair":2,"nakedTriple":2}'::jsonb,1),
('p9h-037',9,'hard','..8.79..4.....36......2..53.3.....96..2...5..98.....7.57..4......43.....6..78.1..','{"nakedSingle":44,"hiddenSingle":11,"pointing":2,"nakedPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-038',9,'hard','.782..49......8..1....94........3.14..2...8..71.6........35....8..4......43..627.','{"hiddenSingle":17,"nakedSingle":38,"pointing":2,"hiddenPair":1,"xWing":1}'::jsonb,1),
('p9h-039',9,'hard','.........9.64.8....3....729.9..7...8..15.93..5...6..9.412....3....3.28.4.........','{"hiddenSingle":15,"nakedSingle":40,"pointing":3,"claiming":1,"nakedTriple":1}'::jsonb,1),
('p9h-040',9,'hard','3.8..5..1...8.173............7..2..5.9..6..1.6..9..3............632.9...2..3..8.6','{"hiddenSingle":24,"pointing":2,"claiming":1,"hiddenPair":1,"xWing":1,"nakedSingle":32}'::jsonb,1),
('p9h-041',9,'hard','35........1..7...3..7...8...9.36...4..4.8.2..7...42.1...2...3..8...1..9........76','{"hiddenSingle":17,"nakedSingle":39,"pointing":1,"claiming":1,"xWing":1}'::jsonb,1),
('p9h-042',9,'hard','..4...53.26....4.7.....8....523...6.1...6...3.3...125....2.....6.5....98.78...3..','{"hiddenSingle":11,"pointing":2,"claiming":1,"nakedPair":1,"hiddenTriple":1,"nakedTriple":1,"nakedSingle":43}'::jsonb,1),
('p9h-043',9,'hard','.1.2..5.8.2..9...3..4..6.....8..2....7.....3....5..1.....8..3..3...4..5.1.7..9.2.','{"hiddenSingle":8,"pointing":2,"hiddenPair":1,"xWing":1,"nakedSingle":49}'::jsonb,1),
('p9h-044',9,'hard','.1.9......3..4..698....7..4.8..2...3...7.4...5...6..2.9..6....826..7..5......1.7.','{"nakedSingle":45,"hiddenSingle":10,"pointing":1,"claiming":1,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-045',9,'hard','...1..7...7.8..4..9...5.6.......1.344.8...2.953.9.......1.2...5..9..6.8...5..3...','{"hiddenSingle":19,"nakedSingle":36,"pointing":4,"xWing":1}'::jsonb,1),
('p9h-046',9,'hard','5....7.3...2...4..3..41.9...3.97..6.....5.....7..26.9...9.31..5..4...1...8.7....9','{"nakedSingle":38,"hiddenSingle":16,"claiming":1,"xWing":1}'::jsonb,1),
('p9h-047',9,'hard','.51..27.........182.....59.7...4......46258......8...4.96.....747.........87..16.','{"hiddenSingle":14,"pointing":5,"claiming":3,"nakedTriple":1,"hiddenPair":1,"nakedPair":1,"nakedSingle":40}'::jsonb,1),
('p9h-048',9,'hard','....21.9......38.5.1.8..4..8......3...5...1...9......7..1..6.5.4.39......6.73....','{"hiddenSingle":20,"nakedSingle":37,"pointing":2,"xWing":1}'::jsonb,1),
('p9h-049',9,'hard','..239....4..2.8.6...8..6.1........73..5...8..24........9.8..2...8.6.3..7....456..','{"hiddenSingle":17,"nakedSingle":38,"pointing":5,"claiming":1,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-050',9,'hard','..34...8...5.6...76..79.1.........13..7...8..25.........9.82..15...7.9...4...56..','{"nakedSingle":42,"hiddenSingle":13,"pointing":4,"nakedPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-051',9,'hard','.....4.....6.5298.7.....6.1..7.....5..48.37..9.....8..6.9.....8.4219.5.....2.....','{"hiddenSingle":15,"nakedSingle":40,"pointing":4,"nakedPair":1,"nakedTriple":1}'::jsonb,1),
('p9h-052',9,'hard','.4..5.1..8.........16.4...3.2..8...5.3.5.1.6.5...9..7.2...1.79.........2..4.3..8.','{"nakedSingle":43,"hiddenSingle":12,"pointing":3,"claiming":3,"nakedPair":1,"xWing":1}'::jsonb,1),
('p9h-053',9,'hard','6.......1...425.6....3..8....28.6.9...5...4...6.1.97....8..7....7.534...1.......3','{"nakedSingle":48,"hiddenSingle":7,"pointing":1,"claiming":1,"nakedPair":2,"xWing":1}'::jsonb,1),
('p9h-054',9,'hard','..7..8...6...1....41..6.....6.8..51...29547...74..6.2.....8..56....9...7...7..8..','{"nakedSingle":42,"hiddenSingle":12,"pointing":1,"nakedPair":1,"hiddenPair":2,"xWing":1}'::jsonb,1),
('p9h-055',9,'hard','47.3.....513.2..4..6..........61.3...5..7..1...6.42..........5..9..3.671.....7.39','{"hiddenSingle":15,"pointing":1,"claiming":2,"hiddenPair":1,"nakedTriple":1,"nakedSingle":39}'::jsonb,1),
('p9h-056',9,'hard','.....6.....6.92...89.41.5.6......3.5..9.2.1..4.8......2.3.64.89...87.4.....2.....','{"nakedSingle":34,"hiddenSingle":20,"pointing":2,"xWing":1}'::jsonb,1),
('p9h-057',9,'hard','...93...6.....1.9..7.8..3.2.1....23.....7.....54....1.9.1..3.5..8.2.....3...89...','{"nakedSingle":40,"hiddenSingle":16,"pointing":4,"claiming":1,"xWing":1}'::jsonb,1),
('p9h-058',9,'hard','.68..2....9.3....25...6..1..2...43.8....2....6.51...2..8..9...69....1.7....4..98.','{"hiddenSingle":11,"pointing":1,"hiddenPair":1,"nakedTriple":1,"claiming":3,"nakedSingle":43,"nakedPair":2}'::jsonb,1),
('p9h-059',9,'hard','..5..2..4...4...25.......6...2.3..7.7..254..1.6..7.4...9.......17...8...3..1..7..','{"hiddenSingle":7,"pointing":8,"hiddenPair":2,"nakedTriple":1,"nakedSingle":49}'::jsonb,1),
('p9h-060',9,'hard','.96....3.3...5.7.6.....6.8.8....79..6...2...8..18....2.2.4.....5.8.9...7.6....14.','{"hiddenSingle":14,"nakedSingle":40,"pointing":2,"xWing":1,"nakedPair":1,"hiddenPair":1,"claiming":1}'::jsonb,1)
on conflict (id) do nothing;

insert into private.puzzle_solutions (puzzle_id,solution) values
('p4-001','1342421321343421'),
('p4-002','2413132431424231'),
('p4-003','3241142341322314'),
('p4-004','2413314213244231'),
('p4-005','2341412332141432'),
('p4-006','1432321421434321'),
('p4-007','4312214312343421'),
('p4-008','1324421324313142'),
('p4-009','1243341221344321'),
('p4-010','2431134241233214'),
('p4-011','3214413223411423'),
('p4-012','3241413224131324'),
('p4-013','2341143242133124'),
('p4-014','2143432114323214'),
('p4-015','4231312413422413'),
('p4-016','3412123443212143'),
('p4-017','1324421331422431'),
('p4-018','4213134224313124'),
('p4-019','2314413232411423'),
('p4-020','4321124321343412'),
('p4-021','3214413214232341'),
('p4-022','2431132442133142'),
('p4-023','3241143223144123'),
('p4-024','1432234131244213'),
('p6-001','145623362415526134431562653241214356'),
('p6-002','132465546321324156615243453612261534'),
('p6-003','613254245316326145451623134562562431'),
('p6-004','314265562413241356635124153642426531'),
('p6-005','341265625413562134134652413526256341'),
('p6-006','613425524361436152251634162543345216'),
('p6-007','621354543162452613136425365241214536'),
('p6-008','632145145623356214214356561432423561'),
('p6-009','456312213654634521521463362145145236'),
('p6-010','413526625143536412142635364251251364'),
('p6-011','362514541632134256625341213465456123'),
('p6-012','251364463512645123132645314256526431'),
('p6-013','356241241563514326623154162435435612'),
('p6-014','625413431265364152512634143526256341'),
('p6-015','341652562413653124214536425361136245'),
('p6-016','461523253641315264642315524136136452'),
('p6-017','325146164523642351531264216435453612'),
('p6-018','523416146532612354354261465123231645'),
('p6-019','134256562413651324243165416532325641'),
('p6-020','613245452631145326236154521463364512'),
('p6-021','135246624351362514541632213465456123'),
('p6-022','156324243651612543435216561432324165'),
('p6-023','462531135642546123321465653214214356'),
('p6-024','634512215643543261162435451326326154'),
('p6-025','163452425136612543354261531624246315'),
('p6-026','214356653421431562562143125634346215'),
('p6-027','614325523641432516156234245163361452'),
('p6-028','245163361254654312123546536421412635'),
('p6-029','521634346521154263263415615342432156'),
('p6-030','146235532461451623263154615342324516'),
('p6-031','265314314265651423423156136542542631'),
('p6-032','316254254163542316631425425631163542'),
('p6-033','241635653142462513135264514326326451'),
('p6-034','624351315624463512251463542136136245'),
('p6-035','236514145263512346364125451632623451'),
('p6-036','641523523461216354435216154632362145'),
('p6-037','453216126345512634634152241563365421'),
('p6-038','321564465213216345543621654132132456'),
('p6-039','612534534261165423243156426315351642'),
('p6-040','254361163254621435435126316542542613'),
('p6-041','314562256431521346463215645123132654'),
('p6-042','324651615423453162162534246315531246'),
('p6-043','315264264351526143431625643512152436'),
('p6-044','326451154623463512215346531264642135'),
('p6-045','235416614532342651561324156243423165'),
('p6-046','462531351462213654645213534126126345'),
('p6-047','615432243615421356356124162543534261'),
('p6-048','534126621543146235253461465312312654'),
('p9e-001','153782946249516738678493125564821397982374651317965482796238514421659873835147269'),
('p9e-002','478251963169843725352976418826439571941587632537612894783165249214798356695324187'),
('p9e-003','518964273246375189973821654837149562125637498469582731792453816384716925651298347'),
('p9e-004','928734156365812749741569328239476581457281963186953274673128495892345617514697832'),
('p9e-005','798426135614935728523718649175389264469572381832641957357294816941863572286157493'),
('p9e-006','452716938391824567786359421675281394219463875843597612927648153568132749134975286'),
('p9e-007','184627953925438671763195482479261835812543796536879214691384527347952168258716349'),
('p9e-008','843567192126489375975132864514378629268954731739621548387245916692813457451796283'),
('p9e-009','743298516619753842825146973356821497982574631471639258297365184164987325538412769'),
('p9e-010','195786243468523791327941658681257934752394816934168527849612375276435189513879462'),
('p9e-011','318576249965324871247891635832957416796418352451632987623145798579283164184769523'),
('p9e-012','892741536453862791167953842579214683241638957638597214386129475724385169915476328'),
('p9e-013','463925178129738546578164932254687319837519264691342857786253491312496785945871623'),
('p9e-014','284157396759863124163249578426975831571386249938412765642531987895724613317698452'),
('p9e-015','427863951516429783983517246735182469642795318891346572169254837358971624274638195'),
('p9e-016','763412598825379164941658732297583641386241957154796823418925376532167489679834215'),
('p9e-017','927863451314795268658124379263518794571349682849672513435986127792451836186237945'),
('p9e-018','682319457534827916971456283265931874793684521148572639316298745859743162427165398'),
('p9e-019','584312697139876542762945183257689431643157928891234756326591874415728369978463215'),
('p9e-020','932675148846139275157428963475291386381746529629853714518362497763914852294587631'),
('p9e-021','854623179219547638376198452961254783423879516587361294632915847148736925795482361'),
('p9e-022','283946175694517238175283469716854923859362741342179586537498612968721354421635897'),
('p9e-023','219378654586142379473569182935427816647831925821956437368295741754613298192784563'),
('p9e-024','964281735237564918518793462745926183689317524321845697472139856153678249896452371'),
('p9e-025','596837142431692758872415963128953674765148239943726581389561427254379816617284395'),
('p9e-026','741286935236795814589134762615348297928567341473921658367412589854679123192853476'),
('p9e-027','418239657376815492952476318529784163637921845184563279791342586265198734843657921'),
('p9e-028','961524783478139562253678491839765124145982376726341859394257618617893245582416937'),
('p9e-029','761523894529748163438691752256314987147869325893275641615932478372486519984157236'),
('p9e-030','719463528354928617862571394975132486436859172128746953541387269297614835683295741'),
('p9e-031','145637982792185463386924571651893247879412635423576819264751398937248156518369724'),
('p9e-032','645279831297831546183654972359127468826495713714368295571986324962543187438712659'),
('p9e-033','637254981524819367891736425258691743473528619169473852782945136916382574345167298'),
('p9e-034','856924713179653428423187956317468592985372164642591387234815679761239845598746231'),
('p9e-035','584317296396482571712569834145978362829136745637254918468723159971845623253691487'),
('p9e-036','825461973163759824749823561382615497976384152451972638598247316214536789637198245'),
('p9e-037','267548913149673852358291674914326785875419326632785491586932147493157268721864539'),
('p9e-038','659341782832957614471862593145623879287594361396178425563719248714285936928436157'),
('p9e-039','971346582845792361632185794264538179398417625517629438786951243123864957459273816'),
('p9e-040','839247651715986342642135798481752936327869415956314827194628573278593164563471289'),
('p9e-041','172695843346718529589324176423951687857462931691837254764589312915243768238176495'),
('p9e-042','453672918981534726627981354316458297872196435594723861249815673765349182138267549'),
('p9e-043','264985371891273546357461298746812935135749682982356417629137854518694723473528169'),
('p9e-044','639157248574928613182463975763514829298376451415892736946731582357289164821645397'),
('p9e-045','687942351394571682251386974419753268725468139836219547568194723143627895972835416'),
('p9e-046','135649827784231965962587341349165782271893654658472139426718593813954276597326418'),
('p9e-047','428695371513487269697312548145823796376549182982761453234976815759138624861254937'),
('p9e-048','218476395573298416694513827361754982927681543845932671136829754459167238782345169'),
('p9e-049','279561438368247195514893267125786349786439512493125786957318624832674951641952873'),
('p9e-050','748529631536741892921368547685134279497682153312975486253417968164893725879256314'),
('p9e-051','351678249826549317794132685145783926287496153963251478579314862618925734432867591'),
('p9e-052','195467328637182549824935176579824631462513897318679452283741965946258713751396284'),
('p9e-053','514629387638475921729138564157286493396514872842793156961847235273951648485362719'),
('p9e-054','256318497314697825987245613598731246672854139143962758839426571465179382721583964'),
('p9e-055','147256398592183674836497152615974283329861745478325916261748539983512467754639821'),
('p9e-056','182974365567381429394562178418253796935617284726498531873149652649725813251836947'),
('p9e-057','315729468684513297972684153836472519429135876751896342243957681598361724167248935'),
('p9e-058','826793145591864732743512698137489256452637981689125473915346827278951364364278519'),
('p9e-059','783429156426531897915678234269387541874215963351946728537894612192763485648152379'),
('p9e-060','731495286246873591958162437165347928427689153389251764594736812672518349813924675'),
('p9m-001','214769538396845712578231496129476853437158629865392174752683941641927385983514267'),
('p9m-002','369421785874695321215387496543712869927856134681943572792134658438569217156278943'),
('p9m-003','735481269826953741194762835413698572972145683568327914359816427281574396647239158'),
('p9m-004','673859214984321675125647839756438921431792568892165347348976152217583496569214783'),
('p9m-005','492165873835947162761238594986712435143856729527394681679521348258473916314689257'),
('p9m-006','245169738691837524738245619317598462456723891829614375572381946963452187184976253'),
('p9m-007','592364718163987245874251936415628379689713524237495681721549863358176492946832157'),
('p9m-008','419732865723685941856491237247159683638274519195368472562817394374926158981543726'),
('p9m-009','472968531386415297519372864137296458958743612624851379261589743845137926793624185'),
('p9m-010','472815963389764215561329847928536471135247698746981352857693124294158736613472589'),
('p9m-011','259817436134256987678349512893521764461973258725684391987132645312465879546798123'),
('p9m-012','653189472429375618817624539971568324586243197234917865795431286342896751168752943'),
('p9m-013','873946251549721683261853947312487569984615372756392814438579126625134798197268435'),
('p9m-014','859346712463172859127985463278514396936827541541639287612758934795463128384291675'),
('p9m-015','741658923298341567563927418932175846856493172174862395615784239427539681389216754'),
('p9m-016','236817549159364728748925361913756284874231956625489173487593612362178495591642837'),
('p9m-017','158732469692841735374956821763219548249578613581364972415683297826197354937425186'),
('p9m-018','649371582218945673735862914564137829871429356923658741497286135152793468386514297'),
('p9m-019','461358792752491368938627145596183427384762519127549836815936274279814653643275981'),
('p9m-020','159463728862971435437285196593146287728359614641827953915634872384712569276598341'),
('p9m-021','325148976486739215917625834531462798749581623862397541293854167154976382678213459'),
('p9m-022','346812759185397462927546381698154273413728695752963814279635148564281937831479526'),
('p9m-023','425637819386219754917548263542371986738926541691854372873162495269485137154793628'),
('p9m-024','461783529589142763723956841874239615156478392392615487237861954615394278948527136'),
('p9m-025','231875946678149532459326178725984613863251794914637825387512469192468357546793281'),
('p9m-026','694572813873641925125389647946758132318294756257163498732916584469825371581437269'),
('p9m-027','135926748427853916869417352986734521371582694254691837612375489548169273793248165'),
('p9m-028','436271985529683471178954326715439268963825147284716539341567892857392614692148753'),
('p9m-029','739158246851246379246379158918537624325461987467982531683795412572614893194823765'),
('p9m-030','673924581945681327218375649384752916597416832162893754856249173729138465431567298'),
('p9m-031','735684129419732865268159473647518392192346758853297641981465237376921584524873916'),
('p9m-032','764195382528367194193824675852641937649573821317982456281736549436259718975418263'),
('p9m-033','893124756762395148451786923125678439689543217347912685914837562578261394236459871'),
('p9m-034','173258946258649317469137582685413729714592863392876154921365478536784291847921635'),
('p9m-035','723186945164259738589743612638427591472591863951368274316872459247915386895634127'),
('p9m-036','387652194124798563695431782219375648536284917748169235871546329952813476463927851'),
('p9m-037','362517489547398612189426357253789164976134825418652973735961248624873591891245736'),
('p9m-038','385192476162347589479685132918763245653924817724518693231859764847236951596471328'),
('p9m-039','932185746651743982784269135296314578513872694478596321827631459369458217145927863'),
('p9m-040','587491326129863457643572891371945268258637914496128573734256189915784632862319745'),
('p9m-041','827536941413879265596142738182354697359761482674928513768415329945283176231697854'),
('p9m-042','587296341314857269926134758873519624142768593659423817435681972291375486768942135'),
('p9m-043','142836975789251436536794218453918762968372154217645893695427381874163529321589647'),
('p9m-044','519627438438519276627834951786152394395748612241963785872491563954386127163275849'),
('p9m-045','489235716517486293362197548923568471175324869648971325851642937734819652296753184'),
('p9m-046','916784532287365491435921768871456923564239817329178654143697285798512346652843179'),
('p9m-047','679435182541982673382167495498576321167243859235891764926714538754328916813659247'),
('p9m-048','649258137532167489178943562465891273721436895983725641317682954854319726296574318'),
('p9m-049','978645123415293687326871459152387946834569271769124538283416795647958312591732864'),
('p9m-050','831495267769123854245786931918342675523679148476518392184937526352864719697251483'),
('p9m-051','547923186126758943893146527981465372372891465654372891418237659235689714769514238'),
('p9m-052','236958417195374862874216935583421796619785243427639581368592174942167358751843629'),
('p9m-053','439172586287356419651849327726935148148627953593418672362584791975261834814793265'),
('p9m-054','613245789785139246942876135397682514451397628826451397278963451534718962169524873'),
('p9m-055','841793562579286341632154789263978415915432876487561923726349158358617294194825637'),
('p9m-056','785216439346985721219347685652891347178634592493572168924153876567428913831769254'),
('p9m-057','958172436342596187167384952795843621486215793231967845613459278824731569579628314'),
('p9m-058','964357182582194673371628549295836417837541926416972358158763294723419865649285731'),
('p9m-059','879451326564832179132697485456328917713964258928715634291576843685243791347189562'),
('p9m-060','462975381815243796739618542248791653351486279976352418583164927127539864694827135'),
('p9h-001','873954621256371984914682357381465792645729138729813465467298513198537246532146879'),
('p9h-002','361527498498613725275489316629134587714958263583762149847391652936245871152876934'),
('p9h-003','581234697476589321239167845825743916943612578167895234754928163312456789698371452'),
('p9h-004','367425189128769453594381276271598364653247891489136527712654938945873612836912745'),
('p9h-005','149782635286435719753196284392674851678951423514328976861547392437219568925863147'),
('p9h-006','567384912281569473439721568695832741872146395314975826128457639756293184943618257'),
('p9h-007','617845239429673518358291476236987154975412683841536792783124965164359827592768341'),
('p9h-008','751693824963824175248571369314758692897362541526419738485237916132986457679145283'),
('p9h-009','473156928826439175915278634194527386532681497687394251769843512351762849248915763'),
('p9h-010','168345297749621583352897146297186435814253769536479812625914378981732654473568921'),
('p9h-011','359462817487531692621798345736184259548629173192357468274815936913276584865943721'),
('p9h-012','165928743783164952492357618679583421351246897824719365917635284238491576546872139'),
('p9h-013','174295638568473192329861754941528376786139245235746819893657421652314987417982563'),
('p9h-014','839742165571396482246158793613285947952467831784931526468573219195624378327819654'),
('p9h-015','548217396619583274732946581923871645167354829854629713495738162371462958286195437'),
('p9h-016','879462531241395786356187429735621894124978365698534217967243158582719643413856972'),
('p9h-017','756128934983574126124963758375482691261397485498651372649235817537816249812749563'),
('p9h-018','682751394395468217147932685758249136261387549439615728513874962974126853826593471'),
('p9h-019','965328174187496532432751869641879325729635481853214796374162958298543617516987243'),
('p9h-020','759346128216897453384215769421583697563729814897461235972158346135674982648932571'),
('p9h-021','941276358865143972327895614576928143439561287182437569758312496693754821214689735'),
('p9h-022','496817352132495876578236419763529184281743695954681723617954238845372961329168547'),
('p9h-023','724639581583417269916528734431972658697385142258146397179863425862754913345291876'),
('p9h-024','126938574978452631435761892749325186682194753351687249817249365593816427264573918'),
('p9h-025','674219538315478269982365417461983725759124683238756194123847956597632841846591372'),
('p9h-026','937864215154932687682571943375246198849715362216389574591427836463158729728693451'),
('p9h-027','893217465162354879547689213726531984954872631381496752275963148639148527418725396'),
('p9h-028','416538972539427681782619534698152743127943865345786129874295316253861497961374258'),
('p9h-029','835972416964513287172648539541369872683427195297851364316295748428736951759184623'),
('p9h-030','238975146497261538156483297824356719573819624619742853961538472782194365345627981'),
('p9h-031','164758239573912648298463715985231467436875192712649853851326974327194586649587321'),
('p9h-032','751368294386924751249751638625843917473519862198276345532197486967485123814632579'),
('p9h-033','549732681278615349631849275194386527367521498825497163416958732953274816782163954'),
('p9h-034','683195247257634819149872635731986524468251973592347186874529361926413758315768492'),
('p9h-035','218735964653984712974621385835216497169473528427859631786592143541368279392147856'),
('p9h-036','974385612258416379613279845327641598846597123591823467189734256762158934435962781'),
('p9h-037','358679214249513687716428953137254896462897531985136472571942368894361725623785149'),
('p9h-038','378261495459738621126594387685923714932147856714685932267359148891472563543816279'),
('p9h-039','125937486976428153834615729693271548281549367547863291412786935769352814358194672'),
('p9h-040','378495621956821734124637589837142965592763418641958372789516243463289157215374896'),
('p9h-041','359821467418576923627493851291365784564187239783942615172659348836714592945238176'),
('p9h-042','984726531263915487517438926852374169149562873736891254391287645625143798478659312'),
('p9h-043','916273548725498613834156792598312467671984235243567189469825371382741956157639824'),
('p9h-044','415936782732845169896217534687529413123784695549163827971652348264378951358491276'),
('p9h-045','856142793173869452924357618697281534418635279532974861361728945249516387785493126'),
('p9h-046','548697231912583476367412958431978562296354817875126394629831745754269183183745629'),
('p9h-047','851932746943576218267418593785349621314625879629187354196253487472861935538794162'),
('p9h-048','384521796629473815517869423846157239735692184192384567971246358453918672268735941'),
('p9h-049','652391748431278965978456312819562473765134829243789156596817234184623597327945681'),
('p9h-050','793451286415268397682793145964827513137546829258319764379682451526174938841935672'),
('p9h-051','893614257416752983725389641287961435564823719931547862679435128342198576158276394'),
('p9h-052','347859126852163947916247853429786315738521469561394278283615794195478632674932581'),
('p9h-053','654798231381425967927361854712846395895273416463159728538917642276534189149682573'),
('p9h-054','237548691695317482418269375963872514182954763574136928729483156841695237356721849'),
('p9h-055','472398165513726948968451723784615392259873416136942587327169854895234671641587239'),
('p9h-056','145786293376592814892413576617948325539627148428351967253164789961875432784239651'),
('p9h-057','542937186836421795179865342718654239293178564654392817921743658485216973367589421'),
('p9h-058','368512749791348652542967813129754368874623591635189427487295136956831274213476985'),
('p9h-059','985762314617483925423915867842631579739254681561879432298347156176598243354126798'),
('p9h-060','796248531384951726215376489832617954679524318451839672127465893548193267963782145')
on conflict (puzzle_id) do nothing;
-- 쌓기: 바닥 가구가 겹치면 나중에 놓은 것이 위로 올라간다(3층까지). 이미 0001~0005를 실행했다면 이 파일만 실행.
create or replace function private.validate_home(p uuid, home jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  sp text; arr jsonb; el jsonb; c public.item_catalog; pc public.item_catalog; parent jsonb;
  uids text[] := '{}'; counts jsonb := '{}'; i int; j int; a jsonb; b jsonb; ca public.item_catalog; cb public.item_catalog;
  x int; y int; kids text[] := '{}'; levels int[]; lv int; k text; v text; frames text[] := '{}'; all_uids text[] := '{}';
begin
  foreach sp in array array['room', 'garden'] loop
    arr := home->(sp || '_layout');
    if arr is null or jsonb_typeof(arr) <> 'array' then perform private.fail('bad_layout', '배치 형식이 맞지 않아요.'); end if;
    if jsonb_array_length(arr) > 60 then perform private.fail('too_many', '한 공간에는 60개까지 놓을 수 있어요.'); end if;
    for el in select * from jsonb_array_elements(arr) loop
      if jsonb_typeof(el->'uid') <> 'string' or char_length(el->>'uid') not between 1 and 24 or (el->>'uid') = any (all_uids) then
        perform private.fail('bad_layout', '배치 형식이 맞지 않아요.');
      end if;
      all_uids := all_uids || (el->>'uid');
      select * into c from public.item_catalog where id = el->>'item';
      if not found or not (sp = any (c.spaces)) then perform private.fail('bad_place', '여기에 놓을 수 없는 물건이 있어요.'); end if;
      counts := jsonb_set(counts, array[c.id], to_jsonb(coalesce((counts->>c.id)::int, 0) + 1));
      if c.surface in ('floor', 'rug') then
        if jsonb_typeof(el->'x') <> 'number' or jsonb_typeof(el->'y') <> 'number' then perform private.fail('bad_layout', '배치 형식이 맞지 않아요.'); end if;
        x := (el->>'x')::int; y := (el->>'y')::int;
        if x < 0 or y < 0 or x + c.fw > 12 or y + c.fh > 10 then perform private.fail('out_of_bounds', '바닥 밖으로 나간 물건이 있어요.'); end if;
      elsif c.surface = 'wallRight' then
        if jsonb_typeof(el->'x') <> 'number' then perform private.fail('bad_layout', '배치 형식이 맞지 않아요.'); end if;
        x := (el->>'x')::int;
        if x < 0 or x + c.fw > 12 then perform private.fail('out_of_bounds', '벽 밖으로 나간 물건이 있어요.'); end if;
      else
        parent := null;
        select e into parent from jsonb_array_elements(arr) e where e->>'uid' = el->>'parent';
        if parent is null then perform private.fail('no_support', '받침 가구 위에만 놓을 수 있어요.'); end if;
        select * into pc from public.item_catalog where id = parent->>'item';
        if not (c.surface = any (pc.supports) or c.id = any (pc.supports)) then perform private.fail('no_support', '받침 가구 위에만 놓을 수 있어요.'); end if;
        if (el->>'parent') = any (kids) then perform private.fail('slot_taken', '받침 하나에는 하나만 놓을 수 있어요.'); end if;
        kids := kids || (el->>'parent');
      end if;
      if c.id = 'picture_frame' then frames := frames || (el->>'uid'); end if;
    end loop;
    -- 바닥 가구는 겹치면 쌓인다: 배열 순서대로 겹친 앞선 물건 위에 올라가며 3층까지. 벽 장식끼리는 겹칠 수 없다.
    levels := '{}';
    for i in 0 .. jsonb_array_length(arr) - 1 loop
      a := arr->i; select * into ca from public.item_catalog where id = a->>'item';
      lv := 1;
      for j in 0 .. i - 1 loop
        b := arr->j; select * into cb from public.item_catalog where id = b->>'item';
        if ca.surface = 'wallRight' and cb.surface = 'wallRight'
           and (a->>'x')::int < (b->>'x')::int + cb.fw and (b->>'x')::int < (a->>'x')::int + ca.fw then
          perform private.fail('overlap', '겹친 벽 장식이 있어요.');
        end if;
        if ca.surface = 'floor' and cb.surface = 'floor'
           and (a->>'x')::int < (b->>'x')::int + cb.fw and (b->>'x')::int < (a->>'x')::int + ca.fw
           and (a->>'y')::int < (b->>'y')::int + cb.fh and (b->>'y')::int < (a->>'y')::int + ca.fh then
          lv := greatest(lv, levels[j + 1] + 1);
        end if;
      end loop;
      if lv > 3 then perform private.fail('too_high', '3층까지만 쌓을 수 있어요.'); end if;
      levels := levels || lv;
    end loop;
  end loop;
  -- 보유 수량
  for k, v in select key, value from jsonb_each_text(counts) loop
    if v::int > coalesce((select quantity from public.inventory where profile_id = p and item_id = k), 0) then
      perform private.fail('not_owned', '가진 것보다 많이 놓았어요.');
    end if;
  end loop;
  -- 액자 그림: 해금한 장 그림만
  for k, v in select key, value from jsonb_each_text(coalesce(home->'exhibits', '{}'::jsonb)) loop
    if not (k = any (frames)) then perform private.fail('bad_exhibit', '액자가 없는 그림 설정이 있어요.'); end if;
    if not exists (select 1 from public.scene_catalog s join public.unlocks u on u.key = 'chapter:' || s.chapter and u.profile_id = p where s.file = v) then
      perform private.fail('bad_exhibit', '아직 열지 않은 그림이에요.');
    end if;
  end loop;
  -- 숨은 쪽지
  for k, v in select key, value from jsonb_each_text(coalesce(home->'notes', '{}'::jsonb)) loop
    if not (k = any (all_uids)) or char_length(v) > 60 then perform private.fail('bad_note', '쪽지는 60자까지 쓸 수 있어요.'); end if;
  end loop;
  if home->>'music' is not null and (home->>'music') !~ '^[A-Za-z_]{1,40}$' then
    perform private.fail('bad_layout', '음악을 다시 골라 주세요.');
  end if;
  if home->>'featured_uid' is not null and not ((home->>'featured_uid') = any (all_uids)) then
    perform private.fail('bad_layout', '오늘의 전시품을 다시 골라 주세요.');
  end if;
end $$;

revoke all on function private.validate_home(uuid, jsonb) from public, anon;
-- 힌트 규칙: 한 판에 힌트는 10번까지, 한 번 쓸 때마다 완료 보상이 10%씩 줄어든다.
-- 0002의 save_attempt·complete_attempt를 바꾼다(나머지는 그대로).

create or replace function public.save_attempt(attempt uuid, expected_revision int, board text, notes jsonb, hints_used int, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status <> 'active' then perform private.fail('not_active', '이미 끝난 퍼즐이에요.'); end if;
  if a.revision <> expected_revision then
    raise exception using errcode = 'P0001', message = 'conflict', detail = '다른 기기에서 먼저 저장했어요.', hint = 'final:' || a.revision;
  end if;
  select * into pz from public.puzzle_catalog where id = a.puzzle_id;
  perform private.check_board(board, pz.givens, pz.size);
  if pg_column_size(notes) > 8000 then perform private.fail('bad_notes', '메모가 너무 많아요.'); end if;
  update public.puzzle_attempts set board = save_attempt.board, notes = coalesce(save_attempt.notes, '{}'::jsonb),
    hints_used = least(10, greatest(a.hints_used, coalesce(save_attempt.hints_used, 0))),
    revision = a.revision + 1, updated_at = now() where id = attempt;
  return jsonb_build_object('revision', a.revision + 1);
end $$;

create or replace function public.complete_attempt(attempt uuid, board text, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.puzzle_attempts; pz public.puzzle_catalog; sol text; amount int; q public.quest_progress;
  step public.journey_steps; res jsonb; unlocked jsonb := '[]'::jsonb; k text; it record; bal int;
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

  select r.amount into amount from public.reward_rules r where r.size = pz.size and r.difficulty = pz.difficulty;
  -- 힌트 한 번마다 보상 10%씩 줄어듦(10번이면 0)
  amount := amount * (10 - least(a.hints_used, 10)) / 10;
  insert into public.reward_ledger (profile_id, event_key, amount, reason)
    values (a.profile_id, 'complete:' || a.id, amount, 'puzzle:' || pz.id);
  update public.wallets set balance = balance + amount where profile_id = a.profile_id returning balance into bal;
  update public.quest_progress set completed_count = completed_count + 1,
    no_hint_count = no_hint_count + case when a.hints_used = 0 then 1 else 0 end
    where profile_id = a.profile_id returning * into q;

  select * into step from public.journey_steps where journey_steps.step = q.completed_count;
  if found then
    for it in select key, value from jsonb_each_text(coalesce(step.reward->'items', '{}'::jsonb)) loop
      perform private.grant_item(a.profile_id, it.key, it.value::int);
    end loop;
    for k in select jsonb_array_elements_text(coalesce(step.reward->'unlock', '[]'::jsonb)) loop
      insert into public.unlocks (profile_id, key) values (a.profile_id, k) on conflict do nothing;
    end loop;
    if (step.reward->>'choice')::boolean then
      update public.quest_progress set choice_pending = true where profile_id = a.profile_id;
    end if;
    unlocked := jsonb_build_object('step', step.step, 'title', step.title, 'reward', step.reward);
  end if;

  res := jsonb_build_object('reward', amount, 'balance', bal, 'completed_count', q.completed_count,
    'no_hint', a.hints_used = 0, 'hints_used', least(a.hints_used, 10), 'journey', unlocked, 'puzzle_id', pz.id);
  update public.puzzle_attempts set status = 'completed', board = complete_attempt.board, completed_at = now(),
    updated_at = now(), result = res where id = attempt;
  return res;
end $$;
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
-- 자동 생성: npm run gen:portraits (src/data/catalog.ts, public/data/people.json이 원본)
-- 초상화 390장: 티어별 145/132/85/28장
insert into public.portrait_catalog (id,tier,price,name_ko) values
('chaos',4,400,'카오스'),
('gaia',4,400,'가이아'),
('tartarus',4,400,'타르타로스'),
('eros',4,400,'에로스'),
('erebus',4,400,'에레보스'),
('nyx',4,400,'닉스'),
('aether',4,400,'아이테르'),
('hemera',4,400,'헤메라'),
('uranus',4,400,'우라노스'),
('pontus',4,400,'폰토스'),
('ourea',4,400,'오우레아'),
('chronos',4,400,'크로노스(시간)'),
('ananke',4,400,'아낭케'),
('phanes',4,400,'파네스'),
('oceanus',3,150,'오케아노스'),
('tethys',3,150,'테티스(티탄)'),
('hyperion',3,150,'히페리온'),
('theia',3,150,'테이아'),
('coeus',3,150,'코이오스'),
('phoebe',3,150,'포이베'),
('crius',3,150,'크리오스'),
('iapetus',3,150,'이아페토스'),
('mnemosyne',3,150,'므네모시네'),
('themis',3,150,'테미스'),
('cronus',3,150,'크로노스'),
('rhea',3,150,'레아'),
('atlas',3,150,'아틀라스'),
('prometheus',3,150,'프로메테우스'),
('epimetheus',3,150,'에피메테우스'),
('menoetius',3,150,'메노이티오스'),
('leto',3,150,'레토'),
('asteria',3,150,'아스테리아'),
('helios',3,150,'헬리오스'),
('selene',3,150,'셀레네'),
('eos',3,150,'에오스'),
('astraeus',3,150,'아스트라이오스'),
('pallas_titan',3,150,'팔라스(티탄)'),
('perses_titan',3,150,'페르세스(티탄)'),
('metis',3,150,'메티스'),
('dione',3,150,'디오네'),
('zeus',4,400,'제우스'),
('hera',4,400,'헤라'),
('poseidon',4,400,'포세이돈'),
('demeter',4,400,'데메테르'),
('hestia',4,400,'헤스티아'),
('hades',4,400,'하데스'),
('athena',4,400,'아테나'),
('apollo',4,400,'아폴론'),
('artemis',4,400,'아르테미스'),
('ares',4,400,'아레스'),
('aphrodite',4,400,'아프로디테'),
('hephaestus',4,400,'헤파이스토스'),
('hermes',4,400,'헤르메스'),
('dionysus',4,400,'디오니소스'),
('persephone',3,150,'페르세포네'),
('hebe',3,150,'헤베'),
('eileithyia',3,150,'에일레이티이아'),
('harmonia',3,150,'하르모니아'),
('phobos',3,150,'포보스'),
('deimos',3,150,'데이모스'),
('hecate',3,150,'헤카테'),
('iris',3,150,'이리스'),
('nike',3,150,'니케'),
('kratos',3,150,'크라토스'),
('bia',3,150,'비아'),
('zelus',3,150,'젤로스'),
('styx',1,20,'스틱스'),
('thanatos',3,150,'타나토스'),
('hypnos',3,150,'힙노스'),
('morpheus',3,150,'모르페우스'),
('nemesis',3,150,'네메시스'),
('eris',3,150,'에리스'),
('moros',3,150,'모로스'),
('momus',3,150,'모모스'),
('apate',3,150,'아파테'),
('geras',3,150,'게라스'),
('ate',3,150,'아테'),
('clotho',3,150,'클로토'),
('lachesis',3,150,'라케시스'),
('atropos',3,150,'아트로포스'),
('horai',3,150,'호라이'),
('charites',3,150,'카리테스'),
('eurynome',1,20,'에우리노메'),
('calliope',3,150,'칼리오페'),
('clio',3,150,'클레이오'),
('euterpe',3,150,'에우테르페'),
('thalia_muse',3,150,'탈레이아(무사)'),
('melpomene',3,150,'멜포메네'),
('terpsichore',3,150,'테릅시코레'),
('erato',3,150,'에라토'),
('polyhymnia',3,150,'폴림니아'),
('urania',3,150,'우라니아'),
('pan',3,150,'판'),
('asclepius',3,150,'아스클레피오스'),
('hygieia',3,150,'히기에이아'),
('aristaeus',3,150,'아리스타이오스'),
('silenus',3,150,'실레노스'),
('triton',3,150,'트리톤'),
('amphitrite',1,20,'암피트리테'),
('nereus',3,150,'네레우스'),
('proteus',3,150,'프로테우스'),
('thaumas',3,150,'타우마스'),
('phorcys',3,150,'포르키스'),
('ceto',2,60,'케토'),
('eurybia',3,150,'에우리비아'),
('thetis',1,20,'테티스(네레이스)'),
('galatea',1,20,'갈라테이아'),
('psamathe',1,20,'프사마테'),
('doris',1,20,'도리스'),
('clymene',1,20,'클리메네'),
('electra_oc',1,20,'엘렉트라(오케아니스)'),
('callirhoe',1,20,'칼리로에'),
('pleione',1,20,'플레이오네'),
('pleiades',1,20,'플레이아데스'),
('maia',1,20,'마이아'),
('electra_pl',1,20,'엘렉트라(플레이아스)'),
('hesperides',1,20,'헤스페리데스'),
('calypso',1,20,'칼립소'),
('circe',3,150,'키르케'),
('echo',1,20,'에코'),
('daphne',1,20,'다프네'),
('syrinx',1,20,'시링크스'),
('oenone',1,20,'오이노네'),
('cyrene',1,20,'키레네'),
('nephele',1,20,'네펠레'),
('achelous',3,150,'아켈로오스'),
('scamander',3,150,'스카만드로스'),
('inachus',3,150,'이나코스'),
('asopus',3,150,'아소포스'),
('alpheus',3,150,'알페이오스'),
('charon',3,150,'카론'),
('lethe',3,150,'레테'),
('boreas',3,150,'보레아스'),
('zephyrus',3,150,'제피로스'),
('notus',3,150,'노토스'),
('eurus',3,150,'에우로스'),
('graiai',2,60,'그라이아이'),
('typhon',2,60,'티폰'),
('echidna',2,60,'에키드나'),
('cerberus',2,60,'케르베로스'),
('orthrus',2,60,'오르트로스'),
('hydra',2,60,'히드라'),
('chimera',2,60,'키마이라'),
('sphinx',2,60,'스핑크스'),
('nemean_lion',2,60,'네메아의 사자'),
('ladon',2,60,'라돈'),
('caucasian_eagle',2,60,'카우카소스의 독수리'),
('crommyon_sow',2,60,'크롬미온의 암퇘지'),
('colchian_dragon',2,60,'콜키스의 용'),
('minotaur',2,60,'미노타우로스'),
('polyphemus',2,60,'폴리페모스'),
('scylla',2,60,'스킬라'),
('charybdis',2,60,'카리브디스'),
('medusa',2,60,'메두사'),
('stheno',2,60,'스테노'),
('euryale',2,60,'에우리알레'),
('pegasus',2,60,'페가소스'),
('chrysaor',2,60,'크리사오르'),
('geryon',2,60,'게리온'),
('cacus',2,60,'카쿠스'),
('python',2,60,'피톤'),
('talos',2,60,'탈로스'),
('argus',2,60,'아르고스 판옵테스'),
('stymphalian_birds',2,60,'스팀팔로스의 새'),
('cretan_bull',2,60,'크레타의 황소'),
('erymanthian_boar',2,60,'에리만토스의 멧돼지'),
('ceryneian_hind',2,60,'케리네이아의 암사슴'),
('mares_of_diomedes',2,60,'디오메데스의 암말'),
('calydonian_boar',2,60,'칼리돈의 멧돼지'),
('teumessian_fox',2,60,'테우메소스의 여우'),
('laelaps',2,60,'라이라프스'),
('cetus',2,60,'케토스'),
('chiron',2,60,'케이론'),
('pholus',2,60,'폴로스'),
('nessus',2,60,'네소스'),
('centaurs',2,60,'켄타우로스족'),
('harpies',2,60,'하르피이아이'),
('seirenes',2,60,'세이레네스'),
('gigantes',2,60,'기간테스'),
('alcyoneus',2,60,'알키오네우스'),
('porphyrion',2,60,'포르피리온'),
('enceladus',2,60,'엔켈라도스'),
('mimas',2,60,'미마스'),
('polybotes',2,60,'폴리보테스'),
('antaeus',2,60,'안타이오스'),
('tityos',2,60,'티티오스'),
('otus',2,60,'오토스'),
('ephialtes_aload',2,60,'에피알테스(알로아다이)'),
('brontes',2,60,'브론테스'),
('steropes',2,60,'스테로페스'),
('arges',2,60,'아르게스'),
('cottus',2,60,'코토스'),
('briareus',2,60,'브리아레오스'),
('gyges',2,60,'기게스'),
('alecto',2,60,'알렉토'),
('tisiphone',2,60,'티시포네'),
('megaera',2,60,'메가이라'),
('lamia',2,60,'라미아'),
('marsyas',2,60,'마르시아스'),
('procrustes',1,20,'프로크루스테스'),
('sinis',1,20,'시니스'),
('sciron',1,20,'스키론'),
('danae',1,20,'다나에'),
('acrisius',1,20,'아크리시오스'),
('perseus',2,60,'페르세우스'),
('andromeda',1,20,'안드로메다'),
('cepheus',1,20,'케페우스'),
('cassiopeia',1,20,'카시오페이아'),
('polydectes',1,20,'폴리덱테스'),
('electryon',1,20,'엘렉트리온'),
('alcaeus',1,20,'알카이오스'),
('sthenelus',1,20,'스테넬로스'),
('amphitryon',1,20,'암피트리온'),
('alcmene',1,20,'알크메네'),
('heracles',2,60,'헤라클레스'),
('iphicles',1,20,'이피클레스'),
('iolaus',2,60,'이올라오스'),
('eurystheus',1,20,'에우리스테우스'),
('megara',1,20,'메가라'),
('deianira',1,20,'데이아네이라'),
('hyllus',2,60,'힐로스'),
('omphale',1,20,'옴팔레'),
('hippolyta',2,60,'히폴리테'),
('telephus',2,60,'텔레포스'),
('iole',1,20,'이올레'),
('augeas',1,20,'아우게이아스'),
('deucalion',2,60,'데우칼리온'),
('pyrrha',1,20,'피라'),
('pandora',1,20,'판도라'),
('hellen',1,20,'헬렌'),
('aeolus',1,20,'아이올로스'),
('sisyphus',1,20,'시시포스'),
('salmoneus',1,20,'살모네우스'),
('tyro',1,20,'티로'),
('athamas',1,20,'아타마스'),
('ino',1,20,'이노'),
('phrixus',1,20,'프릭소스'),
('helle',1,20,'헬레'),
('bellerophon',2,60,'벨레로폰'),
('glaucus_cor',1,20,'글라우코스(코린토스)'),
('neleus',1,20,'넬레우스'),
('pelias',1,20,'펠리아스'),
('aeson',1,20,'아이손'),
('jason',2,60,'이아손'),
('medea',1,20,'메데이아'),
('aeetes',1,20,'아이에테스'),
('absyrtus',1,20,'압시르토스'),
('nestor',2,60,'네스토르'),
('admetus',1,20,'아드메토스'),
('alcestis',1,20,'알케스티스'),
('melampus',1,20,'멜람푸스'),
('amphiaraus',2,60,'암피아라오스'),
('adrastus',2,60,'아드라스토스'),
('eriphyle',1,20,'에리필레'),
('alcmaeon',2,60,'알크마이온'),
('orpheus',2,60,'오르페우스'),
('eurydice',1,20,'에우리디케'),
('castor',2,60,'카스토르'),
('pollux',2,60,'폴리데우케스'),
('idas',2,60,'이다스'),
('lynceus',2,60,'린케우스'),
('zetes',2,60,'제테스'),
('calais',2,60,'칼라이스'),
('peleus',2,60,'펠레우스'),
('telamon',2,60,'텔라몬'),
('meleager',2,60,'멜레아그로스'),
('althaea',1,20,'알타이아'),
('oeneus',1,20,'오이네우스'),
('atalanta',2,60,'아탈란테'),
('hippomenes',1,20,'히포메네스'),
('hylas',1,20,'힐라스'),
('phineus',1,20,'피네우스'),
('amycus',1,20,'아미코스'),
('europa',1,20,'에우로페'),
('agenor',1,20,'아게노르'),
('minos',2,60,'미노스'),
('rhadamanthys',2,60,'라다만티스'),
('aeacus',2,60,'아이아코스'),
('aegina',1,20,'아이기나'),
('pasiphae',1,20,'파시파에'),
('ariadne',1,20,'아리아드네'),
('phaedra',1,20,'파이드라'),
('daedalus',1,20,'다이달로스'),
('icarus',1,20,'이카로스'),
('aegeus',1,20,'아이게우스'),
('aethra',1,20,'아이트라'),
('theseus',2,60,'테세우스'),
('hippolytus',1,20,'히폴리토스'),
('pirithous',2,60,'페이리토오스'),
('cadmus',2,60,'카드모스'),
('semele',1,20,'세멜레'),
('agave',1,20,'아가우에'),
('autonoe',1,20,'아우토노에'),
('actaeon',1,20,'악타이온'),
('pentheus',1,20,'펜테우스'),
('laius',1,20,'라이오스'),
('jocasta',1,20,'이오카스테'),
('oedipus',2,60,'오이디푸스'),
('eteocles',1,20,'에테오클레스'),
('polynices',2,60,'폴리네이케스'),
('antigone',1,20,'안티고네'),
('ismene',1,20,'이스메네'),
('creon',1,20,'크레온'),
('tiresias',1,20,'테이레시아스'),
('tydeus',2,60,'티데우스'),
('capaneus',2,60,'카파네우스'),
('parthenopaeus',2,60,'파르테노파이오스'),
('diomedes',2,60,'디오메데스'),
('diomedes_thrace',1,20,'디오메데스(트라키아 왕)'),
('tantalus',1,20,'탄탈로스'),
('pelops',2,60,'펠롭스'),
('niobe',1,20,'니오베'),
('oenomaus',1,20,'오이노마오스'),
('hippodamia',1,20,'히포다메이아'),
('atreus',1,20,'아트레우스'),
('thyestes',1,20,'티에스테스'),
('agamemnon',2,60,'아가멤논'),
('menelaus',2,60,'메넬라오스'),
('clytemnestra',1,20,'클리타임네스트라'),
('aegisthus',1,20,'아이기스토스'),
('iphigenia',1,20,'이피게네이아'),
('electra',1,20,'엘렉트라(아가멤논의 딸)'),
('orestes',2,60,'오레스테스'),
('pylades',2,60,'필라데스'),
('hermione',1,20,'헤르미오네'),
('tyndareus',1,20,'틴다레오스'),
('leda',1,20,'레다'),
('helen',1,20,'헬레네'),
('achilles',2,60,'아킬레우스'),
('neoptolemus',2,60,'네오프톨레모스'),
('ajax',2,60,'아이아스(대)'),
('ajax_lesser',2,60,'아이아스(소)'),
('teucer',2,60,'테우크로스'),
('patroclus',2,60,'파트로클로스'),
('odysseus',2,60,'오디세우스'),
('penelope',1,20,'페넬로페'),
('telemachus',2,60,'텔레마코스'),
('laertes',1,20,'라에르테스'),
('telegonus',1,20,'텔레고노스'),
('palamedes',2,60,'팔라메데스'),
('philoctetes',2,60,'필록테테스'),
('calchas',1,20,'칼카스'),
('protesilaus',2,60,'프로테실라오스'),
('idomeneus',2,60,'이도메네우스'),
('machaon',2,60,'마카온'),
('thersites',1,20,'테르시테스'),
('antilochus',2,60,'안틸로코스'),
('eurypylus',2,60,'에우리필로스'),
('dardanus',2,60,'다르다노스'),
('tros',1,20,'트로스'),
('ilus',1,20,'일로스'),
('ganymede',1,20,'가니메데스'),
('laomedon',1,20,'라오메돈'),
('hesione',1,20,'헤시오네'),
('tithonus',1,20,'티토노스'),
('priam',1,20,'프리아모스'),
('hecuba',1,20,'헤카베'),
('hector',2,60,'헥토르'),
('andromache',1,20,'안드로마케'),
('astyanax',1,20,'아스티아낙스'),
('paris',2,60,'파리스'),
('cassandra',1,20,'카산드라'),
('helenus',1,20,'헬레노스'),
('deiphobus',1,20,'데이포보스'),
('troilus',1,20,'트로일로스'),
('polyxena',1,20,'폴릭세네'),
('aeneas',2,60,'아이네이아스'),
('anchises',1,20,'안키세스'),
('memnon',2,60,'멤논'),
('penthesilea',2,60,'펜테실레이아'),
('sarpedon',2,60,'사르페돈'),
('glaucus',2,60,'글라우코스(리키아)'),
('pandarus',2,60,'판다로스'),
('euphorbus',2,60,'에우포르보스'),
('rhesus',2,60,'레소스'),
('narcissus',1,20,'나르키소스'),
('arachne',1,20,'아라크네'),
('midas',1,20,'미다스'),
('ixion',1,20,'익시온'),
('orion',2,60,'오리온'),
('endymion',1,20,'엔디미온'),
('adonis',1,20,'아도니스'),
('psyche',1,20,'프시케'),
('hyacinthus',1,20,'히아킨토스'),
('phaethon',1,20,'파에톤'),
('io',1,20,'이오'),
('callisto',1,20,'칼리스토'),
('arcas',1,20,'아르카스'),
('pygmalion',1,20,'피그말리온'),
('coronis',1,20,'코로니스')
on conflict (id) do update set tier=excluded.tier,price=excluded.price,name_ko=excluded.name_ko;

insert into public.title_catalog (id,name_ko) values
('apprentice','스도쿠 수습생'),
('explorer','미궁 탐험가'),
('sage','올림포스의 현자')
on conflict (id) do update set name_ko=excluded.name_ko;

delete from public.journey_steps;
insert into public.journey_steps (step,need,title,reward) values
(1,1,'첫 초상화','{"gift":1}'::jsonb),
(2,3,'별빛 주머니','{"bonus":30}'::jsonb),
(3,5,'영웅의 문','{"tier":2}'::jsonb),
(4,8,'수습생','{"title":"apprentice"}'::jsonb),
(5,12,'영웅의 선물','{"gift":2}'::jsonb),
(6,16,'큰 별빛 주머니','{"bonus":80}'::jsonb),
(7,20,'신들의 문','{"tier":3}'::jsonb),
(8,25,'미궁 탐험','{"title":"explorer"}'::jsonb),
(9,30,'신의 선물','{"gift":3}'::jsonb),
(10,40,'별빛 보물 상자','{"bonus":200}'::jsonb),
(11,50,'올림포스의 문','{"tier":4}'::jsonb),
(12,70,'올림포스의 현자','{"title":"sage","gift":4}'::jsonb);
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
do $$ begin
  perform private.make_gift(q.profile_id, 1) from public.quest_progress q
  where q.completed_count >= 1 and not exists (select 1 from public.owned_portraits o where o.profile_id = q.profile_id)
    and not exists (select 1 from public.portrait_gifts g where g.profile_id = q.profile_id);
end $$;
-- 보물 상점과 프로필 보물 표시
-- - 보물(물건 그림 64개)은 티어 없이(tier 0) 하나에 별빛 10. 데이터는 0011_treasure_data.sql.
-- - 산 보물은 바로 profiles.badge(초상화 오른쪽 아래 작은 동그라미)에 달리고, 가진 보물 중에서 바꾸거나 뗄 수 있다.
-- - 프로필 얼굴(avatar_id)은 티어 1 이상 초상화만.
-- - 이야기책은 끝낸 판 수로 화면에서 연다(1장은 처음부터, 이후 5판마다 한 장). 서버 변경 없음.

alter table public.portrait_catalog drop constraint if exists portrait_catalog_tier_check;
alter table public.portrait_catalog add constraint portrait_catalog_tier_check check (tier between 0 and 4);
alter table public.profiles add column if not exists badge text not null default '';

create or replace function private.tier_open(p uuid, t int) returns boolean
language sql stable security definer set search_path = '' as $$
  select t <= 1 or exists (select 1 from public.unlocks where profile_id = p and key = 'tier:' || t);
$$;

create or replace function public.update_profile(p uuid, patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_act(p);
  if patch ? 'nickname' and char_length(btrim(patch->>'nickname')) not between 1 and 12 then
    perform private.fail('bad_name', '이름은 1~12자로 적어 주세요.');
  end if;
  if coalesce(patch->>'avatar_id', '') <> '' and not exists (
    select 1 from public.owned_portraits o join public.portrait_catalog c on c.id = o.portrait_id
    where o.profile_id = p and o.portrait_id = patch->>'avatar_id' and c.tier >= 1) then
    perform private.fail('not_owned', '아직 모으지 않은 초상화예요.');
  end if;
  if coalesce(patch->>'badge', '') <> '' and not exists (
    select 1 from public.owned_portraits o join public.portrait_catalog c on c.id = o.portrait_id
    where o.profile_id = p and o.portrait_id = patch->>'badge' and c.tier = 0) then
    perform private.fail('not_owned', '아직 모으지 않은 보물이에요.');
  end if;
  if coalesce(patch->>'title', '') <> '' and not exists (
    select 1 from public.unlocks where profile_id = p and key = 'title:' || (patch->>'title')) then
    perform private.fail('locked', '아직 받지 않은 칭호예요.');
  end if;
  update public.profiles set
    nickname = coalesce(btrim(patch->>'nickname'), nickname),
    avatar_id = coalesce(patch->>'avatar_id', avatar_id),
    title = coalesce(patch->>'title', title),
    badge = coalesce(patch->>'badge', badge),
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
    'profile', jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'title', pr.title, 'badge', pr.badge,
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
  -- 보물은 사면 바로 프로필 오른쪽 아래에 단다
  if c.tier = 0 then update public.profiles set badge = portrait where id = p; end if;
  res := jsonb_build_object('portrait', portrait, 'price', c.price, 'balance', bal, 'badge', case when c.tier = 0 then portrait end);
  insert into private.operations (op_id, profile_id, kind, result) values (purchase_portrait.op_id, p, 'purchase', res);
  return res;
end $$;

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
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'id', r.profile_id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'badge', pr.badge,
        'title', pr.title, 'points', r.pts, 'games', r.games, 'me', r.profile_id = p) order by r.rn)
      from ranked r join public.profiles pr on pr.id = r.profile_id where r.rn <= 50), '[]'::jsonb),
    (select jsonb_build_object('rank', r.rnk, 'points', r.pts, 'games', r.games) from ranked r where r.profile_id = p)
  into rows, me;
  return jsonb_build_object('rows', rows, 'me', me);
end $$;

create or replace function public.list_friends(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare fid uuid;
begin
  perform private.require_act(p);
  fid := private.family_of(p);
  return jsonb_build_object(
    'family', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'badge', pr.badge, 'title', pr.title,
        'is_child', pr.is_child, 'points', private.points_of(pr.id)) order by pr.is_child, pr.created_at)
      from public.family_members m join public.profiles pr on pr.id = m.profile_id where m.family_id = fid and pr.id <> p), '[]'::jsonb),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('family', ff.other, 'since', ff.created_at, 'members',
        (select jsonb_agg(jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'badge', pr.badge, 'title', pr.title,
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

create or replace function public.list_feed(p uuid, before_id bigint default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare fid uuid;
begin
  perform private.require_act(p);
  fid := private.family_of(p);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', ac.id, 'kind', ac.kind, 'payload', ac.payload, 'created_at', ac.created_at, 'mine', ac.profile_id = p,
      'who', jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'badge', pr.badge, 'title', pr.title),
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
-- 자동 생성: npm run gen:portraits. 보물 64개, 하나에 별빛 10
insert into public.portrait_catalog (id,tier,price,name_ko) values
('thunderbolt',0,10,'제우스의 번개'),
('aegis',0,10,'아이기스'),
('trident',0,10,'포세이돈의 삼지창'),
('helm_darkness',0,10,'하데스의 투명 투구'),
('caduceus',0,10,'헤르메스의 지팡이'),
('talaria',0,10,'날개 달린 샌들'),
('lyre',0,10,'리라'),
('eros_arrows',0,10,'에로스의 금화살과 납화살'),
('cestus',0,10,'아프로디테의 허리띠'),
('thyrsus',0,10,'티르소스'),
('harpe',0,10,'하르페'),
('fate_thread',0,10,'운명의 실'),
('asclepius_rod',0,10,'아스클레피오스의 지팡이'),
('twin_bows',0,10,'아폴론과 아르테미스의 활'),
('golden_throne',0,10,'헤라의 황금 옥좌'),
('sun_chariot',0,10,'태양 마차'),
('cornucopia',0,10,'풍요의 뿔'),
('ambrosia',0,10,'암브로시아와 넥타르'),
('pomegranate',0,10,'페르세포네의 석류'),
('omphalos',0,10,'포대기에 싼 돌'),
('pan_pipes',0,10,'판의 피리'),
('athena_aulos',0,10,'아테나의 피리'),
('olive_tree',0,10,'아테나의 올리브 나무'),
('ariadne_crown',0,10,'아리아드네의 왕관'),
('fennel_fire',0,10,'회향 줄기 속 불씨'),
('pandora_jar',0,10,'판도라의 항아리'),
('deucalion_ark',0,10,'데우칼리온의 방주'),
('heracles_club',0,10,'헤라클레스의 몽둥이'),
('lion_pelt',0,10,'네메아의 사자 가죽'),
('heracles_bow',0,10,'헤라클레스의 활'),
('hesperides_apples',0,10,'헤스페리데스의 황금 사과'),
('race_apples',0,10,'경주의 황금 사과'),
('discord_apple',0,10,'불화의 황금 사과'),
('kibisis',0,10,'페르세우스의 자루'),
('mirror_shield',0,10,'거울 방패'),
('graiai_eye',0,10,'그라이아이의 눈'),
('golden_bridle',0,10,'황금 굴레'),
('ariadne_thread',0,10,'아리아드네의 실타래'),
('daedalus_wings',0,10,'다이달로스의 날개'),
('black_sail',0,10,'검은 돛'),
('aegeus_sword',0,10,'바위 밑의 칼과 샌들'),
('golden_fleece',0,10,'황금 양털'),
('argo',0,10,'아르고호'),
('jason_sandal',0,10,'이아손의 한쪽 샌들'),
('dragon_teeth',0,10,'용의 이빨'),
('harmonia_necklace',0,10,'하르모니아의 목걸이'),
('achilles_armor',0,10,'아킬레우스의 갑옷과 방패'),
('pelian_spear',0,10,'펠리온의 물푸레나무 창'),
('trojan_horse',0,10,'트로이 목마'),
('palladium',0,10,'팔라디온'),
('odysseus_bow',0,10,'오디세우스의 활'),
('wind_bag',0,10,'바람 자루'),
('moly',0,10,'몰리'),
('penelope_shroud',0,10,'페넬로페의 베'),
('charon_obol',0,10,'카론의 뱃삯'),
('boar_hide',0,10,'칼리돈 멧돼지 가죽'),
('bronze_rattle',0,10,'청동 딸랑이'),
('hippolyta_belt',0,10,'히폴리테의 허리띠'),
('golden_cup',0,10,'헬리오스의 황금 잔'),
('sisyphus_stone',0,10,'시시포스의 바위'),
('psyche_lamp',0,10,'프시케의 등불'),
('beauty_box',0,10,'아름다움의 상자'),
('ivory_statue',0,10,'상아 조각상'),
('arachne_loom',0,10,'아라크네의 베틀')
on conflict (id) do update set tier=excluded.tier,price=excluded.price,name_ko=excluded.name_ko;
-- 걸린 시간을 서버 시계로 잰다.
-- - 퍼즐 화면을 열면 open_attempt가 서버 시각을 시작 시각(active_since)으로 저장한다.
-- - 나가거나 화면을 내리면 pause_attempt가 그 구간(서버 시각 차이)을 played_sec에 더한다.
-- - 앱을 그냥 닫아 pause가 오지 않았으면, 다음에 열 때 마지막 저장 시각(updated_at)까지만 그 구간으로 친다.
-- - 완료할 때 played_sec + (지금 - active_since)가 걸린 시간이다. 나가 있던 시간은 빠진다.

alter table public.puzzle_attempts add column if not exists active_since timestamptz;
alter table public.puzzle_attempts add column if not exists played_sec int not null default 0;

create or replace function public.open_attempt(attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status <> 'active' then return jsonb_build_object('played_sec', a.played_sec); end if;
  -- 닫히지 않은 구간이 남아 있으면 마지막 저장 시각까지만 인정
  if a.active_since is not null then
    a.played_sec := a.played_sec + greatest(0, extract(epoch from least(greatest(a.updated_at, a.active_since), now()) - a.active_since))::int;
  end if;
  update public.puzzle_attempts set played_sec = a.played_sec, active_since = now() where id = attempt;
  return jsonb_build_object('played_sec', a.played_sec);
end $$;

create or replace function public.pause_attempt(attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status = 'active' and a.active_since is not null then
    a.played_sec := a.played_sec + greatest(0, extract(epoch from now() - a.active_since))::int;
    update public.puzzle_attempts set played_sec = a.played_sec, active_since = null where id = attempt;
  end if;
  return jsonb_build_object('played_sec', a.played_sec);
end $$;

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

  -- 시간: 서버 시계로 잰 푼 구간의 합(기기 시간은 쓰지 않는다. elapsed_sec 인자는 예전 화면 호환용으로만 남김)
  secs := greatest(1, a.played_sec + case when a.active_since is not null
    then greatest(0, extract(epoch from now() - a.active_since))::int else 0 end);

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
    updated_at = now(), elapsed_sec = secs, played_sec = secs, active_since = null, result = res where id = attempt;
  return res;
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
-- 새 판·순위표 바꾸기
-- - start_attempt: 언제나 새 판을 준다. 같은 크기·난이도로 이어서 풀던 판이 있으면 그 판은 그만둔 판(abandoned)이 된다.
--   (이어서 풀기는 get_attempt로 따로 연다. 화면에서 새로 시작하기 전에 먼저 물어본다.)
-- - get_leaderboard: 기간은 오늘·이번 주·이번 달(한국 시각). 종류는 점수(points)와 빨리 푼 순위(speed).
--   빨리 푼 순위는 난이도별로만, 그 기간에 힌트 없이 끝낸 판 중 가장 빠른 시간으로 줄 세운다.

create or replace function private.day_start() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;

create or replace function private.month_start() returns timestamptz
language sql stable as $$
  select (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;

create or replace function public.start_attempt(p uuid, board_size int, difficulty text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  perform private.require_act(p);
  update public.puzzle_attempts at set status = 'abandoned', active_since = null, updated_at = now()
    from public.puzzle_catalog c
    where c.id = at.puzzle_id and at.profile_id = p and at.status = 'active'
      and c.size = board_size and c.difficulty = start_attempt.difficulty;
  select c.* into pz from public.puzzle_catalog c
    where c.size = board_size and c.difficulty = start_attempt.difficulty
      and c.id not in (select puzzle_id from public.puzzle_attempts where profile_id = p order by started_at desc limit 30)
    order by random() limit 1;
  if not found then
    select c.* into pz from public.puzzle_catalog c
      where c.size = board_size and c.difficulty = start_attempt.difficulty order by random() limit 1;
  end if;
  if not found then perform private.fail('no_puzzle', '이 크기와 난이도의 문제가 없어요.'); end if;
  insert into public.puzzle_attempts (profile_id, puzzle_id, board) values (p, pz.id, pz.givens) returning * into a;
  return jsonb_build_object('id', a.id, 'puzzle_id', a.puzzle_id, 'size', pz.size, 'difficulty', pz.difficulty,
    'givens', pz.givens, 'board', a.board, 'notes', a.notes, 'revision', a.revision, 'hints_used', a.hints_used);
end $$;

drop function if exists public.get_leaderboard(uuid, text, text);
create or replace function public.get_leaderboard(p uuid, board text, period text, kind text default 'points') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz; sz int := null; df text := null; rows jsonb; me jsonb;
begin
  perform private.require_act(p);
  case period
    when 'day' then since := private.day_start();
    when 'week' then since := private.week_start();
    when 'month' then since := private.month_start();
    else perform private.fail('bad_period', '기간이 맞지 않아요.');
  end case;
  case board
    when 'all' then null;
    when '4' then sz := 4; df := 'intro';
    when '6' then sz := 6; df := 'intro';
    when '9e' then sz := 9; df := 'easy';
    when '9m' then sz := 9; df := 'medium';
    when '9h' then sz := 9; df := 'hard';
    else perform private.fail('bad_board', '순위표 종류가 맞지 않아요.');
  end case;

  if kind = 'points' then
    with s as (
      select e.profile_id, sum(e.points)::int as pts, count(*)::int as games, max(e.created_at) as last_at
      from public.score_events e
      where e.created_at >= since and (sz is null or (e.size = sz and e.difficulty = df))
      group by e.profile_id having sum(e.points) > 0
    ), ranked as (
      select s.*, rank() over (order by s.pts desc) as rnk, row_number() over (order by s.pts desc, s.last_at) as rn from s
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'id', r.profile_id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'badge', pr.badge,
          'title', pr.title, 'points', r.pts, 'games', r.games, 'me', r.profile_id = p) order by r.rn)
        from ranked r join public.profiles pr on pr.id = r.profile_id where r.rn <= 50), '[]'::jsonb),
      (select jsonb_build_object('rank', r.rnk, 'points', r.pts, 'games', r.games) from ranked r where r.profile_id = p)
    into rows, me;
  elsif kind = 'speed' then
    if sz is null then perform private.fail('bad_board', '빨리 푼 순위는 난이도를 골라야 해요.'); end if;
    with s as (
      select at.profile_id, min(at.elapsed_sec)::int as sec, count(*)::int as games,
             min(at.completed_at) as first_at
      from public.puzzle_attempts at join public.puzzle_catalog c on c.id = at.puzzle_id
      where at.status = 'completed' and at.hints_used = 0 and at.elapsed_sec is not null
        and at.completed_at >= since and c.size = sz and c.difficulty = df
      group by at.profile_id
    ), ranked as (
      select s.*, rank() over (order by s.sec) as rnk, row_number() over (order by s.sec, s.first_at) as rn from s
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'id', r.profile_id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'badge', pr.badge,
          'title', pr.title, 'sec', r.sec, 'games', r.games, 'me', r.profile_id = p) order by r.rn)
        from ranked r join public.profiles pr on pr.id = r.profile_id where r.rn <= 50), '[]'::jsonb),
      (select jsonb_build_object('rank', r.rnk, 'sec', r.sec, 'games', r.games) from ranked r where r.profile_id = p)
    into rows, me;
  else
    perform private.fail('bad_kind', '순위 종류가 맞지 않아요.');
  end if;
  return jsonb_build_object('rows', rows, 'me', me);
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
-- 칭호 25종 추가와 칭호 스킬
-- - 칭호는 조건(모은 초상화·보물 수, 빠르기, 끝낸 판 수, 이야기 읽은 장, 힌트 없이 끝낸 판, 다섯 난이도, 7일 연속, 보낸 이모티콘)을
--   채우면 서버가 자동으로 준다(private.check_titles). 지금까지 조건을 채운 사람에게는 이 파일을 실행할 때 소급해서 준다(소식은 띄우지 않음).
-- - 스킬은 지금 달고 있는 칭호 하나만 켜진다. 스킬로 더 받는 별빛은 지갑에만 넣고 점수(순위)와 기록에는 넣지 않는다.
-- - 힌트를 쓴 판은 스킬과 관계없이 기록에 들어가지 않는다.

-- ---------- 칭호 목록(조건) ----------
alter table public.title_catalog add column if not exists stat text;
alter table public.title_catalog add column if not exists need int;

insert into public.title_catalog (id, name_ko, stat, need) values
  ('col10', '초상화 수집가', 'portraits', 10),
  ('col30', '신전 화가', 'portraits', 30),
  ('col60', '전당 관리인', 'portraits', 60),
  ('col120', '올림포스 사관', 'portraits', 120),
  ('col200', '신들의 기록관', 'portraits', 200),
  ('col390', '모든 얼굴을 아는 자', 'portraits', 390),
  ('tr5', '보물 사냥꾼', 'treasures', 5),
  ('tr15', '아르고 선원', 'treasures', 15),
  ('tr30', '보물창고지기', 'treasures', 30),
  ('tr64', '헤파이스토스의 제자', 'treasures', 64),
  ('fast9e', '날랜 발', 'best_9e', 360),
  ('fast9m', '바람의 전령', 'best_9m', 600),
  ('fast9h', '번개의 화살', 'best_9h', 900),
  ('play100', '끈기의 영웅', 'completed', 100),
  ('play150', '헤라클레스의 후예', 'completed', 150),
  ('play200', '미궁의 주인', 'completed', 200),
  ('play300', '시간을 다스리는 자', 'completed', 300),
  ('play500', '영원의 수호자', 'completed', 500),
  ('read4', '이야기꾼', 'reads', 4),
  ('read8', '음유시인', 'reads', 8),
  ('read16', '무사이의 친구', 'reads', 16),
  ('wise30', '지혜의 눈', 'no_hint', 30),
  ('five', '다섯 신전 순례자', 'boards', 5),
  ('streak7', '성실한 순례자', 'streak', 7),
  ('kind30', '다정한 이웃', 'reactions', 30)
on conflict (id) do update set name_ko = excluded.name_ko, stat = excluded.stat, need = excluded.need;

-- ---------- 이야기책 읽은 장 ----------
create table if not exists public.story_reads (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  chapter int not null check (chapter between 1 and 16),
  read_at timestamptz not null default now(),
  primary key (profile_id, chapter)
);
alter table public.story_reads enable row level security;
revoke all on public.story_reads from anon, authenticated, public;

-- ---------- 스킬 ----------
create or replace function private.title_of(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select title from public.profiles where id = p), '');
$$;

-- 한 판 힌트 상한(미궁 탐험가 11번)
create or replace function private.hint_max(p uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case when private.title_of(p) = 'explorer' then 11 else 10 end;
$$;

-- 이야기책이 몇 판마다 한 장씩 열리는지(이야기꾼 4판)
create or replace function private.story_every(p uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case when private.title_of(p) = 'read4' then 4 else 5 end;
$$;

-- 내 칭호를 고려한 가격: 초상화 할인(초상화 수집 칭호), 보물 값(보물 칭호)
create or replace function private.price_for(p uuid, c public.portrait_catalog) returns int
language plpgsql stable security definer set search_path = '' as $$
declare t text := private.title_of(p); pct int;
begin
  if c.tier = 0 then
    return case t when 'tr5' then 9 when 'tr15' then 8 when 'tr30' then 7 else c.price end;
  end if;
  pct := case t when 'col10' then 2 when 'col30' then 4 when 'col60' then 6 when 'col120' then 8 when 'col200' then 10 when 'col390' then 12 else 0 end;
  return c.price - (c.price * pct / 100);
end $$;

-- ---------- 칭호 조건에 쓰는 수치 ----------
create or replace function private.title_stats(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'portraits', (select count(*) from public.owned_portraits o join public.portrait_catalog c on c.id = o.portrait_id where o.profile_id = p and c.tier >= 1),
    'treasures', (select count(*) from public.owned_portraits o join public.portrait_catalog c on c.id = o.portrait_id where o.profile_id = p and c.tier = 0),
    'best_9e', (select best_sec from public.personal_records where profile_id = p and size = 9 and difficulty = 'easy'),
    'best_9m', (select best_sec from public.personal_records where profile_id = p and size = 9 and difficulty = 'medium'),
    'best_9h', (select best_sec from public.personal_records where profile_id = p and size = 9 and difficulty = 'hard'),
    'completed', (select completed_count from public.quest_progress where profile_id = p),
    'no_hint', (select no_hint_count from public.quest_progress where profile_id = p),
    'reads', (select count(*) from public.story_reads where profile_id = p),
    'boards', (select count(*) from (select distinct size, difficulty from public.score_events where profile_id = p) b),
    'streak', (select coalesce(max(n), 0) from (
        select count(*) as n from (
          select day, day - (row_number() over (order by day))::int as grp
          from (select distinct (completed_at at time zone 'Asia/Seoul')::date as day from public.puzzle_attempts
                where profile_id = p and status = 'completed' and completed_at is not null) d) g
        group by grp) s),
    'reactions', (select count(*) from public.activity_reactions where reactor = p)
  );
$$;

-- 조건을 채운 칭호를 준다. quiet면 소식 없이(소급용). 새로 받은 칭호 이름 목록을 돌려준다.
create or replace function private.check_titles(p uuid, quiet boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare st jsonb := private.title_stats(p); t record; v int; got jsonb := '[]'::jsonb;
begin
  for t in select * from public.title_catalog where stat is not null order by id loop
    v := (st->>t.stat)::int;
    if v is null then continue; end if;
    -- 빠르기는 기준 시간 이하, 나머지는 기준 이상
    if (t.stat like 'best_%' and v <= t.need) or (t.stat not like 'best_%' and v >= t.need) then
      if quiet then
        insert into public.unlocks (profile_id, key) values (p, 'title:' || t.id) on conflict do nothing;
        if found then update public.profiles set title = t.id where id = p and title = ''; end if;
      elsif not exists (select 1 from public.unlocks where profile_id = p and key = 'title:' || t.id) then
        perform private.grant_title(p, t.id);
        got := got || to_jsonb(t.name_ko);
      end if;
    end if;
  end loop;
  return got;
end $$;

-- ---------- 힌트 상한 ----------
create or replace function public.save_attempt(attempt uuid, expected_revision int, board text, notes jsonb, hints_used int, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  select * into a from public.puzzle_attempts where id = attempt for update;
  if not found then perform private.fail('not_found', '퍼즐을 찾을 수 없어요.'); end if;
  perform private.require_act(a.profile_id);
  if a.status <> 'active' then perform private.fail('not_active', '이미 끝난 퍼즐이에요.'); end if;
  if a.revision <> expected_revision then
    raise exception using errcode = 'P0001', message = 'conflict', detail = '다른 기기에서 먼저 저장했어요.', hint = 'final:' || a.revision;
  end if;
  select * into pz from public.puzzle_catalog where id = a.puzzle_id;
  perform private.check_board(board, pz.givens, pz.size);
  if pg_column_size(notes) > 8000 then perform private.fail('bad_notes', '메모가 너무 많아요.'); end if;
  update public.puzzle_attempts set board = save_attempt.board, notes = coalesce(save_attempt.notes, '{}'::jsonb),
    hints_used = least(private.hint_max(a.profile_id), greatest(a.hints_used, coalesce(save_attempt.hints_used, 0))),
    revision = a.revision + 1, updated_at = now() where id = attempt;
  return jsonb_build_object('revision', a.revision + 1);
end $$;

-- ---------- 완료: 0012 그대로 + 칭호 스킬 별빛 + 칭호 검사 ----------
create or replace function public.complete_attempt(attempt uuid, board text, op_id uuid, elapsed_sec int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.puzzle_attempts; pz public.puzzle_catalog; sol text; amount int; q public.quest_progress;
  step public.journey_steps; res jsonb; jr jsonb := null; bal int; before_pts int; after_pts int; th int;
  secs int; prev int; rec jsonb := null; gift_id uuid := null; bonus int := 0;
  ttl text; paid_hints int; first_today boolean; skill int := 0; titles jsonb;
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

  -- 시간: 서버 시계로 잰 푼 구간의 합
  secs := greatest(1, a.played_sec + case when a.active_since is not null
    then greatest(0, extract(epoch from now() - a.active_since))::int else 0 end);

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

  -- 칭호 스킬 별빛(지갑에만, 점수에는 넣지 않음)
  if first_today then
    skill := skill + case ttl when 'apprentice' then 2 when 'play100' then 4 when 'play150' then 6 when 'play200' then 8
      when 'play300' then 10 when 'play500' then 12 when 'streak7' then 5 else 0 end;
  end if;
  skill := skill + case ttl when 'tr64' then 2 when 'five' then 1 else 0 end;
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
    updated_at = now(), elapsed_sec = secs, played_sec = secs, active_since = null where id = attempt;
  titles := private.check_titles(a.profile_id);

  res := jsonb_build_object('reward', amount, 'balance', bal, 'completed_count', q.completed_count,
    'no_hint', a.hints_used = 0, 'hints_used', a.hints_used, 'paid_hints', least(paid_hints, 10), 'journey', jr, 'puzzle_id', pz.id,
    'size', pz.size, 'difficulty', pz.difficulty, 'elapsed', secs, 'record', rec, 'points', after_pts,
    'skill_bonus', skill, 'skill_title', case when skill > 0 then ttl end, 'titles', titles);
  update public.puzzle_attempts set result = res where id = attempt;
  return res;
end $$;

-- ---------- 상점: 칭호 할인 ----------
create or replace function public.purchase_portrait(p uuid, portrait text, op_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.portrait_catalog; done jsonb; bal int; res jsonb; price int;
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
  price := private.price_for(p, c);
  update public.wallets set balance = balance - price where profile_id = p and balance >= price returning balance into bal;
  if not found then perform private.fail('not_enough', '별빛이 부족해요.'); end if;
  insert into public.reward_ledger (profile_id, event_key, amount, reason) values (p, 'buy:' || op_id, -price, 'portrait:' || portrait);
  insert into public.owned_portraits (profile_id, portrait_id, source) values (p, portrait, 'buy');
  if c.tier = 0 then update public.profiles set badge = portrait where id = p; end if;
  res := jsonb_build_object('portrait', portrait, 'price', price, 'balance', bal, 'badge', case when c.tier = 0 then portrait end,
    'titles', private.check_titles(p));
  insert into private.operations (op_id, profile_id, kind, result) values (purchase_portrait.op_id, p, 'purchase', res);
  return res;
end $$;

-- ---------- 선물 상자: 음유시인은 넷 중에서, 무사이의 친구는 하루 한 번 다시 뽑기 ----------
create or replace function private.make_gift(p uuid, t int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare opts text[]; gid uuid;
begin
  select array_agg(id) into opts from (
    select c.id from public.portrait_catalog c
    where c.tier = t and not exists (select 1 from public.owned_portraits o where o.profile_id = p and o.portrait_id = c.id)
    order by random() limit case when private.title_of(p) = 'read8' then 4 else 3 end) s;
  if opts is null then return null; end if;
  insert into public.portrait_gifts (profile_id, tier, options) values (p, t, opts) returning id into gid;
  return gid;
end $$;

create or replace function public.reroll_gift(p uuid, gift uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.portrait_gifts; k text := 'reroll:' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD'); opts text[];
begin
  perform private.require_act(p);
  if private.title_of(p) <> 'read16' then perform private.fail('no_skill', '「무사이의 친구」 칭호를 달면 쓸 수 있어요.'); end if;
  select * into g from public.portrait_gifts where id = gift and profile_id = p for update;
  if not found then perform private.fail('not_found', '선물을 찾을 수 없어요.'); end if;
  if g.claimed is not null then perform private.fail('claimed', '이미 고른 선물이에요.'); end if;
  if exists (select 1 from public.unlocks where profile_id = p and key = k) then perform private.fail('used', '다시 뽑기는 하루에 한 번이에요.'); end if;
  select array_agg(id) into opts from (
    select c.id from public.portrait_catalog c
    where c.tier = g.tier and not (c.id = any (g.options))
      and not exists (select 1 from public.owned_portraits o where o.profile_id = p and o.portrait_id = c.id)
    order by random() limit coalesce(array_length(g.options, 1), 3)) s;
  if opts is null then perform private.fail('no_more', '다시 뽑을 초상화가 없어요.'); end if;
  delete from public.unlocks where profile_id = p and key like 'reroll:%';
  insert into public.unlocks (profile_id, key) values (p, k);
  update public.portrait_gifts set options = opts where id = gift;
  return jsonb_build_object('options', opts);
end $$;

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
  return jsonb_build_object('portrait', portrait, 'titles', private.check_titles(p));
end $$;

-- ---------- 이야기책: 한 장을 끝까지 읽으면 기록 ----------
create or replace function public.mark_story_read(p uuid, chapter int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare done int;
begin
  perform private.require_act(p);
  if chapter not between 1 and 16 then perform private.fail('bad_chapter', '없는 장이에요.'); end if;
  select completed_count into done from public.quest_progress where profile_id = p;
  if done < (chapter - 1) * private.story_every(p) then perform private.fail('locked', '아직 열리지 않은 장이에요.'); end if;
  insert into public.story_reads (profile_id, chapter) values (p, mark_story_read.chapter) on conflict do nothing;
  return jsonb_build_object('reads', (select count(*) from public.story_reads where profile_id = p), 'titles', private.check_titles(p));
end $$;

-- ---------- 이모티콘: 다정한 이웃은 4종 더 ----------
create or replace function public.set_reaction(p uuid, activity bigint, emoji text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ac public.activities; cur text; allowed text[] := array['👍', '❤️', '👏', '🎉', '😆', '😮', '🔥', '🌟'];
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
  if private.title_of(p) = 'kind30' then allowed := allowed || array['🍀', '🦉', '⚡', '🏛️']; end if;
  if not (emoji = any (allowed)) then perform private.fail('bad_emoji', '고를 수 없는 이모티콘이에요.'); end if;
  insert into public.activity_reactions (activity_id, reactor, emoji) values (activity, p, emoji)
    on conflict (activity_id, reactor) do update set emoji = excluded.emoji, updated_at = now();
  insert into public.notifications (recipient_profile_id, kind, ref, payload)
    values (ac.profile_id, 'reaction', activity::text, jsonb_build_object('nickname', (select nickname from public.profiles where id = p),
      'avatar_id', (select avatar_id from public.profiles where id = p), 'emoji', emoji, 'activity_kind', ac.kind, 'activity', ac.payload));
  return jsonb_build_object('emoji', emoji, 'titles', private.check_titles(p));
end $$;

-- ---------- 상태: 칭호 진행도(stats)와 읽은 장 ----------
create or replace function public.get_state(p uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.require_act(p);
  select jsonb_build_object(
    'profile', jsonb_build_object('id', pr.id, 'nickname', pr.nickname, 'avatar_id', pr.avatar_id, 'title', pr.title, 'badge', pr.badge,
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
    'family_role', (select role from public.family_members where profile_id = p),
    'stats', private.title_stats(p),
    'reads', coalesce((select jsonb_agg(chapter order by chapter) from public.story_reads where profile_id = p), '[]'::jsonb)
  ) into r from public.profiles pr where pr.id = p;
  return r;
end $$;

-- ---------- 소급: 지금까지 조건을 채운 사람에게 칭호(소식 없이) ----------
do $$
declare pid uuid;
begin
  for pid in select id from public.profiles loop
    perform private.check_titles(pid, true);
  end loop;
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
