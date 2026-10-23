// 게임 카탈로그(단일 출처). 서버 표(portrait_catalog·journey_steps·title_catalog)는 scripts/gen-portrait-sql.ts로 이 파일에서 만든다.
// 값은 기본값이며 실제 플레이 후 조정한다.

// 초상화 티어: 신화 속 위상(인물 데이터의 분류)으로 나눈다. 물건(art)·무리(grp)는 초상화가 아니다.
export const TIERS = [
  { tier: 1, name: '인간·님프', price: 20, cats: ['mor', 'nym'] },
  { tier: 2, name: '영웅·괴물', price: 60, cats: ['her', 'mon'] },
  { tier: 3, name: '신·티탄', price: 150, cats: ['god', 'tit'] },
  { tier: 4, name: '올림포스·태초신', price: 400, cats: ['oly', 'pri'] },
] as const;
// 보물(물건 그림)은 티어 없이 하나 값
export const TREASURE_PRICE = 10;
export const STORY_EVERY = 5; // 이야기책: 1장은 처음부터, 이후 끝낸 판 수 5판마다 한 장(칭호「이야기꾼」은 4판)
export const chapterOpen = (n: number, completed: number, every = STORY_EVERY) => completed >= (n - 1) * every;
export const tierOfCat = (cat: string) => TIERS.find((t) => (t.cats as readonly string[]).includes(cat))?.tier ?? null;

// 칭호: 조건(stat이 need에 닿으면 서버가 자동으로 줌, 0014_titles_skills.sql과 같아야 함)과 스킬(달고 있는 칭호 하나만 켜짐)
// 스킬로 더 받는 별빛은 지갑에만 들어가고 순위 점수·기록에는 들어가지 않는다.
export type TitleStat = 'portraits' | 'treasures' | 'best_9e' | 'best_9m' | 'best_9h' | 'completed' | 'reads' | 'no_hint' | 'boards' | 'streak' | 'reactions';
export interface Title { id: string; name: string; group: string; stat?: TitleStat; need?: number; cond: string; skill: string }
export const TITLES: Title[] = [
  { id: 'apprentice', name: '스도쿠 수습생', group: '여정', cond: '여정 8판', skill: '하루 첫 판을 끝내면 별빛 +2' },
  { id: 'explorer', name: '미궁 탐험가', group: '여정', cond: '여정 25판', skill: '한 판에 쓸 수 있는 힌트 11번' },
  { id: 'sage', name: '올림포스의 현자', group: '여정', cond: '여정 70판', skill: '그 판의 첫 힌트는 별빛이 깎이지 않음(기록에는 안 들어감)' },
  { id: 'col10', name: '초상화 수집가', group: '초상화 수집', stat: 'portraits', need: 10, cond: '초상화 10장', skill: '초상화 살 때 별빛 2% 덜 냄' },
  { id: 'col30', name: '신전 화가', group: '초상화 수집', stat: 'portraits', need: 30, cond: '초상화 30장', skill: '초상화 살 때 별빛 4% 덜 냄' },
  { id: 'col60', name: '전당 관리인', group: '초상화 수집', stat: 'portraits', need: 60, cond: '초상화 60장', skill: '초상화 살 때 별빛 6% 덜 냄' },
  { id: 'col120', name: '올림포스 사관', group: '초상화 수집', stat: 'portraits', need: 120, cond: '초상화 120장', skill: '초상화 살 때 별빛 8% 덜 냄' },
  { id: 'col200', name: '신들의 기록관', group: '초상화 수집', stat: 'portraits', need: 200, cond: '초상화 200장', skill: '초상화 살 때 별빛 10% 덜 냄' },
  { id: 'col390', name: '모든 얼굴을 아는 자', group: '초상화 수집', stat: 'portraits', need: 390, cond: '초상화 390장', skill: '초상화 살 때 별빛 12% 덜 냄' },
  { id: 'tr5', name: '보물 사냥꾼', group: '보물 수집', stat: 'treasures', need: 5, cond: '보물 5개', skill: '보물 값 10 → 9' },
  { id: 'tr15', name: '아르고 선원', group: '보물 수집', stat: 'treasures', need: 15, cond: '보물 15개', skill: '보물 값 10 → 8' },
  { id: 'tr30', name: '보물창고지기', group: '보물 수집', stat: 'treasures', need: 30, cond: '보물 30개', skill: '보물 값 10 → 7' },
  { id: 'tr64', name: '헤파이스토스의 제자', group: '보물 수집', stat: 'treasures', need: 64, cond: '보물 64개', skill: '판을 끝낼 때마다 별빛 +2' },
  { id: 'fast9e', name: '날랜 발', group: '빠르기', stat: 'best_9e', need: 360, cond: '9×9 쉬움을 힌트 없이 6분 안에', skill: '자기 기록을 깨면 별빛 +5' },
  { id: 'fast9m', name: '바람의 전령', group: '빠르기', stat: 'best_9m', need: 600, cond: '9×9 보통을 힌트 없이 10분 안에', skill: '자기 기록을 깨면 별빛 +8' },
  { id: 'fast9h', name: '번개의 화살', group: '빠르기', stat: 'best_9h', need: 900, cond: '9×9 어려움을 힌트 없이 15분 안에', skill: '자기 기록을 깨면 별빛 +12' },
  { id: 'play100', name: '끈기의 영웅', group: '끝낸 판', stat: 'completed', need: 100, cond: '100판 끝내기', skill: '하루 첫 판 별빛 +4' },
  { id: 'play150', name: '헤라클레스의 후예', group: '끝낸 판', stat: 'completed', need: 150, cond: '150판 끝내기', skill: '하루 첫 판 별빛 +6' },
  { id: 'play200', name: '미궁의 주인', group: '끝낸 판', stat: 'completed', need: 200, cond: '200판 끝내기', skill: '하루 첫 판 별빛 +8' },
  { id: 'play300', name: '시간을 다스리는 자', group: '끝낸 판', stat: 'completed', need: 300, cond: '300판 끝내기', skill: '하루 첫 판 별빛 +10' },
  { id: 'play500', name: '영원의 수호자', group: '끝낸 판', stat: 'completed', need: 500, cond: '500판 끝내기', skill: '하루 첫 판 별빛 +12' },
  { id: 'read4', name: '이야기꾼', group: '이야기책', stat: 'reads', need: 4, cond: '이야기책 4장 읽기', skill: '이야기책이 4판마다 한 장씩 열림' },
  { id: 'read8', name: '음유시인', group: '이야기책', stat: 'reads', need: 8, cond: '이야기책 8장 읽기', skill: '선물 상자에서 넷 중에 고름' },
  { id: 'read16', name: '무사이의 친구', group: '이야기책', stat: 'reads', need: 16, cond: '이야기책 16장 모두 읽기', skill: '선물 상자를 하루 한 번 다시 뽑기' },
  { id: 'wise30', name: '지혜의 눈', group: '그 밖', stat: 'no_hint', need: 30, cond: '힌트 없이 30판 끝내기', skill: '그 판의 첫 힌트는 별빛이 깎이지 않음(기록에는 안 들어감)' },
  { id: 'five', name: '은하수의 방랑자', group: '그 밖', stat: 'boards', need: 5, cond: '다섯 난이도를 모두 한 판 이상', skill: '최상위 난이도「신화」(대각선 스도쿠)가 열림' },
  { id: 'streak7', name: '성실한 순례자', group: '그 밖', stat: 'streak', need: 7, cond: '7일 내리 하루 한 판 이상', skill: '하루 첫 판 별빛 +5' },
  { id: 'kind30', name: '다정한 이웃', group: '그 밖', stat: 'reactions', need: 30, cond: '친구 소식에 이모티콘 30번', skill: '이모티콘 4종 더(🍀🦉⚡🏛️)' },
];
export const TITLE_NAME: Record<string, string> = Object.fromEntries(TITLES.map((t) => [t.id, t.name]));

