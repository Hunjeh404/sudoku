// 현재 보드에서 실제로 성립하는 논리로 4단계 힌트를 만든다. 생성형 AI 없이 규칙으로만.
import { Board, Size, geometry, conflicts, rowOf, colOf, countSolutions } from './engine';
import { Step, makeState, nextStep, applyStep, TECH_NAME_KO, Technique } from './logic';

export interface Hint {
  kind: 'conflict' | 'wrong' | 'logic' | 'reveal' | 'done';
  focusCells: number[]; // 1단계: 볼 영역
  focusUnits: number[];
  rule: string; // 2단계: 생각할 규칙
  detail: string; // 3단계: 구체적 이유
  answer?: { cell: number; digit: number }; // 4단계: 숫자 넣기
  technique?: Technique;
  revealOnly?: boolean; // 논리 설명 없이 답만 보여 주는 경우('정답 보기')
}

export function unitLabel(n: Size, ui: number): string {
  if (ui < n) return `위에서 ${ui + 1}번째 가로줄`;
  if (ui < 2 * n) return `왼쪽에서 ${ui - n + 1}번째 세로줄`;
  return `${ui - 2 * n + 1}번 상자`;
}
export function cellLabel(n: Size, cell: number): string {
  return `가로줄 ${rowOf(n, cell) + 1}·세로줄 ${colOf(n, cell) + 1} 칸`;
}
const listDigits = (ds: number[]) => ds.join(', ');

export function describeStep(n: Size, st: Step, sym: (d: number) => string = String): string {
  const u0 = st.units[0] !== undefined ? unitLabel(n, st.units[0]) : '';
  const ds = st.digits.map(sym);
  switch (st.technique) {
    case 'nakedSingle': {
      const c = st.placement!.cell;
      return `${cellLabel(n, c)}은 같은 가로줄·세로줄·상자에 다른 숫자가 모두 있어서 들어갈 수 있는 숫자가 ${ds[0]} 하나뿐이에요.`;
    }
    case 'hiddenSingle':
      return `${u0}에서 ${ds[0]}이(가) 들어갈 수 있는 칸은 ${cellLabel(n, st.placement!.cell)} 하나뿐이에요. 다른 빈칸은 같은 줄이나 상자에 이미 ${ds[0]}이(가) 있어요.`;
    case 'pointing':
      return `${unitLabel(n, st.units[0])}에서 ${ds[0]}은(는) ${unitLabel(n, st.units[1])} 위의 칸에만 들어갈 수 있어요. 그래서 ${unitLabel(n, st.units[1])}에서 이 상자 바깥 칸에는 ${ds[0]}이(가) 올 수 없어요.`;
    case 'claiming':
      return `${unitLabel(n, st.units[0])}에서 ${ds[0]}은(는) ${unitLabel(n, st.units[1])} 안의 칸에만 들어갈 수 있어요. 그래서 그 상자의 다른 칸에는 ${ds[0]}이(가) 올 수 없어요.`;
    case 'nakedPair':
    case 'nakedTriple':
      return `${u0}의 ${st.cells.length}칸(${st.cells.map((c) => cellLabel(n, c)).join(', ')})에는 ${listDigits(ds)}만 들어갈 수 있어요. 이 숫자들은 그 칸들이 나눠 가지니까 같은 줄의 다른 칸에는 올 수 없어요.`;
    case 'hiddenPair':
    case 'hiddenTriple':
      return `${u0}에서 ${listDigits(ds)}은(는) ${st.cells.map((c) => cellLabel(n, c)).join(', ')}에만 들어갈 수 있어요. 그러니 그 칸들에는 다른 숫자가 올 수 없어요.`;
    case 'xWing': {
      const [a, b, c, d] = st.units;
      return `${ds[0]}은(는) ${unitLabel(n, a)}과 ${unitLabel(n, b)}에서 각각 같은 두 자리에만 들어갈 수 있어요. 네모 모양으로 짝이 맞으니 ${unitLabel(n, c)}과 ${unitLabel(n, d)}의 다른 칸에는 ${ds[0]}이(가) 올 수 없어요.`;
    }
  }
}

