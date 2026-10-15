import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { JOURNEY, ITEM_BY_ID } from '../data/catalog';
import { useGame, asset } from '../lib/store';
import { rpc, ApiError } from '../lib/api';
import { Sheet, ErrorLine } from '../ui';
import { sfx } from '../lib/sound';
import { josa } from '../lib/josa';

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const n = state!.quest.completed_count;
  return (
    <Sheet title="입문 여정" onClose={onClose}>
      <p className="fine">스도쿠를 한 판 끝낼 때마다 한 칸씩 나아가요. 크기·난이도·힌트와 상관없이 한 판은 한 칸이에요.</p>
      <ol className="journey">
        {JOURNEY.map((j) => (
          <li key={j.step} className={j.step <= n ? 'done' : j.step === n + 1 ? 'next' : ''}>
            <span className="j-mark" aria-hidden>{j.step <= n ? <IconCheck size={16} /> : j.step}</span>
            <div><strong>{j.title}</strong><small>{j.desc}</small></div>
          </li>
        ))}
      </ol>
      {n >= 12 && <p>여정을 모두 마쳤어요. 이제 마음껏 풀면서 별빛을 모으세요.</p>}
      <p className="fine">힌트 없이 끝낸 판: {state!.quest.no_hint_count}판</p>
    </Sheet>
  );
}

export function ChoiceSheet({ items, onClose }: { items: string[]; onClose: () => void }) {
  const { profileId, patchState, toast } = useGame();
  const [err, setErr] = useState<string | null>(null);
  const pick = async (id: string) => {
    try {
      await rpc('claim_choice', { p: profileId, item: id });
      patchState((s) => ({ ...s, inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + 1 }, quest: { ...s.quest, choice_pending: false } }));
      sfx.success();
      toast(`${josa(ITEM_BY_ID[id].nameKo, '을/를')} 받았어요. 꾸미기 보관함에서 놓아 보세요.`);
      onClose();
    } catch (e) { setErr((e as ApiError).message); }
  };
  return (
    <Sheet title="첫 선물 고르기" onClose={onClose}>
      <p>세 가지 중 하나를 골라요. 나머지는 나중에 상점에서 살 수 있어요.</p>
      <div className="choice-row">
        {items.map((id) => {
          const it = ITEM_BY_ID[id];
          return <button key={id} className="item-card big" onClick={() => pick(id)}>
            <img src={asset(`assets/furniture/${id}.webp`)} alt="" /><span>{it.nameKo}</span><small>{it.desc}</small>
          </button>;
        })}
      </div>
      {err && <ErrorLine msg={err} />}
    </Sheet>
  );
}
