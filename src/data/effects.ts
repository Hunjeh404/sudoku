// 보물 꾸밈효과(스도쿠 화면 배경)와 4티어 초상화 테마판.
// 보물: 이야기책에 그 보물 장면이 있으면 그 그림을 화면 위·아래에 나눠 깔고, 없으면 코드로 그린 무늬를 깐다. 움직임은 없다.
// 4티어: 내 초상화로 쓰면 판의 색·선·구역마다 옅은 상징 무늬가 바뀐다.

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

export interface TreasureFx {
  text: string; // 도감에 보여 줄 한 줄
  bg: string; // 화면 바탕색
  scene?: string; // 이야기책 그림(assets/scenes/<scene>.webp)
  top?: string; // 코드 꾸밈: 위쪽 띠 background 값
  bottom?: string; // 코드 꾸밈: 아래쪽 띠 background 값
}

const scene = (id: string, bg: string, what: string): TreasureFx => ({ scene: id, bg, text: `이야기책의 「${what}」 그림이 화면 위아래에 펼쳐져요.` });

// 같은 무늬를 위아래에 쓰는 경우
const both = (text: string, bg: string, layer: string): TreasureFx => ({ text, bg, top: layer, bottom: layer });

const SCALES = svg(24, 14, "<path d='M0 14a12 12 0 0 1 24 0M-12 7a12 12 0 0 1 24 0M12 7a12 12 0 0 1 24 0' fill='none' stroke='#8D9AA8' stroke-width='1.3'/>");
const HEARTS = svg(64, 64, "<path d='M16 22c-4-6-12-2-8 5l8 7 8-7c4-7-4-11-8-5z' fill='#E7B44C' opacity='.75'/><path d='M48 50c-3-4.5-9-1.5-6 4l6 5 6-5c3-5.5-3-8.5-6-4z' fill='#8E8A92' opacity='.6'/>");
const ROSE_BAND = svg(80, 40, "<path d='M0 20q20-14 40 0t40 0' fill='none' stroke='#C98A8A' stroke-width='3'/><circle cx='20' cy='13' r='5' fill='#E5A3A8'/><circle cx='60' cy='27' r='5' fill='#E5A3A8'/><circle cx='20' cy='13' r='2' fill='#B8606E'/><circle cx='60' cy='27' r='2' fill='#B8606E'/>");
const GRAPES = svg(56, 52, "<path d='M0 8q14 8 28 0t28 0' fill='none' stroke='#7C9A5A' stroke-width='2'/><path d='M14 10l-6 8 8 2z' fill='#8FB070'/><g fill='#9C6BA8'><circle cx='38' cy='16' r='4'/><circle cx='46' cy='16' r='4'/><circle cx='42' cy='23' r='4'/><circle cx='34' cy='23' r='4'/><circle cx='50' cy='23' r='4'/><circle cx='38' cy='30' r='4'/><circle cx='46' cy='30' r='4'/><circle cx='42' cy='37' r='4'/></g>");
const THREAD = svg(160, 36, "<path d='M0 18c40-16 40 16 80 0s40-16 80 0' fill='none' stroke='#C9A43A' stroke-width='2'/><path d='M0 26c40-12 40 12 80 0s40-12 80 0' fill='none' stroke='#E2C877' stroke-width='1.2'/>");
const HERBS = svg(48, 48, "<path d='M12 40V20M12 28l-6-5M12 24l6-6' stroke='#6E9A6E' stroke-width='1.6' fill='none'/><ellipse cx='6' cy='22' rx='4' ry='2.2' fill='#93BE8E' transform='rotate(35 6 22)'/><ellipse cx='18' cy='17' rx='4' ry='2.2' fill='#93BE8E' transform='rotate(-40 18 17)'/><circle cx='36' cy='12' r='2' fill='#A9C9A0'/>");
const PEACOCK = svg(40, 48, "<ellipse cx='20' cy='24' rx='12' ry='16' fill='#7FBFB5' opacity='.55'/><ellipse cx='20' cy='26' rx='7' ry='9' fill='#3F7FA0' opacity='.7'/><ellipse cx='20' cy='27' rx='3.5' ry='4.5' fill='#D9B44A'/>");
const REEDS = svg(36, 120, "<g stroke='#8BA86A' stroke-width='3' stroke-linecap='round'><path d='M6 120V40'/><path d='M16 120V20'/><path d='M27 120V55'/></g><g fill='#A88A5A'><rect x='13.5' y='12' width='5' height='14' rx='2.5'/></g>");
const WAVES_SOUND = svg(90, 60, "<g fill='none' stroke='#9C8CB8' stroke-width='1.6'><path d='M10 30a10 10 0 0 1 0 0'/><path d='M14 20a12 12 0 0 1 0 20'/><path d='M22 12a20 20 0 0 1 0 36'/><path d='M30 4a28 28 0 0 1 0 52'/></g><circle cx='8' cy='30' r='3' fill='#7E8F6A'/>");
const STAR_DOTS = svg(70, 70, "<g fill='#F3E6B4'><circle cx='8' cy='12' r='1.4'/><circle cx='40' cy='6' r='1'/><circle cx='58' cy='30' r='1.6'/><circle cx='22' cy='44' r='1'/><circle cx='50' cy='58' r='1.2'/></g>");
const CROWN = svg(220, 90, "<g fill='#F6E7A8'><circle cx='30' cy='60' r='3'/><circle cx='60' cy='38' r='3.4'/><circle cx='95' cy='26' r='3'/><circle cx='125' cy='24' r='4.6'/><circle cx='155' cy='30' r='3'/><circle cx='182' cy='46' r='3.4'/><circle cx='200' cy='68' r='3'/></g>");
const FLETCH = svg(28, 28, "<path d='M4 18l10-8 10 8M4 26l10-8 10 8' fill='none' stroke='#A8714A' stroke-width='1.8'/>");
const STITCH = svg(40, 20, "<path d='M0 10h40' stroke='#7A5A3A' stroke-width='2' stroke-dasharray='6 5'/>");
const STONES = svg(80, 40, "<g fill='#B8B2A6'><rect x='2' y='8' width='34' height='14' rx='7'/><rect x='42' y='4' width='26' height='12' rx='6'/><rect x='18' y='26' width='30' height='12' rx='6'/><rect x='56' y='22' width='22' height='14' rx='7'/></g>");
const ASH = svg(60, 40, "<path d='M4 30q26-14 52-16' stroke='#7C8F5A' stroke-width='1.6' fill='none'/><g fill='#A5B887'><ellipse cx='16' cy='22' rx='5' ry='2.4' transform='rotate(-50 16 22)'/><ellipse cx='20' cy='28' rx='5' ry='2.4' transform='rotate(40 20 28)'/><ellipse cx='32' cy='17' rx='5' ry='2.4' transform='rotate(-50 32 17)'/><ellipse cx='36' cy='24' rx='5' ry='2.4' transform='rotate(40 36 24)'/><ellipse cx='50' cy='13' rx='5' ry='2.4' transform='rotate(-20 50 13)'/></g>");
const GRAIN = svg(120, 30, "<g fill='none' stroke='#C2A27E' stroke-width='1.2'><path d='M0 8c30-6 60 6 120 0'/><path d='M0 18c40 6 70-8 120 2'/><path d='M0 27c30-4 80 4 120-2'/></g>");
const SWIRL = svg(90, 60, "<g fill='none' stroke='#8FB3CC' stroke-width='1.8' stroke-linecap='round'><path d='M6 30h34c10 0 12-12 4-14s-10 8-4 8'/><path d='M50 46h30c8 0 10-10 3-11'/></g>");
const COINS = svg(60, 50, "<g fill='#C49A52' stroke='#8C6A2A' stroke-width='1'><circle cx='14' cy='14' r='5'/><circle cx='44' cy='34' r='4'/></g>");
const RIVER = svg(80, 24, "<path d='M0 12q20-10 40 0t40 0' fill='none' stroke='#4E7C80' stroke-width='2.2'/>");
const RINGS = svg(70, 70, "<g fill='none' stroke='#B08A4A' stroke-width='1.4'><circle cx='35' cy='35' r='6'/><circle cx='35' cy='35' r='14' opacity='.7'/><circle cx='35' cy='35' r='22' opacity='.45'/></g>");
const BELT = svg(40, 40, "<rect y='12' width='40' height='16' fill='#B9845A'/><circle cx='20' cy='20' r='4' fill='#E2C25E'/><path d='M0 12h40M0 28h40' stroke='#8C5E3A' stroke-width='1.5'/>");
const HILL = svg(400, 160, "<path d='M0 160L0 150Q200 120 400 30L400 160z' fill='#C9C2B2'/><circle cx='300' cy='62' r='18' fill='#9C9488'/>");
const MIST = 'radial-gradient(60% 50% at 20% 60%, rgba(214,200,232,.9), transparent 70%), radial-gradient(50% 45% at 75% 40%, rgba(232,220,240,.95), transparent 70%), radial-gradient(40% 40% at 50% 80%, rgba(200,188,226,.8), transparent 70%)';

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

  // 그림이 없는 보물: 코드 무늬(움직임 없음)
  aegis: both('은빛 비늘 무늬가 화면 위아래를 지켜 줘요.', '#E6EAEE', `${SCALES} 0 0 / 24px 14px`),
  helm_darkness: { text: '화면 위아래가 어스름한 그림자에 잠겨요.', bg: '#E4E0EA', top: 'linear-gradient(#3B3348, #6B5F7E 55%, #A99CBC)', bottom: 'linear-gradient(#A99CBC, #6B5F7E 45%, #3B3348)' },
  eros_arrows: both('금빛 하트와 잿빛 하트가 흩어져 있어요.', '#F8E6EA', `${HEARTS} 0 0 / 64px 64px`),
  cestus: both('장밋빛 띠가 화면 위아래를 감싸요.', '#F6E4E0', `${ROSE_BAND} 0 50% / 80px 40px repeat-x`),
  thyrsus: { text: '포도 덩굴과 포도송이가 위아래에 매달려요.', bg: '#EEE6EE', top: `${GRAPES} 0 0 / 56px 52px repeat-x, linear-gradient(#E2D3E4, #EEE6EE)`, bottom: `${GRAPES} 0 100% / 56px 52px repeat-x, linear-gradient(#EEE6EE, #E2D3E4)` },
  fate_thread: both('금빛 운명의 실이 화면을 가로질러 흘러가요.', '#F4EEDF', `${THREAD} 0 0 / 160px 36px`),
  asclepius_rod: both('약초 잎이 싱그럽게 돋아나요.', '#E6F0E8', `${HERBS} 0 0 / 48px 48px`),
  twin_bows: { text: '위에는 아폴론의 해, 아래에는 아르테미스의 달이 떠요.', bg: '#EEEDEA',
    top: 'radial-gradient(circle at 22% 34%, #F6D46A 0 26px, rgba(246,212,106,.35) 27px 52px, transparent 53px), linear-gradient(#F7E4B0, #EEEDEA)',
    bottom: 'radial-gradient(circle at 78% 62%, #EEF2F8 0 22px, transparent 23px), radial-gradient(circle at 74% 60%, #C9D4E4 0 26px, transparent 27px), linear-gradient(#EEEDEA, #C3CEDE)' },
  golden_throne: both('헤라의 공작 깃털 무늬가 펼쳐져요.', '#E3EEEC', `${PEACOCK} 0 0 / 40px 48px`),
  pan_pipes: { text: '아래에서 갈대숲이 자라나요.', bg: '#ECF0E2', top: 'linear-gradient(#D9E4C4, #ECF0E2)', bottom: `${REEDS} 0 100% / 36px 120px repeat-x, linear-gradient(#ECF0E2, #DCE6C8)` },
  athena_aulos: both('피리 소리가 물결처럼 퍼져요.', '#ECE8F0', `${WAVES_SOUND} 0 0 / 90px 60px`),
  ariadne_crown: { text: '밤하늘에 아리아드네의 별 왕관이 떠요.', bg: '#E6E8F0',
    top: `${CROWN} 50% 30% / 220px 90px no-repeat, ${STAR_DOTS} 0 0 / 70px 70px, linear-gradient(#262B4E, #4A5080 60%, #9AA0C4)`,
    bottom: `${STAR_DOTS} 0 0 / 70px 70px, linear-gradient(#9AA0C4, #4A5080 40%, #262B4E)` },
  heracles_bow: both('화살 깃 무늬가 줄지어 있어요.', '#F0E9DE', `${FLETCH} 0 0 / 28px 28px`),
  kibisis: { text: '가죽 자루처럼 바느질 땀이 둘러져요.', bg: '#EFE4D6',
    top: `${STITCH} 0 85% / 40px 20px repeat-x, linear-gradient(#B98E64, #D2B48E)`, bottom: `${STITCH} 0 15% / 40px 20px repeat-x, linear-gradient(#D2B48E, #B98E64)` },
  aegeus_sword: { text: '바닥에 단단한 바위 돌이 깔려요.', bg: '#ECEAE5', top: 'linear-gradient(#D8D3C8, #ECEAE5)', bottom: `${STONES} 0 0 / 80px 40px, linear-gradient(#ECEAE5, #D3CDC0)` },
  pelian_spear: both('물푸레나무 잎이 위아래에 드리워요.', '#E9EEE3', `${ASH} 0 0 / 60px 40px`),
  palladium: both('오래된 나뭇결 무늬가 은은하게 비쳐요.', '#F0E6D8', `${GRAIN} 0 0 / 120px 30px, linear-gradient(#E7D6BE, #E7D6BE)`),
  wind_bag: both('바람 소용돌이 무늬가 불어와요.', '#E5EEF4', `${SWIRL} 0 0 / 90px 60px`),
  charon_obol: { text: '저승 강물 위에 작은 동전이 떠 있어요.', bg: '#E3E8E8', top: `${COINS} 0 0 / 60px 50px`, bottom: `${RIVER} 0 0 / 80px 24px, linear-gradient(#C9D6D6, #7FA0A2)` },
  bronze_rattle: both('청동 딸랑이 소리가 동그랗게 퍼져요.', '#F1E8DA', `${RINGS} 0 0 / 70px 70px`),
  hippolyta_belt: { text: '아마존 여왕의 허리띠가 위아래를 둘러요.', bg: '#F2E6DC', top: `${BELT} 0 70% / 40px 40px repeat-x`, bottom: `${BELT} 0 30% / 40px 40px repeat-x` },
  golden_cup: { text: '헬리오스의 노을빛이 위아래를 물들여요.', bg: '#F6EADA', top: 'linear-gradient(#F2A65E, #F6CF86 55%, #F6EADA)', bottom: 'linear-gradient(#F6EADA, #F4C27A 50%, #E8925A)' },
  sisyphus_stone: { text: '언덕 위에 동그란 바위가 놓여 있어요.', bg: '#EEEBE4', top: 'linear-gradient(#DCE6EE, #EEEBE4)', bottom: `${HILL} 100% 100% / 100% 100% no-repeat` },
  beauty_box: both('잠의 안개가 몽글몽글 피어올라요.', '#EEE8F2', MIST),
};

