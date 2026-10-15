// 게임 카탈로그(단일 출처). 서버 표(item_catalog 등)는 scripts/gen-catalog-sql.ts로 이 파일에서 만든다.
// 가격·보상·해금 단계는 명세의 권장 기본값이며 실제 플레이 후 조정한다.

export type Surface = 'floor' | 'rug' | 'wallRight' | 'supportSlot' | 'artifact';
export type Space = 'room' | 'garden';

export interface Item {
  id: string;
  kind: 'furniture' | 'treasure';
  nameKo: string;
  price: number;
  surface: Surface;
  fw: number; // 논리 격자 가로(u, 뒤→오른쪽 모서리 방향)
  fh: number; // 논리 격자 세로(v, 뒤→왼쪽 모서리 방향)
  blocking: boolean;
  spaces: Space[];
  supports?: string[];
  unlockStep: number;
  interaction: string;
  desc: string;
  sourceId?: string; // 기존 보물 원본 ID(greek-myth-map portraits)
}

const F = (id: string, nameKo: string, price: number, surface: Surface, fw: number, fh: number, blocking: boolean,
  spaces: Space[], unlockStep: number, interaction: string, desc: string, supports?: string[]): Item =>
  ({ id, kind: 'furniture', nameKo, price, surface, fw, fh, blocking, spaces, unlockStep, interaction, desc, supports });
const T = (id: string, nameKo: string, unlockStep: number, interaction: string, desc: string): Item =>
  ({ id, kind: 'treasure', nameKo, price: 120, surface: 'artifact', fw: 1, fh: 1, blocking: false, spaces: ['room', 'garden'], unlockStep, interaction, desc, sourceId: id });

const BOTH: Space[] = ['room', 'garden'];
export const ITEMS: Item[] = [
  F('cloud_bed', '구름 침대', 60, 'floor', 3, 2, true, ['room'], 3, 'bed_bounce', '눌러 보면 폭신하게 눌렸다 돌아와요.'),
  F('cloud_cushion', '구름 쿠션', 20, 'floor', 1, 1, true, BOTH, 0, 'cushion_squish', '말랑말랑한 구름 쿠션.'),
  F('display_pedestal', '보물 받침대', 60, 'floor', 1, 1, true, BOTH, 0, 'exhibit_panel', '보물을 하나 올려 전시해요.', ['artifact']),
  F('garden_trellis', '꽃 아치', 60, 'floor', 3, 1, true, ['garden'], 5, 'flower_glimmer', '등나무 꽃이 핀 아치.'),
  F('laurel_bench', '월계수 벤치', 60, 'floor', 1, 3, true, BOTH, 0, 'bench_bounce', '앉으면 별빛이 반짝.'),
  F('laurel_door', '월계수 문', 60, 'wallRight', 2, 1, false, ['room'], 0, 'door_chime', '문을 두드리면 친구 집 목록이 열려요.'),
  F('laurel_rug', '월계수 러그', 60, 'rug', 3, 2, false, ['room'], 0, 'soft_sparkle', '월계수 무늬를 따라 빛이 돌아요.'),
  F('linen_curtain', '리넨 커튼', 60, 'wallRight', 2, 1, false, ['room'], 3, 'curtain_glimmer', '커튼 사이로 햇살이 들어와요.'),
  F('music_stand', '악보대', 60, 'floor', 1, 1, true, BOTH, 2, 'music_select', '배경음악을 켜고 끄고 크기를 정해요.'),
  F('olive_planter', '올리브 화분', 20, 'floor', 1, 1, true, BOTH, 0, 'leaf_rustle', '잎이 바스락.'),
  F('owl_mailbox', '올빼미 우편함', 60, 'floor', 1, 1, true, BOTH, 0, 'mail_panel', '방명록을 읽고 남겨요.'),
  F('picture_frame', '신화 액자', 20, 'supportSlot', 1, 1, false, ['room'], 7, 'gallery', '찻상 위에 세워 두고 신화 그림을 전시해요.'),
  F('round_stool', '둥근 의자', 20, 'floor', 1, 1, true, BOTH, 0, 'stool_bounce', '통통 튀는 의자.'),
  F('scroll_bookcase', '두루마리 책장', 60, 'floor', 2, 1, true, ['room'], 4, 'open_story', '열린 신화 이야기를 읽어요.'),
  F('shell_fountain', '조개 분수', 60, 'floor', 3, 3, true, ['garden'], 8, 'water_ripple', '물결이 퍼져요.'),
  F('star_lantern', '별빛 등불', 20, 'floor', 1, 1, true, BOTH, 0, 'light_toggle', '눌러서 켜고 꺼요.'),
  F('star_mobile', '별 모빌', 60, 'floor', 1, 1, true, ['room'], 8, 'mobile_chime', '세 음이 차례로 울려요.'),
  F('stepping_stones', '정원 디딤돌', 20, 'floor', 3, 1, true, ['garden'], 0, 'path_steps', '디딤돌이 차례로 빛나요.'),
  F('tea_table', '찻상', 60, 'floor', 2, 2, true, BOTH, 0, 'steam', '찻주전자에서 김이 올라요. 위에 액자를 올릴 수 있어요.', ['picture_frame']),
  F('treasure_chest', '보물 상자', 60, 'floor', 2, 1, true, BOTH, 0, 'treasure_panel', '모은 보물을 구경해요.'),
  // 기존 보물 10종(정면 그림 → 받침대 위 전시)
  T('lyre', '작은 리라', 3, 'lyre_play', '확대창에서 일곱 줄을 튕겨 연주해요.'),
  T('psyche_lamp', '프시케의 등불', 6, 'lamp_glow', '불빛을 켜고 끄면 작은 빛 알갱이가 날려요.'),
  T('cornucopia', '풍요의 뿔', 6, 'harvest_burst', '과일과 꽃 모양 반짝임이 잠깐 피어나요.'),
  T('olive_tree', '아테나의 올리브 나무', 6, 'olive_glint', '잎 사이로 빛 점이 반짝여요.'),
  T('wind_bag', '바람 자루', 9, 'wind_gust', '바람이 휙 지나가요.'),
  T('golden_fleece', '황금 양털', 9, 'golden_shimmer', '금빛 물결이 스쳐 가요.'),
  T('mirror_shield', '거울 방패', 9, 'mirror_pick', '고른 인물이 거울에 비쳐요.'),
  T('ariadne_thread', '아리아드네의 실타래', 10, 'thread_stars', '실로 별을 순서대로 이어 보세요.'),
  T('ariadne_crown', '아리아드네의 왕관', 11, 'crown_constellation', '왕관 위로 별자리가 떠올라요.'),
  T('pandora_jar', '판도라의 항아리', 11, 'hope_light', '항아리 주위에 희망의 빛이 감돌아요.'),
];
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const FIRST_CHOICE = ['olive_planter', 'star_lantern', 'music_stand'];

