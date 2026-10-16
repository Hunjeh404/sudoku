// 스도쿠 규칙·풀이 엔진. 4×4(2×2), 6×6(2×3), 9×9(3×3)를 지원한다.
// diag=true면 두 대각선도 1~n이 한 번씩 들어가야 하는 대각선 스도쿠(신화 난이도). 대각선 단위는 박스 뒤(3n, 3n+1)에 붙는다.
// 보드는 길이 N*N 배열, 0은 빈칸.

export type Size = 4 | 6 | 9;
export type Board = number[];

export interface Geometry {
  n: Size;
  boxR: number; // 박스 세로 칸 수
  boxC: number; // 박스 가로 칸 수
  units: number[][]; // 행 n개, 열 n개, 박스 n개 순서
  peers: number[][];
  cellUnits: number[][]; // 칸별 [행 unit idx, 열 unit idx, 박스 unit idx, (대각선 unit idx…)]
  diag: boolean;
}

const geoCache = new Map<string, Geometry>();

export function geometry(n: Size, diag = false): Geometry {
  const key = `${n}${diag ? 'd' : ''}`;
  const cached = geoCache.get(key);
  if (cached) return cached;
  const [boxR, boxC] = n === 4 ? [2, 2] : n === 6 ? [2, 3] : [3, 3];
  const units: number[][] = [];
  for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
  for (let br = 0; br < n / boxR; br++)
    for (let bc = 0; bc < n / boxC; bc++) {
      const u: number[] = [];
      for (let r = 0; r < boxR; r++) for (let c = 0; c < boxC; c++) u.push((br * boxR + r) * n + bc * boxC + c);
      units.push(u);
    }
  if (diag) {
    units.push(Array.from({ length: n }, (_, i) => i * n + i));
    units.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  }
  const cellUnits: number[][] = Array.from({ length: n * n }, () => []);
  units.forEach((u, i) => u.forEach((cell) => cellUnits[cell].push(i)));
  const peers = Array.from({ length: n * n }, (_, cell) => {
    const s = new Set<number>();
    cellUnits[cell].forEach((ui) => units[ui].forEach((p) => p !== cell && s.add(p)));
    return [...s];
  });
  const g: Geometry = { n, boxR, boxC, units, peers, cellUnits, diag };
  geoCache.set(key, g);
  return g;
}

export const rowOf = (n: number, cell: number) => Math.floor(cell / n);
export const colOf = (n: number, cell: number) => cell % n;
export function boxOf(g: Geometry, cell: number) {
  const r = rowOf(g.n, cell), c = colOf(g.n, cell);
  return Math.floor(r / g.boxR) * (g.n / g.boxC) + Math.floor(c / g.boxC);
}

export function parseBoard(s: string): Board {
  return [...s].map((ch) => (ch === '.' || ch === '0' ? 0 : parseInt(ch, 10)));
}
export function boardToString(b: Board): string {
  return b.map((v) => (v ? String(v) : '.')).join('');
}
export function sizeOfLength(len: number): Size {
  if (len === 16) return 4;
  if (len === 36) return 6;
  if (len === 81) return 9;
  throw new Error('bad board length ' + len);
}

/** 같은 행·열·박스에 같은 숫자가 있는 칸 목록 */
export function conflicts(b: Board, n: Size, diag = false): Set<number> {
  const g = geometry(n, diag);
  const bad = new Set<number>();
  for (const u of g.units) {
    const seen = new Map<number, number[]>();
    for (const cell of u) {
      const v = b[cell];
      if (!v) continue;
      const arr = seen.get(v) ?? [];
      arr.push(cell);
      seen.set(v, arr);
    }
    for (const arr of seen.values()) if (arr.length > 1) arr.forEach((c) => bad.add(c));
  }
  return bad;
}

export function isComplete(b: Board, n: Size, diag = false): boolean {
  return b.every((v) => v >= 1 && v <= n) && conflicts(b, n, diag).size === 0;
}

// ---- 비트마스크 후보 ----
export const bit = (d: number) => 1 << (d - 1);
export function popcount(m: number) {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}
export function digitsOf(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; m; d++, m >>= 1) if (m & 1) out.push(d);
  return out;
}

/** 보드 숫자만으로 계산한 후보(메모와 무관) */
export function computeCandidates(b: Board, n: Size, diag = false): number[] {
  const g = geometry(n, diag);
  const all = (1 << n) - 1;
  return b.map((v, cell) => {
    if (v) return 0;
    let m = all;
    for (const p of g.peers[cell]) if (b[p]) m &= ~bit(b[p]);
    return m;
  });
}

// ---- 백트래킹 해 개수 (유일해 검증) ----
export function countSolutions(b0: Board, n: Size, limit = 2, diag = false): { count: number; solution: Board | null } {
  const g = geometry(n, diag);
  const b = b0.slice();
  if (conflicts(b, n, diag).size) return { count: 0, solution: null };
  let count = 0;
  let solution: Board | null = null;
  const all = (1 << n) - 1;
  const rec = (): boolean => {
    let best = -1, bestMask = 0, bestCount = 99;
    for (let cell = 0; cell < b.length; cell++) {
      if (b[cell]) continue;
      let m = all;
      for (const p of g.peers[cell]) if (b[p]) m &= ~bit(b[p]);
      const c = popcount(m);
      if (c === 0) return false;
      if (c < bestCount) {
        best = cell; bestMask = m; bestCount = c;
        if (c === 1) break;
      }
    }
    if (best < 0) {
      count++;
      if (!solution) solution = b.slice();
      return count >= limit;
    }
    for (const d of digitsOf(bestMask)) {
      b[best] = d;
      if (rec()) return true;
    }
    b[best] = 0;
    return false;
  };
  rec();
  return { count, solution };
}

export function solve(b: Board, n: Size, diag = false): Board | null {
  const r = countSolutions(b, n, 2, diag);
  return r.count === 1 ? r.solution : null;
}