export const MEMO_GUARD_TEXT = '보물을 달면 처음부터 있던 숫자와 겹치는 메모는 들어가지 않아요.';

// ---------- 4티어 테마판 ----------
export interface BoardTheme {
  name: string; text: string; dark?: boolean;
  bg: string; line: string; box: string; entry: string; given: string; accent: string;
  motif: string; // 구역마다 하나씩 들어가는 옅은 상징(SVG, viewBox 0 0 100 100)
}

// 숫자를 가리지 않게 옅게(어두운 판은 조금 덜 옅게)
const m = (body: string, color: string, dark?: boolean) => svg(100, 100, `<g opacity='${dark ? 0.3 : 0.2}'>${body.replaceAll("'C'", `'${color}'`)}</g>`);

const T = (name: string, what: string, c: Omit<BoardTheme, 'name' | 'text' | 'motif'>, motif: string, mc: string): BoardTheme =>
  ({ name, text: `판이 ${name}으로 바뀌어요. 굵은 선 안 구역마다 ${what} 무늬가 옅게 들어가요.`, ...c, motif: m(motif, mc, c.dark) });

export const BOARD_THEMES: Record<string, BoardTheme> = {
  chaos: T('소용돌이 판', '소용돌이', { dark: true, bg: '#2E2A36', line: '#4C445C', box: '#8A7BB0', entry: '#C7B8F0', given: '#F1ECF8', accent: '#9C8CC8' },
    "<path d='M50 50m-4 0a4 4 0 1 1 8 0a10 10 0 1 1-20 0a16 16 0 1 1 32 0a22 22 0 1 1-44 0' fill='none' stroke='C' stroke-width='4'/>", '#B9A8E8'),
  gaia: T('꽃피는 대지 판', '꽃', { bg: '#F3F0E2', line: '#D8D6B8', box: '#6E8A4A', entry: '#5F8A30', given: '#3D4A2E', accent: '#7FA36A' },
    "<g fill='C'><circle cx='50' cy='32' r='12'/><circle cx='67' cy='45' r='12'/><circle cx='61' cy='65' r='12'/><circle cx='39' cy='65' r='12'/><circle cx='33' cy='45' r='12'/></g><circle cx='50' cy='50' r='8' fill='#F3F0E2'/>", '#9DBA7E'),
  tartarus: T('청동 문 판', '청동 문', { dark: true, bg: '#2F2A26', line: '#4A4038', box: '#A87C3E', entry: '#E0AE6A', given: '#F2E6D3', accent: '#C08A44' },
    "<path d='M25 85V45a25 25 0 0 1 50 0v40' fill='none' stroke='C' stroke-width='5'/><path d='M38 85V40M50 85V35M62 85V40' stroke='C' stroke-width='4'/>", '#C08A44'),
  eros: T('사랑의 판', '하트', { bg: '#FBEFF2', line: '#EED3DA', box: '#C77A90', entry: '#C2577A', given: '#4A2E36', accent: '#E68AA2' },
    "<path d='M50 78L24 52c-12-14 6-34 26-16 20-18 38 2 26 16z' fill='C'/>", '#EBA3B5'),
  erebus: T('검은 안개 판', '안개 물결', { dark: true, bg: '#2C2D30', line: '#44464C', box: '#6E7380', entry: '#B4C0CE', given: '#EDEDED', accent: '#8A93A3' },
    "<g fill='none' stroke='C' stroke-width='5' stroke-linecap='round'><path d='M18 38q16-10 32 0t32 0'/><path d='M18 52q16-10 32 0t32 0'/><path d='M18 66q16-10 32 0t32 0'/></g>", '#7D8594'),
  nyx: T('밤하늘 판', '달과 별', { dark: true, bg: '#1F2340', line: '#353A60', box: '#6E68A8', entry: '#C9B6FF', given: '#F3F0FF', accent: '#8E86D6' },
    "<path d='M58 22a28 28 0 1 0 20 46a22 22 0 1 1-20-46z' fill='C'/><circle cx='74' cy='30' r='3' fill='C'/><circle cx='30' cy='26' r='2' fill='C'/>", '#E8D9A8'),
  aether: T('빛나는 하늘 판', '반짝임', { bg: '#F0F7FB', line: '#D4E6EE', box: '#7DAFC4', entry: '#2F7FA0', given: '#2F4552', accent: '#8EC6E0' },
    "<path d='M50 18l7 25 25 7-25 7-7 25-7-25-25-7 25-7z' fill='C'/>", '#A5D2E6'),
  hemera: T('햇살 판', '해', { bg: '#FFF8E4', line: '#F0E2BC', box: '#D9A936', entry: '#B87A08', given: '#4A3A1E', accent: '#F2C14E' },
    "<circle cx='50' cy='50' r='15' fill='C'/><g stroke='C' stroke-width='5' stroke-linecap='round'><path d='M50 20v8M50 72v8M20 50h8M72 50h8M29 29l6 6M65 65l6 6M29 71l6-6M65 35l6-6'/></g>", '#F2C14E'),
  uranus: T('별 망토 판', '큰 별', { bg: '#E9EEF8', line: '#CED8EC', box: '#6C86C9', entry: '#3E5BA8', given: '#26324F', accent: '#6C86C9' },
    "<path d='M50 18l9 22 24 2-18 16 6 24-21-13-21 13 6-24-18-16 24-2z' fill='C'/>", '#93A7DA'),
  pontus: T('파도 판', '파도', { bg: '#E6F3F4', line: '#C8E3E4', box: '#4FA3A8', entry: '#1F7A82', given: '#1F3E40', accent: '#4FA3A8' },
    "<path d='M14 60c10-16 22-16 30-4 6-14 20-16 26-4 4-8 12-8 16 0v14H14z' fill='C'/>", '#7FC0C4'),
  ourea: T('산봉우리 판', '봉우리', { bg: '#EFF0EA', line: '#D6D9CB', box: '#808C70', entry: '#5D6D48', given: '#33372D', accent: '#8C9A7A' },
    "<path d='M12 76l24-40 14 22 10-14 28 32z' fill='C'/><path d='M36 36l6 10h-12z' fill='#EFF0EA'/>", '#A8B396'),
  chronos: T('모래시계 판', '모래시계', { bg: '#F4EEE2', line: '#E3D9C3', box: '#A88A54', entry: '#8A6C36', given: '#3E3526', accent: '#B59A6A' },
    "<path d='M32 20h36M32 80h36M36 20c0 18 28 22 28 30s-28 12-28 30M64 20c0 18-28 22-28 30s28 12 28 30' fill='none' stroke='C' stroke-width='5'/>", '#C4AA78'),
  ananke: T('운명의 방추 판', '방추', { bg: '#ECEAF0', line: '#D6D3DE', box: '#847CA0', entry: '#5E5582', given: '#2E2B38', accent: '#8A82A0' },
    "<path d='M50 14v72' stroke='C' stroke-width='4'/><path d='M50 34l14 16-14 16-14-16z' fill='C'/>", '#A39BB8'),
  phanes: T('세계알 판', '빛나는 알', { bg: '#FFF6E8', line: '#F2E1C2', box: '#DDA24A', entry: '#C47A2C', given: '#4A3420', accent: '#E7B04F' },
    "<ellipse cx='50' cy='54' rx='16' ry='22' fill='C'/><path d='M34 46c-14-10-22-4-24 4 8-2 16 0 24 4M66 46c14-10 22-4 24 4-8-2-16 0-24 4' fill='C'/>", '#EDC27A'),
  zeus: T('번개 판', '번개', { bg: '#EEF1F8', line: '#D3DAEA', box: '#4A63A0', entry: '#3B5AA0', given: '#263048', accent: '#E4B83A' },
    "<path d='M56 14L30 54h16l-6 32 30-44H54z' fill='C'/>", '#E8C455'),
  hera: T('공작 깃털 판', '공작 깃털', { bg: '#EAF3F1', line: '#CDE3E0', box: '#3E8C88', entry: '#2F7A8C', given: '#1F3534', accent: '#2F8C8A' },
    "<ellipse cx='50' cy='50' rx='20' ry='28' fill='C'/><ellipse cx='50' cy='53' rx='11' ry='15' fill='#5FA9C4'/><ellipse cx='50' cy='55' rx='5' ry='7' fill='#E2C25E'/>", '#8CC4BC'),
  poseidon: T('삼지창 판', '삼지창', { bg: '#E4F0F7', line: '#C6DEEC', box: '#2F7FB0', entry: '#2268A0', given: '#18334A', accent: '#2F7FB0' },
    "<g fill='none' stroke='C' stroke-width='5' stroke-linecap='round'><path d='M50 22v64M30 22v14q0 12 20 12t20-12V22'/></g><path d='M50 14l5 10h-10zM30 14l5 10h-10zM70 14l5 10h-10z' fill='C'/>", '#6EA6CC'),
  demeter: T('밀 이삭 판', '밀 이삭', { bg: '#FBF4E0', line: '#EEE2BE', box: '#C99A38', entry: '#9A7420', given: '#45381C', accent: '#D9A93E' },
    "<path d='M50 88V24' stroke='C' stroke-width='4'/><g fill='C'><ellipse cx='42' cy='34' rx='6' ry='10' transform='rotate(-25 42 34)'/><ellipse cx='58' cy='34' rx='6' ry='10' transform='rotate(25 58 34)'/><ellipse cx='42' cy='50' rx='6' ry='10' transform='rotate(-25 42 50)'/><ellipse cx='58' cy='50' rx='6' ry='10' transform='rotate(25 58 50)'/><ellipse cx='50' cy='20' rx='5' ry='9'/></g>", '#E2BC62'),
  hestia: T('화덕 불 판', '불꽃', { bg: '#FFF1E6', line: '#F2D8C4', box: '#D9783E', entry: '#C2572A', given: '#4A2A1A', accent: '#E58A4A' },
    "<path d='M50 16c4 18 22 24 22 44a22 22 0 0 1-44 0c0-12 8-16 10-26 4 8 8 10 10 10-2-10 0-20 2-28z' fill='C'/>", '#EFA26A'),
  hades: T('저승 석류 판', '석류', { dark: true, bg: '#2A2430', line: '#40384A', box: '#8A5A70', entry: '#E0A8C0', given: '#F0E8F2', accent: '#A0607E' },
    "<circle cx='50' cy='56' r='24' fill='C'/><path d='M42 30l4 8h8l4-8-8 4z' fill='C'/>", '#8E506C'),
  athena: T('올빼미 판', '올빼미', { bg: '#EEF0EA', line: '#D6DACD', box: '#6F7F5E', entry: '#4F6A8A', given: '#2C3328', accent: '#7E8F6A' },
    "<path d='M28 30l10 10M72 30l-10 10' stroke='C' stroke-width='5'/><circle cx='38' cy='50' r='12' fill='none' stroke='C' stroke-width='5'/><circle cx='62' cy='50' r='12' fill='none' stroke='C' stroke-width='5'/><path d='M50 62l-5 8h10z' fill='C'/>", '#9AA886'),
  apollo: T('리라 판', '리라', { bg: '#FFF7E0', line: '#F0E3BA', box: '#D2A43A', entry: '#B07A12', given: '#3E321A', accent: '#E3B23C' },
    "<path d='M30 22c-6 20 0 42 20 54 20-12 26-34 20-54' fill='none' stroke='C' stroke-width='5'/><path d='M28 28h44M42 30v38M50 30v42M58 30v38' stroke='C' stroke-width='3'/>", '#E8C462'),
  artemis: T('은활 판', '활과 화살', { bg: '#EEF2F4', line: '#D6DEE4', box: '#8299AC', entry: '#4F7088', given: '#2A3440', accent: '#8FA6B8' },
    "<path d='M34 16q40 34 0 68' fill='none' stroke='C' stroke-width='5'/><path d='M34 16v68M26 50h50' stroke='C' stroke-width='3'/><path d='M80 50l-10-6v12z' fill='C'/>", '#A4B6C4'),
  ares: T('방패와 창 판', '방패', { bg: '#F6E8E4', line: '#EAD0C8', box: '#A85040', entry: '#A33E2A', given: '#3E1E18', accent: '#B5523E' },
    "<circle cx='50' cy='50' r='26' fill='none' stroke='C' stroke-width='5'/><circle cx='50' cy='50' r='8' fill='C'/><path d='M18 82L82 18' stroke='C' stroke-width='4'/>", '#C98474'),
  aphrodite: T('조개껍데기 판', '조개', { bg: '#FCEFEF', line: '#F2D6DA', box: '#D88896', entry: '#C0607A', given: '#4A2A30', accent: '#E59AA8' },
    "<path d='M50 76L20 44a32 26 0 0 1 60 0z' fill='C'/><path d='M50 76L32 34M50 76V30M50 76l18-42' stroke='#FCEFEF' stroke-width='3'/>", '#EDB0BA'),
  hephaestus: T('대장간 판', '망치', { bg: '#F1EAE4', line: '#E0D2C6', box: '#8E5A3A', entry: '#8C4A24', given: '#33241C', accent: '#A8643A' },
    "<rect x='26' y='24' width='40' height='18' rx='3' fill='C'/><path d='M50 42v42' stroke='C' stroke-width='7' stroke-linecap='round'/>", '#BE8A64'),
  hermes: T('날개 판', '날개', { bg: '#EEF3F6', line: '#D3E2E8', box: '#5F93A8', entry: '#3D7C96', given: '#263A44', accent: '#6FA3B8' },
    "<path d='M20 60c10-24 34-34 62-34-8 6-12 10-14 14 6-2 10-2 14-2-8 6-14 10-18 14 4 0 8 0 10 2-14 8-30 10-54 6z' fill='C'/>", '#95BDCD'),
  dionysus: T('포도송이 판', '포도', { bg: '#F3EAF3', line: '#E3D2E3', box: '#8C5A8C', entry: '#7A3E86', given: '#34203A', accent: '#8C4E8C' },
    "<g fill='C'><circle cx='40' cy='40' r='8'/><circle cx='58' cy='40' r='8'/><circle cx='49' cy='54' r='8'/><circle cx='31' cy='54' r='8'/><circle cx='67' cy='54' r='8'/><circle cx='40' cy='68' r='8'/><circle cx='58' cy='68' r='8'/><circle cx='49' cy='82' r='8'/></g><path d='M50 32V16' stroke='#7C9A5A' stroke-width='4'/>", '#B07AB4'),
};

// 판에 넣을 CSS 변수
export function themeVars(t: BoardTheme): Record<string, string> {
  return { '--t-bg': t.bg, '--t-line': t.line, '--t-box': t.box, '--t-entry': t.entry, '--t-given': t.given, '--t-accent': t.accent, '--t-motif': t.motif };
}
