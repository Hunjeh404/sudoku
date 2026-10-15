// 여정(끝낸 판 수로 받는 보상)과 초상화 선물 고르기
import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { JOURNEY, rewardText, storyEvery } from '../data/catalog';
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
  const E = storyEvery(state!.profile.title); // 이야기책 몇 판마다(칭호「이야기꾼」 4판)
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
      <p className="fine">이야기책: 1장은 처음부터, 이후 {E}판마다 한 장씩 열려요. 지금 {Math.min(16, Math.floor(n / E) + 1)}장까지 열렸어요{n < 15 * E ? `. 다음 장까지 ${E - (n % E)}판` : ''}.</p>
      <p className="fine">힌트 없이 끝낸 판: {state!.quest.no_hint_count}판</p>
    </Sheet>
  );
}

/** 여정 선물 상자: 그 티어 초상화 셋(음유시인은 넷) 중 하나 */
export function GiftSheet({ onClose }: { onClose: () => void }) {
  const { state, profileId, patchState, toast, gotTitles } = useGame();
  const gift = state!.gifts[0];
  // 칭호「무사이의 친구」: 하루 한 번 다시 뽑기(한국 날짜 기준)
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const canReroll = state!.profile.title === 'read16' && !state!.unlocks.includes(`reroll:${today}`);
  const reroll = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await rpc<{ options: string[] }>('reroll_gift', { p: profileId, gift: gift.id });
      patchState((s) => ({ ...s, unlocks: [...s.unlocks.filter((k) => !k.startsWith('reroll:')), `reroll:${today}`],
        gifts: s.gifts.map((g) => (g.id === gift.id ? { ...g, options: r.options } : g)) }));
    } catch (e) { setErr((e as ApiError).message); }
    setBusy(false);
  };
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadPeople().then((l) => setPeople(Object.fromEntries(l.map((p) => [p.id, p])))).catch(() => {}); }, []);
  if (!gift) return null;
  const pick = async (id: string) => {
    setBusy(true);
    try {
      const r = await rpc('claim_gift', { p: profileId, gift: gift.id, portrait: id });
      patchState((s) => ({ ...s, owned: [...s.owned, id], gifts: s.gifts.slice(1), profile: { ...s.profile, avatar_id: s.profile.avatar_id || id } }));
      sfx.success();
      const name = people[id]?.ko ?? '초상화';
      toast(`${josa(name, '을/를')} 모았어요`);
      gotTitles(r.titles);
      onClose();
    } catch (e) { setErr((e as ApiError).message); setBusy(false); }
  };
  return (
    <Sheet title={`${gift.tier}티어 초상화 선물`} onClose={onClose}>
      <p>{gift.options.length === 4 ? '넷' : '셋'} 중 하나를 골라 가지세요. 나머지는 나중에 도감에서 별빛으로 살 수 있어요.</p>
      <div className="gift-row">
        {gift.options.map((id) => (
          <button key={id} className="gift-card" onClick={() => pick(id)} disabled={busy}>
            <Avatar id={id} size={84} />
            <strong>{people[id]?.ko ?? ''}</strong>
            <small>{people[id]?.dom ?? ''}</small>
          </button>
        ))}
      </div>
      {canReroll && <div className="row-end"><small>무사이의 친구: 하루 한 번</small><button className="btn small" onClick={reroll} disabled={busy}>다시 뽑기</button></div>}
      {err && <ErrorLine msg={err} />}
    </Sheet>
  );
}
