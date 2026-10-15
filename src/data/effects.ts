// 보물 꾸밈효과(스도쿠 화면 배경)와 4티어 초상화 테마판.
// 보물: 이야기책에 그 보물 장면이 있으면 그 그림을 화면 위·아래에 나눠 깐다.
//       그림이 없는 보물은 판 안에서 숫자 모양·입력할 때 짧은 효과·칸 표시·다 채웠을 때 표시를 바꾼다(styles.css의 .tfx-<id>).
// 4티어: 내 초상화로 쓰면 판의 색·선·구역마다 옅은 상징 무늬가 바뀐다.

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

// 판 효과가 언제 나오는지: 늘 보임(look), 숫자를 넣을 때(enter), 지울 때(erase), 되돌림·다시(undo),
// 줄을 다 채울 때(line), 구역을 다 채웠을 때(box), 숫자를 판에 다 놓았을 때 숫자 버튼(pad), 소리(sound)
export type BoardFxKind = 'look' | 'enter' | 'erase' | 'undo' | 'line' | 'box' | 'pad' | 'sound';

export interface TreasureFx {
  text: string; // 도감에 보여 줄 한 줄
  scene?: string; // 이야기책 그림(assets/scenes/<scene>.webp)
  bg?: string; // 그림을 깔 때 화면 바탕색
  board?: BoardFxKind; // 그림이 없는 보물의 판 효과
}

const scene = (id: string, bg: string, what: string): TreasureFx => ({ scene: id, bg, text: `이야기책의 「${what}」 그림이 스도쿠 화면 위아래에 펼쳐져요.` });

const fx = (board: BoardFxKind, text: string): TreasureFx => ({ board, text });

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

  // 그림이 없는 보물: 판 효과(움직임은 0.5초 안팎으로 한 번만)
  cestus: fx('look', '내가 넣은 숫자가 장밋빛이 돼요.'),
  twin_bows: fx('look', '내가 넣은 숫자 중 홀수는 금빛, 짝수는 은빛이 돼요.'),
  golden_throne: fx('look', '처음부터 있던 숫자가 금빛 굵은 글씨가 돼요.'),
  palladium: fx('look', '처음부터 있던 숫자 칸에 나뭇결이 옅게 깔려요.'),
  kibisis: fx('look', '메모 숫자가 작은 동그라미 안에 담겨 또렷해져요.'),
  beauty_box: fx('look', '메모 숫자가 연보라색 둥근 글씨가 돼요.'),
  eros_arrows: fx('enter', '숫자를 넣으면 칸 위로 작은 하트가 떠올랐다 사라져요.'),
  bronze_rattle: fx('enter', '숫자를 넣으면 칸에서 동그란 물결이 한 번 퍼져요.'),
  wind_bag: fx('enter', '숫자를 넣으면 칸에서 바람 줄기가 옆으로 흩어져요.'),
  helm_darkness: fx('enter', '넣은 숫자가 투명한 데서 천천히 나타나요.'),
  aegeus_sword: fx('enter', '넣은 숫자가 아래에서 위로 살짝 올라오며 나타나요.'),
  asclepius_rod: fx('erase', '지우기를 누르면 그 칸이 연두빛으로 한 번 반짝여요.'),
  sisyphus_stone: fx('undo', '되돌림이나 다시를 누르면 바뀐 칸이 회색으로 한 번 깜빡여요.'),
  pan_pipes: fx('sound', '숫자마다 소리 높이가 달라요(1은 도, 2는 레…). 소리를 켰을 때만 들려요.'),
  aegis: fx('look', '고른 칸 테두리가 은빛 이중선이 돼요.'),
  pelian_spear: fx('look', '고른 칸 네 모서리에 창끝 꺾쇠가 붙어요.'),
  heracles_bow: fx('look', '고른 칸의 가로줄과 세로줄이 조준선처럼 진하게 보여요.'),
  fate_thread: fx('look', '같은 숫자를 강조할 때 그 숫자들 아래에 금빛 밑줄이 그어져요.'),
  golden_cup: fx('look', '같은 숫자 강조 색이 노을빛 주황이 돼요.'),
  hippolyta_belt: fx('look', '굵은 구역 선이 가죽띠 색 이중선이 돼요.'),
  athena_aulos: fx('line', '가로줄이나 세로줄 하나를 다 채우면 그 줄이 한 번 은은하게 빛나요.'),
  thyrsus: fx('box', '구역 하나를 다 채우면 그 구역 모서리에 포도잎이 생겨요.'),
  ariadne_crown: fx('pad', '숫자 하나를 판에 다 놓으면 그 숫자 버튼에 작은 별이 붙어요.'),
  charon_obol: fx('pad', '숫자 하나를 판에 다 놓으면 그 숫자 버튼이 금화에서 은화로 바뀌어요.'),
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
