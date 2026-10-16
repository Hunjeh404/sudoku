-- 신화 난이도(대각선 스도쿠)와 칭호「은하수의 방랑자」
-- - 다섯 난이도(4×4·6×6·9×9 쉬움·보통·어려움)를 모두 한 판 이상 끝내면 받는 칭호(id five)의 이름을「은하수의 방랑자」로 바꾸고,
--   스킬(판마다 별빛 +1)은 없애고 대신 신화 난이도를 연다. 칭호를 단 사람만 신화 판을 시작할 수 있다.
-- - 신화: 9×9에 두 대각선도 1~9가 한 번씩. 보상 별빛 60. 문제는 0017_diag_puzzles.sql.
-- - 순위표 '9d'(화면에서는 칭호를 단 사람에게만 보임). 친구 소식은 누구에게나 그대로 보인다.

alter table public.puzzle_catalog drop constraint if exists puzzle_catalog_difficulty_check;
alter table public.puzzle_catalog add constraint puzzle_catalog_difficulty_check check (difficulty in ('intro', 'easy', 'medium', 'hard', 'diag'));
insert into public.reward_rules (size, difficulty, amount) values (9, 'diag', 60) on conflict (size, difficulty) do update set amount = excluded.amount;
update public.title_catalog set name_ko = '은하수의 방랑자' where id = 'five';

-- 다섯 난이도 수에는 신화를 넣지 않는다
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
    'boards', (select count(*) from (select distinct size, difficulty from public.score_events where profile_id = p and difficulty <> 'diag') b),
    'streak', (select coalesce(max(n), 0) from (
        select count(*) as n from (
          select day, day - (row_number() over (order by day))::int as grp
          from (select distinct (completed_at at time zone 'Asia/Seoul')::date as day from public.puzzle_attempts
                where profile_id = p and status = 'completed' and completed_at is not null) d) g
        group by grp) s),
    'reactions', (select count(*) from public.activity_reactions where reactor = p)
  );
$$;

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

  -- 시간: 서버 시계로 잰 푼 구간의 합
  secs := greatest(1, a.played_sec + case when a.active_since is not null
    then greatest(0, extract(epoch from now() - a.active_since))::int else 0 end);
  -- 믿을 수 없는 시간(빈칸 하나에 1초도 안 걸린 셈)은 기록·빠른 순위에 넣지 않고, 보여 주는 시간은 시작부터 지금까지로
  ok := secs >= private.blanks(pz.givens);
  if not ok then secs := greatest(1, extract(epoch from now() - a.started_at)::int); end if;

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
    when '9d' then sz := 9; df := 'diag';
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
      where at.status = 'completed' and at.hints_used = 0 and at.elapsed_sec is not null and at.time_ok
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
