// 수집 여부는 서버가 검증한 누적 완료 판수에서 계산한다.
// 별빛·점수·기존 여정 지급 내역을 바꾸지 않아 기존 이용자도 즉시 소급 적용된다.
export interface CollectionCard { id: string; name: string; scene: string; need: number }
export interface CollectionSet { id: string; name: string; backgroundName: string; description: string; cards: CollectionCard[] }
export const COLLECTION_SETS: CollectionSet[] = [
  { id: 'genesis', name: '세상의 첫빛', backgroundName: '태초의 은하수', description: '밤과 대지, 하늘이 처음 만나는 순간을 모아요.', cards: [
    { id: 'awakening', name: '깨어나는 대지', scene: 'c01-01', need: 5 },
    { id: 'night', name: '밤의 날개', scene: 'c01-03', need: 10 },
    { id: 'sky', name: '하늘의 품', scene: 'c01-02', need: 15 },
    { id: 'cradle', name: '크레타의 요람', scene: 'c02-04', need: 20 },
  ] },
  { id: 'olympus', name: '구름 위의 신들', backgroundName: '구름 위 신전', description: '올림포스에 모인 신들의 특별한 순간이에요.', cards: [
    { id: 'thunder', name: '번개를 만드는 손', scene: 'c03-02', need: 25 },
    { id: 'realms', name: '세 세계의 약속', scene: 'c04-01', need: 30 },
    { id: 'wisdom', name: '지혜의 탄생', scene: 'c04-02', need: 40 },
    { id: 'olive', name: '아테네의 선물', scene: 'c04-05', need: 50 },
  ] },
  { id: 'garden', name: '꽃과 노래의 정원', backgroundName: '페르세포네의 정원', description: '꽃과 사랑, 음악이 깃든 장면을 모아요.', cards: [
    { id: 'spring', name: '꽃밭의 페르세포네', scene: 'c06-01', need: 60 },
    { id: 'lamp', name: '프시케의 등불', scene: 'c07-01', need: 70 },
    { id: 'ants', name: '작은 친구들의 도움', scene: 'c07-02', need: 85 },
    { id: 'sculpture', name: '살아난 조각상', scene: 'c07-05', need: 100 },
  ] },
  { id: 'heroes', name: '영웅의 발자취', backgroundName: '페가소스의 쉼터', description: '용기와 지혜로 길을 연 영웅들의 모험이에요.', cards: [
    { id: 'pegasus', name: '날개 달린 친구', scene: 'c08-06', need: 115 },
    { id: 'thread', name: '미궁을 잇는 실', scene: 'c09-03', need: 135 },
    { id: 'escape', name: '미궁 밖으로', scene: 'c09-04', need: 155 },
    { id: 'atlas', name: '하늘을 받치는 힘', scene: 'c10-04', need: 180 },
  ] },
  { id: 'voyage', name: '황금빛 항해', backgroundName: '아르고호의 항구', description: '함께 힘을 모아 낯선 바다로 떠나요.', cards: [
    { id: 'ram', name: '황금 양의 비행', scene: 'c12-01', need: 205 },
    { id: 'argo', name: '아르고호의 출항', scene: 'c12-03', need: 235 },
    { id: 'rocks', name: '바위 사이의 길', scene: 'c12-05', need: 265 },
    { id: 'dragon', name: '잠든 용과 황금 양털', scene: 'c12-06', need: 300 },
  ] },
  { id: 'homecoming', name: '별을 따라 집으로', backgroundName: '이타카의 달빛', description: '긴 모험 끝에 돌아갈 집을 떠올려요.', cards: [
    { id: 'craft', name: '뗏목을 만드는 날', scene: 'c16-05', need: 340 },
    { id: 'weaving', name: '기다림의 베틀', scene: 'c16-06', need: 390 },
    { id: 'bow', name: '다시 당긴 활시위', scene: 'c16-07', need: 440 },
    { id: 'return', name: '긴 귀향의 이야기', scene: 'c16-00', need: 500 },
  ] },
];
export const COLLECTION_CARDS = COLLECTION_SETS.flatMap((s) => s.cards);
export const collectionImage = (s: CollectionSet) => `assets/collections/${s.id}.webp`;
export const cardImage = (c: CollectionCard) => `assets/scenes/${c.scene}.webp`;
const countOf = (n: number) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
export const cardUnlocked = (card: CollectionCard, count: number) => countOf(count) >= card.need;
export const setUnlocked = (set: CollectionSet, count: number) => set.cards.every((c) => cardUnlocked(c, count));
export const collectedCards = (count: number) => COLLECTION_CARDS.filter((c) => cardUnlocked(c, count));
export const nextCollectionCard = (count: number) => COLLECTION_CARDS.find((c) => !cardUnlocked(c, count)) ?? null;
export const selectedBackdrop = (id: unknown, count: number) => COLLECTION_SETS.find((s) => s.id === id && setUnlocked(s, count)) ?? null;
export const collectionRewardsAt = (count: number) => ({
  cards: COLLECTION_CARDS.filter((c) => c.need === countOf(count)),
  backgrounds: COLLECTION_SETS.filter((s) => s.cards[s.cards.length - 1].need === countOf(count)),
});
