// 신화 난이도(대각선 스도쿠) 문제 은행 생성: npx tsx scripts/gen-diag-puzzles.ts
// 결과: puzzles/bank-diag.json(정답 포함) + supabase/migrations/0017_diag_puzzles.sql(문제·정답)
// 유일해(대각선 규칙 포함)와 논리 풀이(보통~어려움 기법) 확인한 문제만
import { writeFileSync } from 'node:fs';
import { generateOne, mulberry32, relabelKey } from '../src/sudoku/generate';
import { boardToString } from '../src/sudoku/engine';

const COUNT = 60;
const rnd = mulberry32(20261016);
const bank: any[] = [];
const seen = new Set<string>();
let tries = 0;
while (bank.length < COUNT) {
  tries++;
  const minG = 22 + Math.floor(rnd() * 4); // 22~25
  const p = generateOne(9, rnd, minG, true);
  if (!p.grade.solved || p.grade.level < 2) continue;
  if (p.givenCount > 27) continue;
  const key = relabelKey(p.givens);
  if (seen.has(key)) continue;
  seen.add(key);
  bank.push({ id: `p9d-${String(bank.length + 1).padStart(3, '0')}`, size: 9, difficulty: 'diag', givens: boardToString(p.givens),
    solution: boardToString(p.solution), givenCount: p.givenCount, techniques: p.grade.techniques });
}
console.log('done after', tries, 'tries; avg givens', bank.reduce((a, p) => a + p.givenCount, 0) / bank.length);
writeFileSync('puzzles/bank-diag.json', JSON.stringify(bank, null, 1));
const esc = (s: string) => s.replace(/'/g, "''");
writeFileSync('supabase/migrations/0017_diag_puzzles.sql',
  `-- 자동 생성: npx tsx scripts/gen-diag-puzzles.ts (신화 난이도: 대각선 스도쿠, 유일해·논리 풀이 검증 ${bank.length}문제)\n` +
  `insert into public.puzzle_catalog (id,size,difficulty,givens,techniques,version) values\n` +
  bank.map((p) => `('${p.id}',9,'diag','${p.givens}','${esc(JSON.stringify(p.techniques))}'::jsonb,1)`).join(',\n') + `\non conflict (id) do nothing;\n\n` +
  `insert into private.puzzle_solutions (puzzle_id,solution) values\n` + bank.map((p) => `('${p.id}','${p.solution}')`).join(',\n') + `\non conflict (puzzle_id) do nothing;\n`);
