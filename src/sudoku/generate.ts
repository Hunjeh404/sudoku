// 문제 생성기(빌드 단계 전용). 유일해 + 논리 풀이 등급을 확인한 문제만 만든다.
import { Board, Size, geometry, countSolutions, bit, digitsOf, popcount } from './engine';
import { grade, GradeResult } from './logic';

export type Rand = () => number;
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(a: T[], rnd: Rand): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomSolution(n: Size, rnd: Rand): Board {
  const g = geometry(n);
  const b: Board = new Array(n * n).fill(0);
  const all = (1 << n) - 1;
  const rec = (cell: number): boolean => {
    if (cell === b.length) return true;
    let m = all;
    for (const p of g.peers[cell]) if (b[p]) m &= ~bit(b[p]);
    for (const d of shuffle(digitsOf(m), rnd)) {
      b[cell] = d;
      if (rec(cell + 1)) return true;
    }
    b[cell] = 0;
    return false;
  };
  rec(0);
  return b;
}

/** 해를 유지하며 칸을 지운다. minGivens 아래로는 지우지 않는다. */
export function dig(solution: Board, n: Size, rnd: Rand, minGivens: number, symmetric = true): Board {
  const b = solution.slice();
  const N = n * n;
  const order = shuffle([...Array(N).keys()], rnd);
  let givens = N;
  for (const cell of order) {
    if (givens <= minGivens) break;
    if (!b[cell]) continue;
    const mirror = N - 1 - cell;
    const pair = symmetric && mirror !== cell && b[mirror] ? [cell, mirror] : [cell];
    if (givens - pair.length < minGivens) continue;
    const saved = pair.map((c) => b[c]);
    pair.forEach((c) => (b[c] = 0));
    if (countSolutions(b, n, 2).count !== 1) pair.forEach((c, i) => (b[c] = saved[i]));
    else givens -= pair.length;
  }
  return b;
}

export interface Generated { givens: Board; solution: Board; grade: GradeResult; givenCount: number }

export function generateOne(n: Size, rnd: Rand, minGivens: number): Generated {
  const solution = randomSolution(n, rnd);
  const givens = dig(solution, n, rnd, minGivens);
  return { givens, solution, grade: grade(givens, n), givenCount: givens.filter(Boolean).length };
}

/** 숫자 이름 바꾸기만 다른 문제를 같은 것으로 보기 위한 정규형 */
export function relabelKey(b: Board): string {
  const map = new Map<number, number>();
  return b.map((v) => {
    if (!v) return '.';
    if (!map.has(v)) map.set(v, map.size + 1);
    return String(map.get(v));
  }).join('');
}
export { popcount };
