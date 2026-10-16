// 신화 난이도(대각선 스도쿠) 문제 은행 생성: npx tsx scripts/gen-diag-puzzles.ts
// 결과: puzzles/bank-diag.json(정답 포함) + supabase/migrations/0019_diag_xwing.sql(문제·정답, 0017의 옛 문제는 그만 냄)
// 유일해(대각선 규칙 포함)와 논리 풀이 확인, X-Wing이 꼭 필요한 문제만
import { writeFileSync } from 'node:fs';
import { generateOne, mulberry32, relabelKey } from '../src/sudoku/generate';
import { boardToString } from '../src/sudoku/engine';

const COUNT = 60;
const rnd = mulberry32(20261017);
const bank: any[] = [];
const seen = new Set<string>();
let tries = 0;
while (bank.length < COUNT) {
  tries++;
  const minG = 22 + Math.floor(rnd() * 4); // 22~25
  const p = generateOne(9, rnd, minG, true);
  if (!p.grade.solved || !p.grade.techniques.xWing) continue; // X-Wing 없이는 막히는 문제만
  if (p.givenCount > 27) continue;
  const key = relabelKey(p.givens);
  if (seen.has(key)) continue;
  seen.add(key);
  bank.push({ id: `p9x-${String(bank.length + 1).padStart(3, '0')}`, size: 9, difficulty: 'diag', givens: boardToString(p.givens),
    solution: boardToString(p.solution), givenCount: p.givenCount, techniques: p.grade.techniques });
}
console.log('done after', tries, 'tries; avg givens', bank.reduce((a, p) => a + p.givenCount, 0) / bank.length);
writeFileSync('puzzles/bank-diag.json', JSON.stringify(bank, null, 1));
const esc = (s: string) => s.replace(/'/g, "''");
writeFileSync('supabase/migrations/0019_diag_xwing.sql',
  `-- 자동 생성: npx tsx scripts/gen-diag-puzzles.ts (신화 난이도: 대각선 스도쿠, X-Wing이 필요한 문제 ${bank.length}개, 유일해·논리 풀이 검증)\n` +
  `-- 0017의 옛 신화 문제(p9d-)는 지우지 않고(지난 판·기록 보존) 새 판으로는 내지 않는다(retired).\n` +
  `alter table public.puzzle_catalog add column if not exists retired boolean not null default false;\n` +
  `update public.puzzle_catalog set retired = true where id like 'p9d-%';\n\n` +
  `insert into public.puzzle_catalog (id,size,difficulty,givens,techniques,version) values\n` +
  bank.map((p) => `('${p.id}',9,'diag','${p.givens}','${esc(JSON.stringify(p.techniques))}'::jsonb,1)`).join(',\n') + `\non conflict (id) do nothing;\n\n` +
  `insert into private.puzzle_solutions (puzzle_id,solution) values\n` + bank.map((p) => `('${p.id}','${p.solution}')`).join(',\n') + `\non conflict (puzzle_id) do nothing;\n`);
