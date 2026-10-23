import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { COLLECTION_CARDS, COLLECTION_SETS, cardImage, collectedCards, collectionImage, collectionRewardsAt, nextCollectionCard, selectedBackdrop, setUnlocked } from '../src/data/collections';

describe('신화 여행첩', () => {
  it('신규 이용자는 첫 보상 이전까지 카드·배경이 잠겨 있다', () => {
    expect(collectedCards(0)).toHaveLength(0);
    expect(collectedCards(4)).toHaveLength(0);
    expect(collectedCards(5).map((c) => c.id)).toEqual(['awakening']);
    expect(selectedBackdrop('genesis', 5)).toBeNull();
    expect(nextCollectionCard(5)?.need).toBe(10);
  });
  it('세트의 마지막 판에서만 배경이 열리고 새 카드와 함께 알린다', () => {
    for (const set of COLLECTION_SETS) {
      const end = set.cards[3].need;
      expect(setUnlocked(set, end - 1)).toBe(false);
      expect(selectedBackdrop(set.id, end)).toEqual(set);
      expect(collectionRewardsAt(end).cards).toEqual([set.cards[3]]);
      expect(collectionRewardsAt(end).backgrounds).toEqual([set]);
      expect(collectionRewardsAt(end + 1).backgrounds).toHaveLength(0);
    }
  });
  it('이전 이용자에게 지난 보상을 소급 적용하며 70판 이후에도 목표가 있다', () => {
    expect(collectedCards(70)).toHaveLength(10);
    expect(COLLECTION_SETS.filter((s) => setUnlocked(s, 70))).toHaveLength(2);
    expect(nextCollectionCard(70)?.need).toBe(85);
    expect(collectedCards(500)).toHaveLength(24);
    expect(COLLECTION_SETS.every((s) => setUnlocked(s, 500))).toBe(true);
    expect(nextCollectionCard(501)).toBeNull();
    expect(collectionRewardsAt(501).cards).toHaveLength(0);
  });
  it('위조·이전 설정값으로 아직 잠긴 배경을 표시하지 않는다', () => {
    expect(selectedBackdrop('homecoming', 499)).toBeNull();
    expect(selectedBackdrop('../secret', 500)).toBeNull();
    expect(selectedBackdrop('', 500)).toBeNull();
    expect(selectedBackdrop(undefined, 500)).toBeNull();
    for (const count of [-1, NaN, Infinity]) expect(collectedCards(count)).toHaveLength(0);
  });
  it('보상 ID·경계값이 고유하며 모든 장면과 배경 파일이 있다', () => {
    expect(new Set(COLLECTION_CARDS.map((c) => c.id)).size).toBe(24);
    expect(new Set(COLLECTION_CARDS.map((c) => c.need)).size).toBe(24);
    expect(COLLECTION_CARDS.map((c) => c.need)).toEqual(COLLECTION_CARDS.map((c) => c.need).sort((a,b) => a-b));
    for (const c of COLLECTION_CARDS) expect(existsSync(`public/${cardImage(c)}`), c.id).toBe(true);
    for (const s of COLLECTION_SETS) expect(existsSync(`public/${collectionImage(s)}`), s.id).toBe(true);
  });
});
