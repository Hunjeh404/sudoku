// 게임 카탈로그(단일 출처). 서버 표(portrait_catalog·journey_steps·title_catalog)는 scripts/gen-portrait-sql.ts로 이 파일에서 만든다.
// 값은 기본값이며 실제 플레이 후 조정한다.

// 초상화 티어: 신화 속 위상(인물 데이터의 분류)으로 나눈다. 물건(art)·무리(grp)는 초상화가 아니다.
export const TIERS = [
  { tier: 1, name: '인간·님프', price: 20, cats: ['mor', 'nym'] },
  { tier: 2, name: '영웅·괴물', price: 60, cats: ['her', 'mon'] },
  { tier: 3, name: '신·티탄', price: 150, cats: ['god', 'tit'] },
  { tier: 4, name: '올림포스·태초신', price: 400, cats: ['oly', 'pri'] },
] as const;
export const tierOfCat = (cat: string) => TIERS.find((t) => (t.cats as readonly string[]).includes(cat))?.tier ?? null;

export const TITLES: { id: string; name: string }[] = [
  { id: 'apprentice', name: '스도쿠 수습생' },
  { id: 'explorer', name: '미궁 탐험가' },
  { id: 'sage', name: '올림포스의 현자' },
];
export const TITLE_NAME: Record<string, string> = Object.fromEntries(TITLES.map((t) => [t.id, t.name]));

// 여정: 끝낸 판 수(need)에 닿으면 보상. gift=그 티어 초상화 셋 중 하나 무료, tier=티어 열림, bonus=별빛, title=칭호
export interface JourneyReward { gift?: number; tier?: number; bonus?: number; title?: string }
export interface JourneyStep { step: number; need: number; title: string; reward: JourneyReward }
export const JOURNEY: JourneyStep[] = [
  { step: 1, need: 1, title: '첫 초상화', reward: { gift: 1 } },
  { step: 2, need: 3, title: '별빛 주머니', reward: { bonus: 30 } },
  { step: 3, need: 5, title: '영웅의 문', reward: { tier: 2 } },
  { step: 4, need: 8, title: '수습생', reward: { title: 'apprentice' } },
  { step: 5, need: 12, title: '영웅의 선물', reward: { gift: 2 } },
  { step: 6, need: 16, title: '큰 별빛 주머니', reward: { bonus: 80 } },
  { step: 7, need: 20, title: '신들의 문', reward: { tier: 3 } },
  { step: 8, need: 25, title: '미궁 탐험', reward: { title: 'explorer' } },
  { step: 9, need: 30, title: '신의 선물', reward: { gift: 3 } },
  { step: 10, need: 40, title: '별빛 보물 상자', reward: { bonus: 200 } },
  { step: 11, need: 50, title: '올림포스의 문', reward: { tier: 4 } },
  { step: 12, need: 70, title: '올림포스의 현자', reward: { title: 'sage', gift: 4 } },
];
export function rewardText(r: JourneyReward) {
  const out: string[] = [];
  if (r.gift) out.push(`${r.gift}티어 초상화 선물`);
  if (r.tier) out.push(`${r.tier}티어 초상화 상점 열림`);
  if (r.bonus) out.push(`별빛 ${r.bonus}`);
  if (r.title) out.push(`칭호「${TITLE_NAME[r.title]}」`);
  return out.join(', ');
}

export const REWARD_RULES: { size: number; difficulty: string; amount: number }[] = [
  { size: 4, difficulty: 'intro', amount: 10 },
  { size: 6, difficulty: 'intro', amount: 20 },
  { size: 9, difficulty: 'easy', amount: 30 },
  { size: 9, difficulty: 'medium', amount: 40 },
  { size: 9, difficulty: 'hard', amount: 50 },
];

// 힌트: 한 판에 10번까지, 한 번마다 완료 보상 10%씩 줄어듦(서버 0007_hint_penalty.sql과 같아야 함)
export const HINT_MAX = 10;

export const BOARDS = [
  { id: 'all', label: '통합' },
  { id: '4', label: '4×4' },
  { id: '6', label: '6×6' },
  { id: '9e', label: '9×9 쉬움' },
  { id: '9m', label: '9×9 보통' },
  { id: '9h', label: '9×9 어려움' },
] as const;
export const DIFF_KO: Record<string, string> = { intro: '입문', easy: '쉬움', medium: '보통', hard: '어려움' };
export const boardName = (size: number, difficulty: string) => `${size}×${size}${difficulty === 'intro' ? '' : ` ${DIFF_KO[difficulty]}`}`;

// 친구 소식 이모티콘(서버 set_reaction의 목록과 같아야 함)
export const EMOJIS = ['👍', '❤️', '👏', '🎉', '😆', '😮', '🔥', '🌟'];

// 안내 친구(게임 속 역할 배정이며 원전 설명과 구분)
export const GUIDES = [
  { id: 'hestia', name: '헤스티아', role: '첫 화면 안내', line: '어서 오세요. 오늘도 한 판 풀어 볼까요?' },
  { id: 'athena', name: '아테나', role: '퍼즐 안내', line: '천천히 생각하면 길이 보여요.' },
];

// 배경음악 두 곡: 스도쿠 풀 때와 그 밖의 화면(Suno로 만든 곡, 끊김 없는 반복용으로 다듬음)
export const MUSIC = [
  { id: 'hearth_of_hestia', title: '헤스티아의 화로', scene: 'home' },
  { id: 'athenas_quiet_study', title: '아테나의 조용한 서재', scene: 'sudoku' },
];
export const BGM = { home: 'hearth_of_hestia', sudoku: 'athenas_quiet_study' } as const;
