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
