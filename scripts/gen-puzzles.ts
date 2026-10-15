// 문제 은행 생성: npm run gen:puzzles
// 결과: puzzles/bank.json(정답 포함, 저장소 보관용) + supabase/migrations/0005_puzzle_bank.sql
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateOne, mulberry32, relabelKey } from '../src/sudoku/generate';
import { boardToString, Size } from '../src/sudoku/engine';

interface Target { prefix: string; size: Size; difficulty: 'intro' | 'easy' | 'medium' | 'hard'; count: number; level: 1 | 2 | 3; givens: [number, number] }
const TARGETS: Target[] = [
  { prefix: 'p4', size: 4, difficulty: 'intro', count: 24, level: 1, givens: [5, 7] },
  { prefix: 'p6', size: 6, difficulty: 'intro', count: 48, level: 1, givens: [11, 15] },
  { prefix: 'p9e', size: 9, difficulty: 'easy', count: 60, level: 1, givens: [34, 38] },
  { prefix: 'p9m', size: 9, difficulty: 'medium', count: 60, level: 2, givens: [24, 28] },
  { prefix: 'p9h', size: 9, difficulty: 'hard', count: 60, level: 3, givens: [22, 25] },
];

const rnd = mulberry32(20261015);
const bank: any[] = [];
for (const t of TARGETS) {
  const seen = new Set<string>();
  let tries = 0;
  while (bank.filter((p) => p.prefix === t.prefix).length < t.count) {
    tries++;
    const minG = t.givens[0] + Math.floor(rnd() * (t.givens[1] - t.givens[0] + 1));
    const p = generateOne(t.size, rnd, minG);
    if (!p.grade.solved || p.grade.level !== t.level) continue;
    if (p.givenCount > t.givens[1] + 2) continue;
    const key = relabelKey(p.givens);
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = bank.filter((q) => q.prefix === t.prefix).length + 1;
    bank.push({
      prefix: t.prefix,
      id: `${t.prefix}-${String(idx).padStart(3, '0')}`,
      size: t.size,
      difficulty: t.difficulty,
      givens: boardToString(p.givens),
      solution: boardToString(p.solution),
      givenCount: p.givenCount,
      techniques: p.grade.techniques,
    });
  }
  console.log(t.prefix, 'done after', tries, 'tries');
}

mkdirSync('puzzles', { recursive: true });
writeFileSync('puzzles/bank.json', JSON.stringify(bank.map(({ prefix, ...r }) => r), null, 1));
const esc = (s: string) => s.replace(/'/g, "''");
const rows = bank.map((p) => `('${p.id}',${p.size},'${p.difficulty}','${p.givens}','${esc(JSON.stringify(p.techniques))}'::jsonb,1)`);
const sols = bank.map((p) => `('${p.id}','${p.solution}')`);
writeFileSync('supabase/migrations/0005_puzzle_bank.sql',
  `-- 자동 생성: npm run gen:puzzles (유일해·논리 풀이 검증 완료 ${bank.length}문제)\n` +
  `insert into public.puzzle_catalog (id,size,difficulty,givens,techniques,version) values\n${rows.join(',\n')}\non conflict (id) do nothing;\n\n` +
  `insert into private.puzzle_solutions (puzzle_id,solution) values\n${sols.join(',\n')}\non conflict (puzzle_id) do nothing;\n`);
console.log('total', bank.length);
