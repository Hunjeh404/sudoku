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
