// 보물 꾸밈효과(스도쿠 화면 배경)와 4티어 초상화 테마판.
// 보물: 이야기책에 그 보물 장면이 있으면 그 그림을 화면 위·아래에 나눠 깐다.
//       그림이 없는 보물은 아래 숫자 버튼(금화)을 그 보물 모양으로 바꾼다.
//       버튼 그림(assets/coins/<id>.webp, <id>_memo.webp)이 오기 전까지는 색으로 만든 임시 동전을 쓴다(COIN_ART에 없는 것).
// 4티어: 내 초상화로 쓰면 판의 색·선·구역마다 옅은 상징 무늬가 바뀐다.

import { josa } from '../lib/josa';
import TIER_MAP from './tiers.json';

// 숫자 버튼 모양: 이름, 그림 지시 내용, 임시 동전 색(바탕·테두리·숫자)
export interface Coin { name: string; draw: string; base: string; rim: string; text: string }

export interface TreasureFx {
  text: string; // 도감에 보여 줄 한 줄
  scene?: string; // 이야기책 그림(assets/scenes/<scene>.webp)
  bg?: string; // 그림을 깔 때 화면 바탕색
  coin?: Coin; // 그림이 없는 보물의 숫자 버튼
}

const scene = (id: string, bg: string, what: string): TreasureFx => ({ scene: id, bg, text: `이야기책의 「${what}」 그림이 스도쿠 화면 위아래에 펼쳐져요.` });

const coin = (name: string, draw: string, base: string, rim: string, text: string): TreasureFx =>
  ({ coin: { name, draw, base, rim, text }, text: `숫자 버튼이 ${josa(name, '으로/로')} 바뀌어요.` });

