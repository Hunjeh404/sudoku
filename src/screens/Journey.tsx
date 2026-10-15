// 여정(끝낸 판 수로 받는 보상)과 초상화 선물 고르기
import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { JOURNEY, rewardText, STORY_EVERY } from '../data/catalog';
import { useGame } from '../lib/store';
import { rpc, ApiError } from '../lib/api';
import { loadPeople, Person } from '../lib/content';
import { Sheet, ErrorLine, Avatar } from '../ui';
import { sfx } from '../lib/sound';
import { josa } from '../lib/josa';

export const nextJourney = (count: number) => JOURNEY.find((j) => j.need > count) ?? null;

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const n = state!.quest.completed_count;
  return (
    <Sheet title="여정" onClose={onClose}>
      <p className="fine">스도쿠를 끝낸 판 수만큼 나아가요. 크기·난이도·힌트와 상관없이 한 판은 한 걸음이에요. 지금 {n}판.</p>
      <ol className="journey">
        {JOURNEY.map((j) => {
          const done = j.need <= n;
          const next = !done && nextJourney(n)?.step === j.step;
          return (
            <li key={j.step} className={done ? 'done' : next ? 'next' : ''}>
              <span className="j-mark" aria-hidden>{done ? <IconCheck size={16} /> : j.need}</span>
              <div><strong>{j.title}</strong><small>{j.need}판: {rewardText(j.reward)}{next ? ` · ${j.need - n}판 남음` : ''}</small></div>
            </li>
          );
        })}
      </ol>
      {n >= JOURNEY[JOURNEY.length - 1].need && <p>여정을 모두 마쳤어요. 이제 마음껏 풀면서 별빛과 초상화를 모으세요.</p>}
      <p className="fine">이야기책: 1장은 처음부터, 이후 {STORY_EVERY}판마다 한 장씩 열려요. 지금 {Math.min(16, Math.floor(n / STORY_EVERY) + 1)}장까지 열렸어요{n < 15 * STORY_EVERY ? `. 다음 장까지 ${STORY_EVERY - (n % STORY_EVERY)}판` : ''}.</p>
      <p className="fine">힌트 없이 끝낸 판: {state!.quest.no_hint_count}판</p>
    </Sheet>
  );
}

/** 여정 선물 상자: 그 티어 초상화 셋 중 하나 */
export function GiftSheet({ onClose }: { onClose: () => void }) {
  const { state, profileId, patchState, toast } = useGame();
  const gift = state!.gifts[0];
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadPeople().then((l) => setPeople(Object.fromEntries(l.map((p) => [p.id, p])))).catch(() => {}); }, []);
  if (!gift) return null;
  const pick = async (id: string) => {
    setBusy(true);
    try {
      await rpc('claim_gift', { p: profileId, gift: gift.id, portrait: id });
      patchState((s) => ({ ...s, owned: [...s.owned, id], gifts: s.gifts.slice(1), profile: { ...s.profile, avatar_id: s.profile.avatar_id || id } }));
      sfx.success();
      const name = people[id]?.ko ?? '초상화';
      toast(`${josa(name, '을/를')} 모았어요`);
      onClose();
    } catch (e) { setErr((e as ApiError).message); setBusy(false); }
  };
  return (
    <Sheet title={`${gift.tier}티어 초상화 선물`} onClose={onClose}>
      <p>셋 중 하나를 골라 가지세요. 나머지는 나중에 도감에서 별빛으로 살 수 있어요.</p>
      <div className="gift-row">
        {gift.options.map((id) => (
          <button key={id} className="gift-card" onClick={() => pick(id)} disabled={busy}>
            <Avatar id={id} size={84} />
            <strong>{people[id]?.ko ?? ''}</strong>
            <small>{people[id]?.dom ?? ''}</small>
          </button>
        ))}
      </div>
      {err && <ErrorLine msg={err} />}
    </Sheet>
  );
}
