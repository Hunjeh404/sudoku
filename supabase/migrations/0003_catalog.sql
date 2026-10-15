-- 자동 생성: npm run gen:catalog (src/data/catalog.ts가 원본)
insert into public.item_catalog (id,kind,name_ko,price,surface,fw,fh,blocking,spaces,supports,unlock_step,sort) values
('cloud_bed','furniture','구름 침대',60,'floor',2,3,true,array['room']::text[],array[]::text[],3,0),
('cloud_cushion','furniture','구름 쿠션',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,1),
('display_pedestal','furniture','보물 받침대',60,'floor',1,1,true,array['room','garden']::text[],array['artifact']::text[],0,2),
('garden_trellis','furniture','꽃 아치',60,'floor',3,1,true,array['garden']::text[],array[]::text[],5,3),
('laurel_bench','furniture','월계수 벤치',60,'floor',3,1,true,array['room','garden']::text[],array[]::text[],0,4),
('laurel_door','furniture','월계수 문',60,'wallRight',2,1,false,array['room']::text[],array[]::text[],0,5),
('laurel_rug','furniture','월계수 러그',60,'rug',3,2,false,array['room']::text[],array[]::text[],0,6),
('linen_curtain','furniture','리넨 커튼',60,'wallRight',2,1,false,array['room']::text[],array[]::text[],3,7),
('music_stand','furniture','악보대',60,'floor',1,1,true,array['room','garden']::text[],array[]::text[],2,8),
('olive_planter','furniture','올리브 화분',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,9),
('owl_mailbox','furniture','올빼미 우편함',60,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,10),
('picture_frame','furniture','신화 액자',20,'supportSlot',1,1,false,array['room']::text[],array[]::text[],7,11),
('round_stool','furniture','둥근 의자',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,12),
('scroll_bookcase','furniture','두루마리 책장',60,'floor',2,1,true,array['room']::text[],array[]::text[],4,13),
('shell_fountain','furniture','조개 분수',60,'floor',3,3,true,array['garden']::text[],array[]::text[],8,14),
('star_lantern','furniture','별빛 등불',20,'floor',1,1,true,array['room','garden']::text[],array[]::text[],0,15),
('star_mobile','furniture','별 모빌',60,'floor',1,1,true,array['room']::text[],array[]::text[],8,16),
('stepping_stones','furniture','정원 디딤돌',20,'floor',3,1,true,array['garden']::text[],array[]::text[],0,17),
('tea_table','furniture','찻상',60,'floor',2,2,true,array['room','garden']::text[],array['picture_frame']::text[],0,18),
('treasure_chest','furniture','보물 상자',60,'floor',2,1,true,array['room','garden']::text[],array[]::text[],0,19),
('lyre','treasure','작은 리라',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],3,20),
('psyche_lamp','treasure','프시케의 등불',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],6,21),
('cornucopia','treasure','풍요의 뿔',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],6,22),
('olive_tree','treasure','아테나의 올리브 나무',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],6,23),
('wind_bag','treasure','바람 자루',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],9,24),
('golden_fleece','treasure','황금 양털',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],9,25),
('mirror_shield','treasure','거울 방패',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],9,26),
('ariadne_thread','treasure','아리아드네의 실타래',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],10,27),
('ariadne_crown','treasure','아리아드네의 왕관',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],11,28),
('pandora_jar','treasure','판도라의 항아리',120,'artifact',1,1,false,array['room','garden']::text[],array[]::text[],11,29)
on conflict (id) do update set kind=excluded.kind,name_ko=excluded.name_ko,price=excluded.price,surface=excluded.surface,fw=excluded.fw,fh=excluded.fh,
  blocking=excluded.blocking,spaces=excluded.spaces,supports=excluded.supports,unlock_step=excluded.unlock_step,sort=excluded.sort;

insert into public.journey_steps (step,title,reward) values
(1,'첫 별빛','{"choice":true}'::jsonb),
(2,'아폴론의 노래','{"unlock":["guide:apollo"]}'::jsonb),
(3,'리라 선물','{"items":{"lyre":1}}'::jsonb),
(4,'첫 이야기','{"unlock":["chapter:1"]}'::jsonb),
(5,'아르테미스의 정원','{"unlock":["guide:artemis"]}'::jsonb),
(6,'보물 진열실','{}'::jsonb),
(7,'그림 액자','{"unlock":["chapter:4"],"items":{"picture_frame":1}}'::jsonb),
(8,'반짝이는 물','{}'::jsonb),
(9,'영웅의 보물','{}'::jsonb),
(10,'미궁의 실','{"unlock":["chapter:9"]}'::jsonb),
(11,'별의 왕관','{}'::jsonb),
(12,'올림포스 정원사','{"unlock":["badge:gardener"],"items":{"star_mobile":1}}'::jsonb)
on conflict (step) do update set title=excluded.title,reward=excluded.reward;

insert into public.reward_rules (size,difficulty,amount) values
(4,'intro',10),
(6,'intro',20),
(9,'easy',30),
(9,'medium',40),
(9,'hard',50)
on conflict (size,difficulty) do update set amount=excluded.amount;

insert into public.scene_catalog (file,chapter) values
('assets/scenes/c01-00.webp',1),
('assets/scenes/c01-01.webp',1),
('assets/scenes/c01-03.webp',1),
('assets/scenes/c01-02.webp',1),
('assets/scenes/c04-00.webp',4),
('assets/scenes/c04-01.webp',4),
('assets/scenes/c04-02.webp',4),
('assets/scenes/c04-03.webp',4),
('assets/scenes/c04-04.webp',4),
('assets/scenes/c04-05.webp',4),
('assets/scenes/c09-00.webp',9),
('assets/scenes/c09-01.webp',9),
('assets/scenes/c09-02.webp',9),
('assets/scenes/c09-03.webp',9),
('assets/scenes/c09-04.webp',9),
('assets/scenes/c09-05.webp',9),
('assets/scenes/c09-06.webp',9)
on conflict (file) do update set chapter=excluded.chapter;