export interface JourneyStep { step: number; title: string; desc: string; reward: { items?: Record<string, number>; unlock?: string[]; choice?: boolean } }
export const JOURNEY: JourneyStep[] = [
  { step: 1, title: '첫 별빛', desc: '장식 세 가지 중 하나를 골라요.', reward: { choice: true } },
  { step: 2, title: '아폴론의 노래', desc: '아폴론이 안내 친구로 와요. 악보대를 살 수 있어요.', reward: { unlock: ['guide:apollo'] } },
  { step: 3, title: '리라 선물', desc: '작은 리라를 받아요. 침대와 커튼을 살 수 있어요.', reward: { items: { lyre: 1 } } },
  { step: 4, title: '첫 이야기', desc: '「세상의 시작」을 읽을 수 있어요. 책장을 살 수 있어요.', reward: { unlock: ['chapter:1'] } },
  { step: 5, title: '아르테미스의 정원', desc: '아르테미스가 안내 친구로 와요. 꽃 아치를 살 수 있어요.', reward: { unlock: ['guide:artemis'] } },
  { step: 6, title: '보물 진열실', desc: '등불·풍요의 뿔·올리브 나무를 살 수 있어요.', reward: {} },
  { step: 7, title: '그림 액자', desc: '「올림포스의 신들」과 신화 액자를 받아요.', reward: { unlock: ['chapter:4'], items: { picture_frame: 1 } } },
  { step: 8, title: '반짝이는 물', desc: '조개 분수와 별 모빌을 살 수 있어요.', reward: {} },
  { step: 9, title: '영웅의 보물', desc: '바람 자루·황금 양털·거울 방패를 살 수 있어요.', reward: {} },
  { step: 10, title: '미궁의 실', desc: '「크레타의 미궁」을 읽고 실타래를 살 수 있어요.', reward: { unlock: ['chapter:9'] } },
  { step: 11, title: '별의 왕관', desc: '왕관과 판도라의 항아리를 살 수 있어요.', reward: {} },
  { step: 12, title: '올림포스 정원사', desc: '정원사 배지와 별 모빌을 받아요.', reward: { unlock: ['badge:gardener'], items: { star_mobile: 1 } } },
];

// 힌트: 한 판에 10번까지, 한 번마다 완료 보상 10%씩 줄어듦(서버 0007_hint_penalty.sql과 같아야 함)
export const HINT_MAX = 10;

export const REWARD_RULES: { size: number; difficulty: string; amount: number }[] = [
  { size: 4, difficulty: 'intro', amount: 10 },
  { size: 6, difficulty: 'intro', amount: 20 },
  { size: 9, difficulty: 'easy', amount: 30 },
  { size: 9, difficulty: 'medium', amount: 40 },
  { size: 9, difficulty: 'hard', amount: 50 },
];

// 안내 친구(게임 속 역할 배정이며 원전 설명과 구분)
export const GUIDES = [
  { id: 'hestia', name: '헤스티아', role: '집 안내', line: '어서 와. 따뜻한 집부터 둘러보자.' },
  { id: 'athena', name: '아테나', role: '퍼즐 안내', line: '천천히 생각하면 길이 보여.' },
  { id: 'apollo', name: '아폴론', role: '음악·전시', line: '오늘은 어떤 노래를 틀어 볼까?' },
  { id: 'artemis', name: '아르테미스', role: '정원', line: '정원에 별빛이 내려앉았어.' },
];

export const AVATARS = ['hestia', 'athena', 'apollo', 'artemis', 'hermes', 'persephone', 'pegasus', 'iris', 'nike', 'pan', 'eros', 'demeter'];

export const STICKERS = [
  { id: 'star', label: '별', glyph: '★' },
  { id: 'heart', label: '하트', glyph: '♥' },
  { id: 'laurel', label: '월계수', glyph: '❦' },
  { id: 'sun', label: '해', glyph: '☀' },
  { id: 'moon', label: '달', glyph: '☾' },
  { id: 'flower', label: '꽃', glyph: '✿' },
];

// 배경음악 두 곡: 스도쿠 풀 때와 그 밖의 화면(Suno로 만든 곡, 끊김 없는 반복용으로 다듬음)
export const MUSIC = [
  { id: 'hearth_of_hestia', title: '헤스티아의 화로', scene: 'home' },
  { id: 'athenas_quiet_study', title: '아테나의 조용한 서재', scene: 'sudoku' },
];
export const BGM = { home: 'hearth_of_hestia', sudoku: 'athenas_quiet_study' } as const;
