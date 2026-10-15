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