// 여정: 끝낸 판 수(need)에 닿으면 보상. gift=그 티어 초상화 셋 중 하나 무료, tier=티어 열림, bonus=별빛, title=칭호
export interface JourneyReward { gift?: number; tier?: number; bonus?: number; title?: string; collection?: string }
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
  if (r.collection) out.push(r.collection);
  return out.join(', ');
}

export const REWARD_RULES: { size: number; difficulty: string; amount: number }[] = [
  { size: 4, difficulty: 'intro', amount: 10 },
  { size: 6, difficulty: 'intro', amount: 20 },
  { size: 9, difficulty: 'easy', amount: 30 },
  { size: 9, difficulty: 'medium', amount: 40 },
  { size: 9, difficulty: 'hard', amount: 50 },
  { size: 9, difficulty: 'diag', amount: 60 }, // 신화: 칭호「은하수의 방랑자」를 단 사람만
];

// 힌트: 한 판에 10번까지(칭호「미궁 탐험가」는 11번), 한 번마다 완료 보상 10%씩 줄어듦(서버와 같아야 함)
export const HINT_MAX = 10;
export const hintMax = (title: string) => (title === 'explorer' ? 11 : HINT_MAX);
export const freeFirstHint = (title: string) => title === 'sage' || title === 'wise30';
export const storyEvery = (title: string) => (title === 'read4' ? 4 : STORY_EVERY);
// 칭호 할인을 넣은 가격(서버 private.price_for와 같아야 함)
export function priceFor(tier: number, base: number, title: string) {
  if (tier === 0) return ({ tr5: 9, tr15: 8, tr30: 7 } as Record<string, number>)[title] ?? base;
  const pct = ({ col10: 2, col30: 4, col60: 6, col120: 8, col200: 10, col390: 12 } as Record<string, number>)[title] ?? 0;
  return base - Math.floor((base * pct) / 100);
}

export const BOARDS = [
  { id: 'all', label: '통합' },
  { id: '4', label: '4×4' },
  { id: '6', label: '6×6' },
  { id: '9e', label: '9×9 쉬움' },
  { id: '9m', label: '9×9 보통' },
  { id: '9h', label: '9×9 어려움' },
  { id: '9d', label: '9×9 신화' }, // 칭호「은하수의 방랑자」를 단 사람에게만 보임
] as const;
export const DIAG_RULE = '두 대각선에도 1~9가 한 번씩 들어가요.';
export const DIFF_KO: Record<string, string> = { intro: '입문', easy: '쉬움', medium: '보통', hard: '어려움', diag: '신화' };
export const boardName = (size: number, difficulty: string) => `${size}×${size}${difficulty === 'intro' ? '' : ` ${DIFF_KO[difficulty]}`}`;

// 친구 소식 이모티콘(서버 set_reaction의 목록과 같아야 함)
export const EMOJIS = ['👍', '❤️', '👏', '🎉', '😆', '😮', '🔥', '🌟'];
export const EXTRA_EMOJIS = ['🍀', '🦉', '⚡', '🏛️']; // 칭호「다정한 이웃」
export const emojisFor = (title: string) => (title === 'kind30' ? [...EMOJIS, ...EXTRA_EMOJIS] : EMOJIS);

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
