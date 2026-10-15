import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TITLES, priceFor } from '../src/data/catalog';

describe('칭호 목록', () => {
  it('화면의 칭호 조건이 서버(0014)와 같다', () => {
    const sql = readFileSync('supabase/migrations/0014_titles_skills.sql', 'utf8');
    const rows = [...sql.matchAll(/\('(\w+)', '([^']+)', '(\w+)', (\d+)\)/g)].map((m) => ({ id: m[1], name: m[2], stat: m[3], need: +m[4] }));
    expect(rows.length).toBe(25);
    for (const r of rows) {
      const t = TITLES.find((x) => x.id === r.id);
      expect(t, r.id).toBeTruthy();
      expect([t!.name, t!.stat, t!.need]).toEqual([r.name, r.stat, r.need]);
    }
    expect(TITLES.length).toBe(28);
  });
  it('칭호 할인 가격', () => {
    expect(priceFor(2, 60, 'col10')).toBe(59);
    expect(priceFor(4, 400, 'col390')).toBe(352);
    expect(priceFor(0, 10, 'tr30')).toBe(7);
    expect(priceFor(1, 20, '')).toBe(20);
  });
});
