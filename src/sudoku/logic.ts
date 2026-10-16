// 사람이 쓰는 논리 기법으로 한 단계씩 푸는 엔진. 난이도 판정과 힌트에 함께 쓴다.
import {
  Board, Size, Geometry, geometry, computeCandidates, bit, popcount, digitsOf, rowOf, colOf,
} from './engine';

export type Technique =
  | 'nakedSingle' | 'hiddenSingle'
  | 'pointing' | 'claiming' | 'nakedPair' | 'hiddenPair'
  | 'nakedTriple' | 'hiddenTriple' | 'xWing';

export const TECH_LEVEL: Record<Technique, 1 | 2 | 3> = {
  nakedSingle: 1, hiddenSingle: 1,
  pointing: 2, claiming: 2, nakedPair: 2, hiddenPair: 2,
  nakedTriple: 3, hiddenTriple: 3, xWing: 3,
};

export const TECH_NAME_KO: Record<Technique, string> = {
  nakedSingle: '하나 남은 숫자',
  hiddenSingle: '한 곳뿐인 자리',
  pointing: '상자 속 한 줄',
  claiming: '줄 속 한 상자',
  nakedPair: '짝꿍 두 칸',
  hiddenPair: '숨은 짝꿍',
  nakedTriple: '세 칸 묶음',
  hiddenTriple: '숨은 세 숫자',
  xWing: '네모 엑스윙',
};

export interface CellDigit { cell: number; digit: number }

export interface Step {
  technique: Technique;
  placement?: CellDigit; // 숫자를 확정하는 단계
  eliminations: CellDigit[]; // 후보를 지우는 단계
  units: number[]; // 관련 unit 인덱스(행 0..n-1, 열 n..2n-1, 박스 2n..3n-1)
  cells: number[]; // 근거가 되는 칸
  digits: number[];
}

export interface LogicState { n: Size; board: Board; cand: number[]; diag: boolean }

export function makeState(board: Board, n: Size, diag = false): LogicState {
  return { n, board: board.slice(), cand: computeCandidates(board, n, diag), diag };
}

export function applyStep(s: LogicState, step: Step) {
  const g = geometry(s.n, s.diag);
  if (step.placement) {
    const { cell, digit } = step.placement;
    s.board[cell] = digit;
    s.cand[cell] = 0;
    for (const p of g.peers[cell]) s.cand[p] &= ~bit(digit);
  }
  for (const e of step.eliminations) s.cand[e.cell] &= ~bit(e.digit);
}

// ---------- 기법별 탐색 ----------
function nakedSingle(s: LogicState, g: Geometry): Step | null {
  for (let cell = 0; cell < s.board.length; cell++) {
    if (s.board[cell] || popcount(s.cand[cell]) !== 1) continue;
    const digit = digitsOf(s.cand[cell])[0];
    return { technique: 'nakedSingle', placement: { cell, digit }, eliminations: [], units: g.cellUnits[cell], cells: [cell], digits: [digit] };
  }
  return null;
}

function hiddenSingle(s: LogicState, g: Geometry): Step | null {
  // 상자 → 행 → 열 순서(아이들이 찾기 쉬운 순서)
  const order = [...g.units.keys()].sort((a, b) => unitOrder(g, a) - unitOrder(g, b));
  for (const ui of order) {
    const u = g.units[ui];
    for (let d = 1; d <= s.n; d++) {
      if (u.some((c) => s.board[c] === d)) continue;
      const spots = u.filter((c) => !s.board[c] && s.cand[c] & bit(d));
      if (spots.length === 1)
        return { technique: 'hiddenSingle', placement: { cell: spots[0], digit: d }, eliminations: [], units: [ui], cells: spots, digits: [d] };
    }
  }
  return null;
}
function unitOrder(g: Geometry, ui: number) {
  const n = g.n;
  return ui >= 2 * n ? ui - 2 * n : ui + n; // 박스 먼저
}

function pointing(s: LogicState, g: Geometry): Step | null {
  const n = s.n;
  for (let bi = 2 * n; bi < 3 * n; bi++) {
    const box = g.units[bi];
    for (let d = 1; d <= n; d++) {
      const spots = box.filter((c) => !s.board[c] && s.cand[c] & bit(d));
      if (spots.length < 2) continue;
      for (const kind of ['row', 'col'] as const) {
        const key = (c: number) => (kind === 'row' ? rowOf(n, c) : colOf(n, c));
        if (!spots.every((c) => key(c) === key(spots[0]))) continue;
        const lineUi = kind === 'row' ? key(spots[0]) : n + key(spots[0]);
        const elim = g.units[lineUi].filter((c) => !box.includes(c) && !s.board[c] && s.cand[c] & bit(d));
        if (elim.length)
          return { technique: 'pointing', eliminations: elim.map((cell) => ({ cell, digit: d })), units: [bi, lineUi], cells: spots, digits: [d] };
      }
    }
  }
  return null;
}

