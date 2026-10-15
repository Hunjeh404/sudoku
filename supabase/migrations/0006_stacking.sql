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