export const TREASURE_FX: Record<string, TreasureFx> = {
  // 이야기책 그림이 있는 보물
  harpe: scene('c02-01', '#F1E6C8', '가이아가 크로노스에게 낫을 건네는 장면'),
  omphalos: scene('c02-03', '#EDE6EE', '레아가 포대기에 싼 돌을 건네는 장면'),
  cornucopia: scene('c02-04', '#E8EEDF', '크레타 동굴에서 아기 제우스를 돌보는 장면'),
  thunderbolt: scene('c03-02', '#F4DFC8', '키클롭스가 번개를 만들어 주는 장면'),
  trident: scene('c04-01', '#E2E3F0', '세 형제가 하늘·바다·저승을 나누는 장면'),
  olive_tree: scene('c04-05', '#E3ECF1', '아테나와 포세이돈의 선물 대결'),
  caduceus: scene('c04-04', '#E9EDDA', '아기 헤르메스가 소 떼를 몰고 가는 장면'),
  fennel_fire: scene('c05-02', '#F3E2D8', '회향 줄기에 불씨를 숨겨 오는 장면'),
  pandora_jar: scene('c05-03', '#F1E0D0', '판도라가 항아리를 여는 장면'),
  deucalion_ark: scene('c05-04', '#DCE7EF', '대홍수 위의 작은 방주'),
  pomegranate: scene('c06-01', '#F2E6EA', '꽃밭의 페르세포네와 석류'),
  arachne_loom: scene('c06-02', '#E6E8EF', '아라크네와 아테나의 베 짜기 대결'),
  sun_chariot: scene('c06-05', '#F8EBCB', '태양 마차를 모는 파에톤'),
  psyche_lamp: scene('c07-01', '#E9E2F0', '등불을 든 프시케'),
  lyre: scene('c07-03', '#E4DEEE', '저승에서 리라를 켜는 오르페우스'),
  ivory_statue: scene('c07-05', '#F3EEE4', '조각상이 사람이 되는 장면'),
  graiai_eye: scene('c08-03', '#E8E4EE', '그라이아이의 눈을 가로채는 장면'),
  mirror_shield: scene('c08-04', '#E9E3EC', '방패 거울로 메두사를 보는 장면'),
  talaria: scene('c08-05', '#DDEBF2', '날개 샌들로 날아온 페르세우스'),
  golden_bridle: scene('c08-06', '#E6EEDC', '황금 굴레로 페가소스를 길들이는 장면'),
  ariadne_thread: scene('c09-03', '#F1E1DC', '아리아드네가 실타래를 건네는 장면'),
  daedalus_wings: scene('c09-05', '#DFEAF3', '하늘을 나는 다이달로스와 이카로스'),
  black_sail: scene('c09-06', '#F3E6D8', '검은 돛을 바라보는 아이게우스'),
  lion_pelt: scene('c10-02', '#F2E5CC', '네메아의 사자와 씨름'),
  heracles_club: scene('c10-03', '#E1EAE8', '몽둥이로 히드라와 싸우는 장면'),
  hesperides_apples: scene('c10-04', '#E6E4EE', '헤라클레스가 아틀라스 대신 하늘을 드는 장면'),
  ambrosia: scene('c10-06', '#F4EAD6', '올림포스의 결혼 잔치'),
  dragon_teeth: scene('c11-01', '#EAE8DA', '카드모스가 용의 이빨을 뿌리는 장면'),
  harmonia_necklace: scene('c11-02', '#F1E6DA', '카드모스와 하르모니아의 결혼 잔치'),
  golden_fleece: scene('c12-01', '#E1EAF0', '황금 양을 타고 바다를 건너는 남매'),
  jason_sandal: scene('c12-02', '#E6E6EF', '샌들 한 짝만 신고 나타난 이아손'),
  argo: scene('c12-03', '#DCE7EE', '아르고호의 출항'),
  boar_hide: scene('c13-01', '#E4EAD9', '칼리돈의 멧돼지 사냥'),
  race_apples: scene('c13-02', '#F2E6E6', '황금 사과를 굴리며 달리는 경주'),
  discord_apple: scene('c14-01', '#E6E8EE', '결혼식장에 황금 사과를 굴리는 에리스'),
  achilles_armor: scene('c15-03', '#EFE7DA', '아킬레우스와 헥토르의 대결'),
  trojan_horse: scene('c15-05', '#EEE6D8', '트로이 목마'),
  moly: scene('c16-02', '#ECE5EE', '돼지로 변한 부하들과 키르케'),
  penelope_shroud: scene('c16-06', '#E4E5EE', '베를 짜고 몰래 푸는 페넬로페'),
  odysseus_bow: scene('c16-07', '#E8EAEE', '활시위를 당기는 오디세우스'),

  // 그림이 없는 보물: 숫자 버튼
  aegis: coin('은빛 방패 동전', '은빛 둥근 방패. 가장자리에 작은 비늘 무늬 띠, 가운데는 매끈하게 비워 숫자 자리', '#C9D0D8', '#8D9AA8', '#2E3640'),
  helm_darkness: coin('어둠의 투구 동전', '짙은 흑철색 원반. 가장자리에 연기처럼 번지는 그림자 띠, 투구 볏 모양 작은 장식 하나', '#5E566E', '#3B3348', '#F1ECF8'),
  eros_arrows: coin('사랑의 화살 동전', '분홍 원반. 가장자리에 금화살과 납화살이 X자로 겹친 장식, 테두리 작은 하트 점', '#F4C3CF', '#D98AA0', '#6A2E40'),
  cestus: coin('장미 띠 동전', '장미 꽃잎 빛 원반. 리본 띠가 둥글게 감싼 테두리, 작은 장미 두 송이', '#F2C9C4', '#C98A8A', '#6B2E3A'),
  thyrsus: coin('포도 덩굴 동전', '연보라 원반. 포도 덩굴과 잎이 둥글게 감은 테두리, 아래쪽에 작은 포도송이', '#D9C6E2', '#7C9A5A', '#3E2448'),
  fate_thread: coin('운명의 실패 동전', '금실이 감긴 둥근 실패를 위에서 본 모양. 테두리에 실이 몇 바퀴 감긴 결', '#F0DFA8', '#C9A43A', '#4A3A1E'),
  asclepius_rod: coin('치유의 지팡이 동전', '연초록 원반. 테두리에 뱀 한 마리가 둥글게 감긴 장식(무섭지 않게), 작은 약초 잎', '#CDE3C8', '#6E9A6E', '#24402A'),
  twin_bows: coin('해와 달 동전', '왼쪽 반은 금빛 해, 오른쪽 반은 은빛 달로 나뉜 원반. 테두리에 작은 활 두 개', '#EED9A0', '#A9B6C6', '#3A3739'),
  golden_throne: coin('공작 옥좌 동전', '청록 원반에 금 테두리. 테두리에 공작 깃털 눈 무늬가 둘러 박힘', '#A8D5CE', '#D9B44A', '#1F3534'),
  pan_pipes: coin('갈대 피리 동전', '밝은 나무 원반. 테두리에 길이가 다른 갈대 피리가 부채꼴로 새겨짐', '#E2D3A8', '#8BA86A', '#3E3A1E'),
  athena_aulos: coin('아테나의 피리 동전', '연보라 원반. 테두리에 쌍피리 두 개와 올빼미 깃털 장식', '#DCD3E8', '#7E8F6A', '#3A2E4A'),
  ariadne_crown: coin('별 왕관 동전', '남색 밤하늘 원반. 위쪽 테두리에 일곱 별이 왕관처럼 반원으로 박힘', '#3E4580', '#E8D9A8', '#F6E7A8'),
  heracles_bow: coin('영웅의 활 동전', '가죽과 청동이 섞인 원반. 테두리에 화살 깃 무늬가 줄지어 둘러짐', '#E3C9A6', '#A8714A', '#3E2416'),
  kibisis: coin('가죽 자루 동전', '끈으로 입구를 묶은 둥근 가죽 단추 모양. 테두리에 바느질 땀', '#CFAE86', '#7A5A3A', '#2E1E10'),
  aegeus_sword: coin('바위 칼 동전', '매끈한 회색 돌 원반. 테두리에 작은 칼자루와 샌들 문양', '#CFCAC0', '#8C867A', '#2E2C28'),
  pelian_spear: coin('물푸레나무 동전', '연한 나무 원반. 테두리에 물푸레나무 잎이 둥글게 엮임', '#D8E2C8', '#7C8F5A', '#2C3320'),
  palladium: coin('팔라디온 동전', '오래된 나뭇결 원반. 테두리에 작은 여신상 실루엣 문양 하나', '#E1C9A2', '#9C7A50', '#3A2816'),
  wind_bag: coin('바람 자루 동전', '하늘빛 원반. 테두리에 소용돌이 바람 무늬, 아래에 묶인 작은 자루', '#D3E6F2', '#8FB3CC', '#23384A'),
  charon_obol: coin('저승 은화', '빛바랜 저승 은화(오볼로스). 테두리에 잔잔한 강물 물결', '#C8D0D0', '#6E8486', '#1F2E30'),
  bronze_rattle: coin('청동 딸랑이 동전', '청동 원반. 테두리에 동심원 고리가 겹쳐 울리는 느낌', '#D9B074', '#8C6A2A', '#3A2810'),
  hippolyta_belt: coin('여왕의 버클 동전', '가죽 허리띠의 둥근 버클. 테두리에 금장식 징이 박힘', '#C79A6E', '#E2C25E', '#2E1A0E'),
  golden_cup: coin('황금 잔 동전', '노을빛 황금 잔을 위에서 본 둥근 모양. 테두리에 해살 무늬', '#F6C98A', '#E8925A', '#4A2410'),
  sisyphus_stone: coin('시시포스의 바위 동전', '둥글고 묵직한 회색 바위. 표면에 작은 금이 몇 줄', '#BDB6AA', '#8C867A', '#2E2C28'),
  beauty_box: coin('아름다움의 상자 동전', '연보라 보석함 뚜껑을 위에서 본 원형. 테두리에 진주 알이 둘러짐', '#E3D6F0', '#B6A0D6', '#3E2E5A'),
};

