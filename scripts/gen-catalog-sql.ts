// npm run gen:catalog → supabase/migrations/0003_catalog.sql
import { writeFileSync, readFileSync } from 'node:fs';
import { ITEMS, JOURNEY, REWARD_RULES } from '../src/data/catalog';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => `array[${a.map(q).join(',')}]::text[]`;
const items = ITEMS.map((i, n) => `(${q(i.id)},${q(i.kind)},${q(i.nameKo)},${i.price},${q(i.surface)},${i.fw},${i.fh},${i.blocking},${arr(i.spaces)},${arr(i.supports ?? [])},${i.unlockStep},${n})`);
const journey = JOURNEY.map((j) => `(${j.step},${q(j.title)},${q(JSON.stringify(j.reward))}::jsonb)`);
const rules = REWARD_RULES.map((r) => `(${r.size},${q(r.difficulty)},${r.amount})`);
const book = JSON.parse(readFileSync('public/data/book.json', 'utf8'));
const scenes: string[] = [];
for (const ch of book) if (ch.open) for (const b of ch.b) if (b.k === 'img') scenes.push(`(${q(b.f)},${ch.n})`);

writeFileSync('supabase/migrations/0003_catalog.sql', `-- 자동 생성: npm run gen:catalog (src/data/catalog.ts가 원본)
insert into public.item_catalog (id,kind,name_ko,price,surface,fw,fh,blocking,spaces,supports,unlock_step,sort) values
${items.join(',\n')}
on conflict (id) do update set kind=excluded.kind,name_ko=excluded.name_ko,price=excluded.price,surface=excluded.surface,fw=excluded.fw,fh=excluded.fh,
  blocking=excluded.blocking,spaces=excluded.spaces,supports=excluded.supports,unlock_step=excluded.unlock_step,sort=excluded.sort;

insert into public.journey_steps (step,title,reward) values
${journey.join(',\n')}
on conflict (step) do update set title=excluded.title,reward=excluded.reward;

insert into public.reward_rules (size,difficulty,amount) values
${rules.join(',\n')}
on conflict (size,difficulty) do update set amount=excluded.amount;

insert into public.scene_catalog (file,chapter) values
${scenes.join(',\n')}
on conflict (file) do update set chapter=excluded.chapter;
`);
console.log('items', items.length, 'scenes', scenes.length);
