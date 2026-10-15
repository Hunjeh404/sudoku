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