// 버튼 그림을 받은 보물(그림 파일: public/assets/coins/<id>.webp, <id>_memo.webp)
export const COIN_ART = new Set<string>([]);

export const MEMO_GUARD_TEXT = '보물을 달면 처음부터 있던 숫자와 겹치는 메모는 들어가지 않아요.';

// ---------- 4티어 테마판 ----------
export interface BoardTheme {
  name: string; text: string; dark?: boolean;
  art?: boolean; // 테두리·구역 상징 그림이 있는지(없으면 색만 바뀌고 기본 테두리)
  bg: string; line: string; box: string; entry: string; given: string; accent: string;
}

const T = (name: string, what: string, c: Omit<BoardTheme, 'name' | 'text'>): BoardTheme =>
  ({ name, text: `판이 ${name}으로 바뀌어요. 테두리가 바뀌고, 굵은 선 안 구역마다 ${what} 무늬가 옅게 들어가요.`, art: true, ...c });

export const BOARD_THEMES: Record<string, BoardTheme> = {
  chaos: T('소용돌이 판', '소용돌이', { dark: true, bg: '#2E2A36', line: '#4C445C', box: '#8A7BB0', entry: '#C7B8F0', given: '#F1ECF8', accent: '#9C8CC8' }),
  gaia: T('꽃피는 대지 판', '꽃', { bg: '#F3F0E2', line: '#D8D6B8', box: '#6E8A4A', entry: '#5F8A30', given: '#3D4A2E', accent: '#7FA36A' }),
  tartarus: T('청동 문 판', '청동 문', { dark: true, bg: '#2F2A26', line: '#4A4038', box: '#A87C3E', entry: '#E0AE6A', given: '#F2E6D3', accent: '#C08A44' }),
  eros: T('사랑의 판', '하트', { bg: '#FBEFF2', line: '#EED3DA', box: '#C77A90', entry: '#C2577A', given: '#4A2E36', accent: '#E68AA2' }),
  erebus: T('검은 안개 판', '안개 물결', { dark: true, bg: '#2C2D30', line: '#44464C', box: '#6E7380', entry: '#B4C0CE', given: '#EDEDED', accent: '#8A93A3' }),
  nyx: T('밤하늘 판', '달과 별', { dark: true, bg: '#1F2340', line: '#353A60', box: '#6E68A8', entry: '#C9B6FF', given: '#F3F0FF', accent: '#8E86D6' }),
  aether: T('빛나는 하늘 판', '반짝임', { bg: '#F0F7FB', line: '#D4E6EE', box: '#7DAFC4', entry: '#2F7FA0', given: '#2F4552', accent: '#8EC6E0' }),
  hemera: T('햇살 판', '해', { bg: '#FFF8E4', line: '#F0E2BC', box: '#D9A936', entry: '#B87A08', given: '#4A3A1E', accent: '#F2C14E' }),
  uranus: T('별 망토 판', '큰 별', { bg: '#E9EEF8', line: '#CED8EC', box: '#6C86C9', entry: '#3E5BA8', given: '#26324F', accent: '#6C86C9' }),
  pontus: T('파도 판', '파도', { bg: '#E6F3F4', line: '#C8E3E4', box: '#4FA3A8', entry: '#1F7A82', given: '#1F3E40', accent: '#4FA3A8' }),
  ourea: T('산봉우리 판', '봉우리', { bg: '#EFF0EA', line: '#D6D9CB', box: '#808C70', entry: '#5D6D48', given: '#33372D', accent: '#8C9A7A' }),
  chronos: T('모래시계 판', '모래시계', { bg: '#F4EEE2', line: '#E3D9C3', box: '#A88A54', entry: '#8A6C36', given: '#3E3526', accent: '#B59A6A' }),
  ananke: T('운명의 방추 판', '방추', { bg: '#ECEAF0', line: '#D6D3DE', box: '#847CA0', entry: '#5E5582', given: '#2E2B38', accent: '#8A82A0' }),
  phanes: T('세계알 판', '빛나는 알', { bg: '#FFF6E8', line: '#F2E1C2', box: '#DDA24A', entry: '#C47A2C', given: '#4A3420', accent: '#E7B04F' }),
  zeus: T('번개 판', '번개', { bg: '#EEF1F8', line: '#D3DAEA', box: '#4A63A0', entry: '#3B5AA0', given: '#263048', accent: '#E4B83A' }),
  hera: T('공작 깃털 판', '공작 깃털', { bg: '#EAF3F1', line: '#CDE3E0', box: '#3E8C88', entry: '#2F7A8C', given: '#1F3534', accent: '#2F8C8A' }),
  poseidon: T('삼지창 판', '삼지창', { bg: '#E4F0F7', line: '#C6DEEC', box: '#2F7FB0', entry: '#2268A0', given: '#18334A', accent: '#2F7FB0' }),
  demeter: T('밀 이삭 판', '밀 이삭', { bg: '#FBF4E0', line: '#EEE2BE', box: '#C99A38', entry: '#9A7420', given: '#45381C', accent: '#D9A93E' }),
  hestia: T('화덕 불 판', '불꽃', { bg: '#FFF1E6', line: '#F2D8C4', box: '#D9783E', entry: '#C2572A', given: '#4A2A1A', accent: '#E58A4A' }),
  hades: T('저승 석류 판', '석류', { dark: true, bg: '#2A2430', line: '#40384A', box: '#8A5A70', entry: '#E0A8C0', given: '#F0E8F2', accent: '#A0607E' }),
  athena: T('올빼미 판', '올빼미', { bg: '#EEF0EA', line: '#D6DACD', box: '#6F7F5E', entry: '#4F6A8A', given: '#2C3328', accent: '#7E8F6A' }),
  apollo: T('리라 판', '리라', { bg: '#FFF7E0', line: '#F0E3BA', box: '#D2A43A', entry: '#B07A12', given: '#3E321A', accent: '#E3B23C' }),
  artemis: T('은활 판', '활과 화살', { bg: '#EEF2F4', line: '#D6DEE4', box: '#8299AC', entry: '#4F7088', given: '#2A3440', accent: '#8FA6B8' }),
  ares: T('방패와 창 판', '방패', { bg: '#F6E8E4', line: '#EAD0C8', box: '#A85040', entry: '#A33E2A', given: '#3E1E18', accent: '#B5523E' }),
  aphrodite: T('조개껍데기 판', '조개', { bg: '#FCEFEF', line: '#F2D6DA', box: '#D88896', entry: '#C0607A', given: '#4A2A30', accent: '#E59AA8' }),
  hephaestus: T('대장간 판', '망치', { bg: '#F1EAE4', line: '#E0D2C6', box: '#8E5A3A', entry: '#8C4A24', given: '#33241C', accent: '#A8643A' }),
  hermes: T('날개 판', '날개', { bg: '#EEF3F6', line: '#D3E2E8', box: '#5F93A8', entry: '#3D7C96', given: '#263A44', accent: '#6FA3B8' }),
  dionysus: T('포도송이 판', '포도', { bg: '#F3EAF3', line: '#E3D2E3', box: '#8C5A8C', entry: '#7A3E86', given: '#34203A', accent: '#8C4E8C' }),
};

