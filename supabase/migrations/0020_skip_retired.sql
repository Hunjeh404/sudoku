-- 새 판은 그만 낸 문제(retired, 0019)를 빼고 고른다. 이어서 풀던 판과 지난 기록은 그대로.

create or replace function public.start_attempt(p uuid, board_size int, difficulty text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.puzzle_attempts; pz public.puzzle_catalog;
begin
  perform private.require_act(p);
  -- 신화(대각선)는 칭호「은하수의 방랑자」를 단 사람만
  if start_attempt.difficulty = 'diag' and private.title_of(p) <> 'five' then
    perform private.fail('locked', '「은하수의 방랑자」 칭호를 달면 열려요.');
  end if;
  update public.puzzle_attempts at set status = 'abandoned', active_since = null, updated_at = now()
    from public.puzzle_catalog c
    where c.id = at.puzzle_id and at.profile_id = p and at.status = 'active'
      and c.size = board_size and c.difficulty = start_attempt.difficulty;
  select c.* into pz from public.puzzle_catalog c
    where c.size = board_size and c.difficulty = start_attempt.difficulty and not c.retired
      and c.id not in (select puzzle_id from public.puzzle_attempts where profile_id = p order by started_at desc limit 30)
    order by random() limit 1;
  if not found then
    select c.* into pz from public.puzzle_catalog c
      where c.size = board_size and c.difficulty = start_attempt.difficulty and not c.retired order by random() limit 1;
  end if;
  if not found then perform private.fail('no_puzzle', '이 크기와 난이도의 문제가 없어요.'); end if;
  insert into public.puzzle_attempts (profile_id, puzzle_id, board) values (p, pz.id, pz.givens) returning * into a;
  return jsonb_build_object('id', a.id, 'puzzle_id', a.puzzle_id, 'size', pz.size, 'difficulty', pz.difficulty,
    'givens', pz.givens, 'board', a.board, 'notes', a.notes, 'revision', a.revision, 'hints_used', a.hints_used);
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
