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