function claiming(s: LogicState, g: Geometry): Step | null {
  const n = s.n;
  for (let li = 0; li < 2 * n; li++) {
    const line = g.units[li];
    for (let d = 1; d <= n; d++) {
      const spots = line.filter((c) => !s.board[c] && s.cand[c] & bit(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map((c) => g.cellUnits[c][2]));
      if (boxes.size !== 1) continue;
      const bi = [...boxes][0];
      const elim = g.units[bi].filter((c) => !line.includes(c) && !s.board[c] && s.cand[c] & bit(d));
      if (elim.length)
        return { technique: 'claiming', eliminations: elim.map((cell) => ({ cell, digit: d })), units: [li, bi], cells: spots, digits: [d] };
    }
  }
  return null;
}

function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, cur: T[]) => {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

function nakedSubset(s: LogicState, g: Geometry, k: 2 | 3): Step | null {
  for (let ui = 0; ui < g.units.length; ui++) {
    const empties = g.units[ui].filter((c) => !s.board[c]);
    if (empties.length <= k) continue;
    const pool = empties.filter((c) => popcount(s.cand[c]) <= k && popcount(s.cand[c]) >= 2);
    for (const set of combos(pool, k)) {
      const union = set.reduce((m, c) => m | s.cand[c], 0);
      if (popcount(union) !== k) continue;
      const elim: CellDigit[] = [];
      for (const c of empties) {
        if (set.includes(c)) continue;
        for (const d of digitsOf(s.cand[c] & union)) elim.push({ cell: c, digit: d });
      }
      if (elim.length)
        return { technique: k === 2 ? 'nakedPair' : 'nakedTriple', eliminations: elim, units: [ui], cells: set, digits: digitsOf(union) };
    }
  }
  return null;
}

function hiddenSubset(s: LogicState, g: Geometry, k: 2 | 3): Step | null {
  const n = s.n;
  for (let ui = 0; ui < g.units.length; ui++) {
    const u = g.units[ui];
    const empties = u.filter((c) => !s.board[c]);
    if (empties.length <= k) continue;
    const missing = [];
    for (let d = 1; d <= n; d++) if (!u.some((c) => s.board[c] === d)) missing.push(d);
    const spotsOf = (d: number) => empties.filter((c) => s.cand[c] & bit(d));
    const pool = missing.filter((d) => { const l = spotsOf(d).length; return l >= 2 && l <= k; });
    for (const ds of combos(pool, k)) {
      const cells = new Set<number>();
      ds.forEach((d) => spotsOf(d).forEach((c) => cells.add(c)));
      if (cells.size !== k) continue;
      const keep = ds.reduce((m, d) => m | bit(d), 0);
      const elim: CellDigit[] = [];
      for (const c of cells) for (const d of digitsOf(s.cand[c] & ~keep)) elim.push({ cell: c, digit: d });
      if (elim.length)
        return { technique: k === 2 ? 'hiddenPair' : 'hiddenTriple', eliminations: elim, units: [ui], cells: [...cells], digits: ds };
    }
  }
  return null;
}

function xWing(s: LogicState, g: Geometry): Step | null {
  const n = s.n;
  for (const base of ['row', 'col'] as const) {
    for (let d = 1; d <= n; d++) {
      const lines: { li: number; pos: number[] }[] = [];
      for (let i = 0; i < n; i++) {
        const li = base === 'row' ? i : n + i;
        const spots = g.units[li].filter((c) => !s.board[c] && s.cand[c] & bit(d));
        if (spots.length === 2) lines.push({ li, pos: spots.map((c) => (base === 'row' ? colOf(n, c) : rowOf(n, c))) });
      }
      for (const [a, b] of combos(lines, 2)) {
        if (a.pos[0] !== b.pos[0] || a.pos[1] !== b.pos[1]) continue;
        const crossUis = a.pos.map((p) => (base === 'row' ? n + p : p));
        const corner = [...g.units[a.li], ...g.units[b.li]];
        const elim: CellDigit[] = [];
        for (const cu of crossUis)
          for (const c of g.units[cu]) if (!corner.includes(c) && !s.board[c] && s.cand[c] & bit(d)) elim.push({ cell: c, digit: d });
        if (elim.length) {
          const cells = corner.filter((c) => !s.board[c] && s.cand[c] & bit(d) && crossUis.some((cu) => g.units[cu].includes(c)));
          return { technique: 'xWing', eliminations: elim, units: [a.li, b.li, ...crossUis], cells, digits: [d] };
        }
      }
    }
  }
  return null;
}

const FINDERS: ((s: LogicState, g: Geometry) => Step | null)[] = [
  nakedSingle, hiddenSingle, pointing, claiming,
  (s, g) => nakedSubset(s, g, 2), (s, g) => hiddenSubset(s, g, 2),
  (s, g) => nakedSubset(s, g, 3), (s, g) => hiddenSubset(s, g, 3), xWing,
];

/** 가장 쉬운 다음 단계 */
export function nextStep(s: LogicState, maxLevel: 1 | 2 | 3 = 3): Step | null {
  const g = geometry(s.n, s.diag);
  for (const f of FINDERS) {
    const st = f(s, g);
    if (st && TECH_LEVEL[st.technique] <= maxLevel) return st;
    if (st) return null;
  }
  return null;
}

export interface GradeResult { solved: boolean; level: 0 | 1 | 2 | 3; techniques: Partial<Record<Technique, number>>; steps: number }

/** 논리만으로 끝까지 풀어 본다. level은 쓰인 가장 어려운 기법 단계 */
export function grade(board: Board, n: Size, diag = false): GradeResult {
  const s = makeState(board, n, diag);
  const techniques: Partial<Record<Technique, number>> = {};
  let level: 0 | 1 | 2 | 3 = 0;
  let steps = 0;
  for (;;) {
    if (s.board.every((v) => v)) return { solved: true, level, techniques, steps };
    const st = nextStep(s, 3);
    if (!st) return { solved: false, level, techniques, steps };
    techniques[st.technique] = (techniques[st.technique] ?? 0) + 1;
    level = Math.max(level, TECH_LEVEL[st.technique]) as 0 | 1 | 2 | 3;
    applyStep(s, st);
    steps++;
  }
}
