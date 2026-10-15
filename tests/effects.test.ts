import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TREASURE_FX, BOARD_THEMES } from '../src/data/effects';
import tiers from '../src/data/tiers.json';

describe('꾸밈효과·테마판', () => {
  const t = tiers as Record<string, number>;
  it('보물 64개 모두 꾸밈효과가 있고, 그림이 있는 것은 파일이, 없는 것은 판 효과가 있다', () => {
    const treasures = Object.keys(t).filter((id) => t[id] === 0);
    expect(treasures.length).toBe(64);
    for (const id of treasures) expect(TREASURE_FX[id], id).toBeTruthy();
    expect(Object.keys(TREASURE_FX).sort()).toEqual(treasures.sort());
    for (const fx of Object.values(TREASURE_FX)) {
      if (fx.scene) expect(() => readFileSync(`public/assets/scenes/${fx.scene}.webp`)).not.toThrow();
      else expect(fx.board).toBeTruthy();
    }
  });
  it('4티어 초상화 28명 모두 테마판이 있다', () => {
    const top = Object.keys(t).filter((id) => t[id] === 4).sort();
    expect(top.length).toBe(28);
    expect(Object.keys(BOARD_THEMES).sort()).toEqual(top);
  });
});