const RULE_TEXT: Record<Technique, string> = {
  nakedSingle: '한 칸에 들어갈 수 있는 숫자가 하나만 남았는지 살펴보세요.',
  hiddenSingle: '어떤 숫자가 이 줄(또는 상자)에서 들어갈 자리가 한 곳뿐인지 살펴보세요.',
  pointing: '한 상자 안에서 어떤 숫자의 자리가 한 줄에 모여 있는지 살펴보세요.',
  claiming: '한 줄 안에서 어떤 숫자의 자리가 한 상자에 모여 있는지 살펴보세요.',
  nakedPair: '두 칸이 같은 두 숫자만 가질 수 있는지 살펴보세요.',
  hiddenPair: '두 숫자가 같은 두 칸에만 들어갈 수 있는지 살펴보세요.',
  nakedTriple: '세 칸이 세 숫자만 나눠 가질 수 있는지 살펴보세요.',
  hiddenTriple: '세 숫자가 같은 세 칸에만 들어갈 수 있는지 살펴보세요.',
  xWing: '한 숫자의 자리가 두 줄에서 똑같이 두 곳씩인지 살펴보세요.',
};

/**
 * givens: 초기 숫자, board: 현재 보드(사용자 입력 포함).
 * 해는 givens로 계산(서버 정답과 같음, 유일해 문제).
 */
export function makeHint(givens: Board, board: Board, n: Size, sym: (d: number) => string = String): Hint {
  const g = geometry(n);
  const bad = conflicts(board, n);
  if (bad.size) {
    const cells = [...bad].filter((c) => !givens[c]);
    return {
      kind: 'conflict', focusCells: [...bad], focusUnits: [],
      rule: '같은 줄이나 상자에 같은 숫자가 두 번 들어가 있어요.',
      detail: `표시된 칸에 같은 숫자가 겹쳐 있어요. ${cells.length ? cells.map((c) => cellLabel(n, c)).join(', ') + ' 중에서 먼저 하나를 지워 보세요.' : ''}`,
    };
  }
  const solution = countSolutions(givens, n, 2).solution!;
  const wrong = board.map((v, c) => (v && !givens[c] && v !== solution[c] ? c : -1)).filter((c) => c >= 0);
  if (wrong.length) {
    return {
      kind: 'wrong', focusCells: wrong, focusUnits: [],
      rule: '지금 넣은 숫자 가운데 끝까지 가면 맞지 않는 숫자가 있어요.',
      detail: `${wrong.slice(0, 3).map((c) => cellLabel(n, c)).join(', ')}${wrong.length > 3 ? ` 외 ${wrong.length - 3}칸` : ''}의 숫자를 다시 생각해 보세요. 지우고 힌트를 다시 누르면 다음 단서를 알려 줄게요.`,
    };
  }
  if (board.every((v) => v)) return { kind: 'done', focusCells: [], focusUnits: [], rule: '모든 칸이 채워졌어요.', detail: '' };

  // 현재 보드에서 논리로 다음 숫자가 정해질 때까지 진행
  const s = makeState(board, n);
  const chain: Step[] = [];
  for (let i = 0; i < 40; i++) {
    const st = nextStep(s, 3);
    if (!st) break;
    chain.push(st);
    applyStep(s, st);
    if (st.placement) break;
  }
  const last = chain[chain.length - 1];
  if (!last || !last.placement) {
    // 논리 기법으로 막힌 경우: 설명 없는 정답 보기
    const cell = board.findIndex((v) => !v);
    return {
      kind: 'reveal', focusCells: [cell], focusUnits: g.cellUnits[cell], revealOnly: true,
      rule: '지금은 알고 있는 규칙만으로 다음 숫자를 설명하기 어려워요.',
      detail: '정답 보기로 한 칸을 채울 수 있어요.',
      answer: { cell, digit: solution[cell] },
    };
  }
  const hardest = chain.reduce((a, b) => (TECH_ORDER.indexOf(b.technique) > TECH_ORDER.indexOf(a.technique) ? b : a));
  const detail = chain.slice(-3).map((st) => describeStep(n, st, sym)).join(' ');
  return {
    kind: 'logic',
    focusCells: [last.placement.cell, ...hardest.cells],
    focusUnits: hardest.units.length ? hardest.units : last.units,
    rule: `${TECH_NAME_KO[hardest.technique]}: ${RULE_TEXT[hardest.technique]}`,
    detail,
    answer: last.placement,
    technique: hardest.technique,
  };
}

const TECH_ORDER: Technique[] = ['nakedSingle', 'hiddenSingle', 'pointing', 'claiming', 'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'xWing'];
