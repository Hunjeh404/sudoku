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
