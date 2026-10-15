import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TREASURE_FX, BOARD_THEMES, boardThemeFor } from '../src/data/effects';
import tiers from '../src/data/tiers.json';

describe('꾸밈효과·테마판', () => {
  const t = tiers as Record<string, number>;
  it('보물 64개 모두 꾸밈효과가 있고, 그림이 있는 것은 파일이, 없는 것은 숫자 버튼 모양이 있다', () => {
    const treasures = Object.keys(t).filter((id) => t[id] === 0);
    expect(treasures.length).toBe(64);
    for (const id of treasures) expect(TREASURE_FX[id], id).toBeTruthy();
    expect(Object.keys(TREASURE_FX).sort()).toEqual(treasures.sort());
    for (const fx of Object.values(TREASURE_FX)) {
      if (fx.scene) expect(() => readFileSync(`public/assets/scenes/${fx.scene}.webp`)).not.toThrow();
      else expect(fx.coin).toBeTruthy();
    }
  });
  it('4티어 초상화 28명 모두 테마판과 테두리·상징 그림이 있다', () => {
    const top = Object.keys(t).filter((id) => t[id] === 4).sort();
    expect(top.length).toBe(28);
    expect(Object.keys(BOARD_THEMES).sort()).toEqual(top);
    for (const id of top) for (const k of ['frame', 'emblem']) expect(() => readFileSync(`public/assets/themes/${id}_${k}.webp`), `${id} ${k}`).not.toThrow();
  });
  it('내 초상화 티어에 맞는 판: 1티어·빈칸 기본, 2·3티어는 티어 판, 4티어는 인물 판', () => {
    const t = tiers as Record<string, number>;
    const pick = (tier: number) => Object.keys(t).find((id) => t[id] === tier)!;
    expect(boardThemeFor('')).toBeNull();
    expect(boardThemeFor(pick(1))).toBeNull();
    expect(boardThemeFor(pick(2))?.key).toBe('tier2');
    expect(boardThemeFor(pick(3))?.key).toBe('tier3');
    expect(boardThemeFor('nyx')?.key).toBe('nyx');
  });
});
