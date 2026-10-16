import { describe, it, expect } from 'vitest';
import { parseBoard, countSolutions, conflicts, isComplete, geometry, computeCandidates } from '../src/sudoku/engine';
import { grade, makeState, nextStep, applyStep } from '../src/sudoku/logic';
import { makeHint } from '../src/sudoku/hints';
import { generateOne, mulberry32 } from '../src/sudoku/generate';

describe('geometry', () => {
  it('6×6 박스는 2행×3열', () => {
    const g = geometry(6);
    expect(g.units.length).toBe(18);
    expect(g.units[12]).toEqual([0, 1, 2, 6, 7, 8]);
    expect(g.peers[0].length).toBe(5 + 5 + 2);
  });
  it('9×9 peers 20개', () => expect(geometry(9).peers[40].length).toBe(20));
});

describe('규칙 검사', () => {
  it('충돌 칸을 찾는다', () => {
    const b = parseBoard('11..' + '....' + '....' + '....');
    expect([...conflicts(b, 4)].sort()).toEqual([0, 1]);
  });
  it('완성 판정', () => {
    expect(isComplete(parseBoard('1234341221434321'), 4)).toBe(true);
    expect(isComplete(parseBoard('1234341221434312'), 4)).toBe(false);
  });
});

describe('유일해', () => {
  it('유명한 9×9 문제는 해가 하나', () => {
    const p = parseBoard('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
    const r = countSolutions(p, 9);
    expect(r.count).toBe(1);
    expect(r.solution!.join('')).toBe('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  });
  it('빈 4×4는 해가 여러 개', () => expect(countSolutions(new Array(16).fill(0), 4).count).toBe(2));
});

describe('논리 엔진', () => {
  it('쉬운 문제는 한 칸씩 풀린다', () => {
    const p = parseBoard('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
    const g = grade(p, 9);
    expect(g.solved).toBe(true);
    expect(g.level).toBe(1);
  });
  it('각 단계가 실제 해와 모순되지 않는다', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 30; i++) {
      const gen = generateOne(9, rnd, 24);
      const s = makeState(gen.givens, 9);
      for (;;) {
        const st = nextStep(s, 3);
        if (!st) break;
        if (st.placement) expect(gen.solution[st.placement.cell]).toBe(st.placement.digit);
        for (const e of st.eliminations) expect(gen.solution[e.cell]).not.toBe(e.digit);
        applyStep(s, st);
      }
    }
  });
});

describe('힌트', () => {
  const givens = parseBoard('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
  it('충돌을 먼저 알려 준다', () => {
    const b = givens.slice(); b[2] = 5;
    const h = makeHint(givens, b, 9);
    expect(h.kind).toBe('conflict');
    expect(h.focusCells).toContain(2);
  });
  it('틀린 숫자를 알려 준다', () => {
    const b = givens.slice(); b[2] = 1; // 정답은 4, 1은 행·열·박스 충돌 없음
    expect(conflicts(b, 9).size).toBe(0);
    expect(makeHint(givens, b, 9).kind).toBe('wrong');
  });
  it('논리 힌트의 답은 정답과 같고 설명 칸이 실제 보드와 맞다', () => {
    const h = makeHint(givens, givens, 9);
    expect(h.kind).toBe('logic');
    const sol = countSolutions(givens, 9).solution!;
    expect(sol[h.answer!.cell]).toBe(h.answer!.digit);
    expect(givens[h.answer!.cell]).toBe(0);
    expect(h.detail.length).toBeGreaterThan(10);
  });
});

import { geometry as geo2, conflicts as conf2, countSolutions as cs2 } from '../src/sudoku/engine';
import { grade as grade2 } from '../src/sudoku/logic';
import { readFileSync as rf2 } from 'node:fs';
describe('대각선 스도쿠(신화)', () => {
  it('가운데 칸 peers는 32개, 대각선 단위 2개', () => {
    const g = geo2(9, true);
    expect(g.units.length).toBe(29);
    expect(g.peers[40].length).toBe(32);
    expect(geo2(9).peers[40].length).toBe(20);
  });
  it('대각선 겹침도 찾는다', () => {
    const b = new Array(81).fill(0); b[0] = 5; b[80] = 5;
    expect(conf2(b, 9).size).toBe(0);
    expect(conf2(b, 9, true).size).toBe(2);
  });
  it('문제 은행 60개: 대각선 규칙으로 유일해, 정답이 대각선 규칙을 지키고, 논리로 풀림', () => {
    const bank = JSON.parse(rf2('puzzles/bank-diag.json', 'utf8'));
    expect(bank.length).toBe(60);
    for (const p of bank.slice(0, 15)) {
      const giv = [...p.givens].map((c: string) => (c === '.' ? 0 : +c));
      const r = cs2(giv, 9, 2, true);
      expect(r.count).toBe(1);
      expect(r.solution!.join('')).toBe(p.solution);
      expect(conf2([...p.solution].map(Number), 9, true).size).toBe(0);
      expect(grade2(giv, 9, true).solved).toBe(true);
    }
  });
});