// 2·3티어 초상화를 쓰면 티어마다 같은 판(그림이 오면 art: true로 바꾸고 assets/themes/tier2_frame.webp 등을 넣는다)
export const TIER_THEMES: Record<string, BoardTheme> = {
  tier2: { name: '월계수 판', text: '2티어 초상화를 쓰면 스도쿠 판이 초록 월계수 판으로 바뀌어요.', art: false,
    bg: '#F2F4EA', line: '#D9DFC8', box: '#6F8A4E', entry: '#4F7A2E', given: '#2E3A24', accent: '#8FAF6A' },
  tier3: { name: '금빛 월계수 판', text: '3티어 초상화를 쓰면 스도쿠 판이 금빛 월계수 판으로 바뀌어요.', art: false,
    bg: '#FFF8E6', line: '#EFE0B8', box: '#B8913A', entry: '#A0700E', given: '#3E2E10', accent: '#E2B84A' },
};

// 내 초상화에 맞는 판: 4티어는 인물별, 2·3티어는 티어별, 1티어·빈칸은 기본 판
export function boardThemeFor(avatarId: string): { key: string; theme: BoardTheme } | null {
  const tier = (TIER_MAP as Record<string, number>)[avatarId];
  if (tier === 4 && BOARD_THEMES[avatarId]) return { key: avatarId, theme: BOARD_THEMES[avatarId] };
  if (tier === 2 || tier === 3) return { key: `tier${tier}`, theme: TIER_THEMES[`tier${tier}`] };
  return null;
}

// 판에 넣을 CSS 변수. 테두리·구역 상징 그림은 assets/themes/<key>_frame.webp, <key>_emblem.webp
export function themeVars(key: string, t: BoardTheme, base: string): Record<string, string> {
  const v: Record<string, string> = { '--t-bg': t.bg, '--t-line': t.line, '--t-box': t.box, '--t-entry': t.entry, '--t-given': t.given, '--t-accent': t.accent };
  if (t.art) { v['--t-emblem'] = `url(${base}assets/themes/${key}_emblem.webp)`; v['--t-frame'] = `url(${base}assets/themes/${key}_frame.webp)`; }
  return v;
}
