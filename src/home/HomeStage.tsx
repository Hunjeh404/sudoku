// 놀이 모드의 집: 반응 실행(쿨다운·동시 효과 상한), 등불 켜기(방문자는 기기에서만), 패널 열기
import { useCallback, useRef, useState } from 'react';
import { ITEM_BY_ID, Space } from '../data/catalog';
import type { Layout } from '../lib/store';
import { getLocal, setLocal } from '../lib/local';
import { duckMusic } from '../lib/sound';
import { SpaceView } from './SpaceView';
import { Effect } from './effects';
import { REACTIONS, PanelKind } from './interactions';

const MAX_EFFECTS = 3;
let effectSeq = 1;

export function useReactions(reducedMotion: boolean) {
  const [effects, setEffects] = useState<Effect[]>([]);
  const last = useRef<Record<string, number>>({});
  const fire = useCallback((uid: string, kind: Effect['kind'], ms: number, extra?: Partial<Effect>) => {
    const e: Effect = { id: effectSeq++, uid, kind, until: Date.now() + ms, ...extra };
    setEffects((list) => [...list.filter((x) => x.until > Date.now()), e].slice(-MAX_EFFECTS));
    window.setTimeout(() => setEffects((list) => list.filter((x) => x.id !== e.id)), reducedMotion ? Math.min(ms, 500) : ms);
  }, [reducedMotion]);
  const allowed = (uid: string, cooldown: number) => {
    const now = Date.now();
    if ((last.current[uid] ?? 0) + cooldown > now) return false;
    last.current[uid] = now;
    return true;
  };
  return { effects, fire, allowed };
}

export interface HomeStageProps {
  space: Space;
  layout: Layout[];
  storageKey: string; // 등불 상태를 기기에 보관하는 키(주인/방문자 구분)
  reducedMotion: boolean;
  onPanel: (kind: PanelKind, l: Layout) => void;
  onNote?: (l: Layout) => void;
  mirrorFace?: Record<string, string>;
  label: string;
}

export function HomeStage(p: HomeStageProps) {
  const { effects, fire, allowed } = useReactions(p.reducedMotion);
  const [lit, setLit] = useState<Record<string, boolean>>(() => getLocal(p.storageKey, {}));
  const onTap = (l: Layout) => {
    const it = ITEM_BY_ID[l.item];
    const r = REACTIONS[it.interaction];
    if (!r || !allowed(l.uid, r.cooldown)) return;
    r.sound?.();
    if (r.sound) duckMusic(600);
    if (r.toggle) {
      setLit((cur) => {
        const next = { ...cur, [l.uid]: !cur[l.uid] };
        setLocal(p.storageKey, next);
        return next;
      });
    }
    if (r.effect) fire(l.uid, r.effect, r.ms, { anchor: r.anchor, amount: r.amount });
    if (r.extra) fire(l.uid, r.extra, Math.max(r.ms, 600), { anchor: r.anchor });
    if (p.mirrorFace?.[l.uid] && it.id === 'mirror_shield') fire(l.uid, 'mirror', 2500, { data: p.mirrorFace[l.uid] });
    p.onNote?.(l);
    if (r.panel) window.setTimeout(() => p.onPanel(r.panel!, l), r.ms ? Math.min(r.ms, 350) : 0);
  };
  return (
    <SpaceView space={p.space} layout={p.layout} mode="play" lit={lit} effects={effects} reducedMotion={p.reducedMotion}
      onTapItem={onTap} label={p.label} />
  );
}
