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
      {"uid":"r2","item":"tea_table","x":5,"y":5},
      {"uid":"r3","item":"round_stool","x":7,"y":5},
      {"uid":"r4","item":"cloud_cushion","x":4,"y":5},
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
