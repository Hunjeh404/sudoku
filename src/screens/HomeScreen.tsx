import { useState } from 'react';
import { IconBrush, IconRoute } from '@tabler/icons-react';
import { useGame, Layout } from '../lib/store';
import { GUIDES, ITEM_BY_ID, Space, FIRST_CHOICE, JOURNEY } from '../data/catalog';
import { HomeStage } from '../home/HomeStage';
import { PanelHost, PanelCtx } from '../panels/Panels';
import type { PanelKind } from '../home/interactions';
import { Editor } from './Editor';
import { JourneySheet, ChoiceSheet } from './Journey';
import { Avatar } from '../ui';
import { josa } from '../lib/josa';

export function HomeScreen({ goSudoku, visit }: { goSudoku: () => void; visit: (id: string) => void }) {
  const { state, settings, profileId } = useGame();
  const [space, setSpace] = useState<Space>('room');
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<{ kind: PanelKind; item: Layout } | null>(null);
  const [journey, setJourney] = useState(false);
  const [choice, setChoice] = useState(false);
  const [mirror, setMirror] = useState<Record<string, string>>({});
  if (!state) return null;
  if (editing) return <Editor initialSpace={space} onClose={() => setEditing(false)} />;

  const guide = GUIDES.find((g) => g.id === state.profile.guide_id) ?? GUIDES[0];
  const q = state.quest;
  const goal = state.profile.goal_item ? ITEM_BY_ID[state.profile.goal_item] : null;
  const layout = space === 'room' ? state.home.room_layout : state.home.garden_layout;
  const ctx: PanelCtx | null = panel && {
    kind: panel.kind, item: panel.item, layout, home: state.home, ownerId: profileId!, ownerName: state.profile.nickname, isOwner: true,
    unlocks: state.unlocks, onVisit: visit, onMirror: (uid, f) => setMirror((m) => ({ ...m, [uid]: f })),
  };

  let bubble: { text: string; action?: { label: string; run: () => void } };
  if (q.choice_pending) bubble = { text: '첫 별빛을 모았구나! 집에 둘 선물을 하나 골라 봐.', action: { label: '선물 고르기', run: () => setChoice(true) } };
  else if (q.completed_count === 0) bubble = { text: `${guide.line} 스도쿠 한 판으로 첫 별빛을 모아 볼까?`, action: { label: '스도쿠 하러 가기', run: goSudoku } };
  else if (goal) {
    const need = Math.max(0, goal.price - state.balance);
    bubble = need > 0
      ? { text: `목표「${goal.nameKo}」까지 별빛 ${need}만큼 남았어.`, action: { label: '한 판 더', run: goSudoku } }
      : { text: `별빛이 모였어! 꾸미기 상점에서「${goal.nameKo}」${josa(goal.nameKo, '을/를').slice(goal.nameKo.length)} 살 수 있어.`, action: { label: '꾸미러 가기', run: () => setEditing(true) } };
  } else bubble = { text: '물건을 눌러 보면 저마다 다르게 반응해. 꾸미기 상점에서 다음 목표도 정해 봐.' };

  const nextStep = JOURNEY[q.completed_count];

  return (
    <div className="home">
      <div className="home-top">
        <div className="seg" role="tablist" aria-label="공간">
          {(['room', 'garden'] as Space[]).map((sp) => <button key={sp} role="tab" aria-selected={space === sp} className={space === sp ? 'on' : ''}
            onClick={() => setSpace(sp)}>{sp === 'room' ? '실내' : '정원'}</button>)}
        </div>
        <h1 className="home-name">{state.profile.home_name || `${state.profile.nickname}의 집`}</h1>
      </div>
      <HomeStage key={space} space={space} layout={layout} storageKey={`lit:${profileId}:${profileId}`} reducedMotion={settings.reducedMotion}
        onPanel={(kind, item) => setPanel({ kind, item })} mirrorFace={mirror} label={space === 'room' ? '내 집 실내' : '내 집 정원'} />
      <div className="guide-bubble">
        <Avatar id={guide.id} size={52} />
        <div className="grow">
          <p><strong>{guide.name}</strong> {bubble.text}</p>
          {bubble.action && <button className="btn primary small" onClick={bubble.action.run}>{bubble.action.label}</button>}
        </div>
      </div>
      <div className="home-actions">
        <button className="btn big" onClick={() => setEditing(true)}><IconBrush aria-hidden />꾸미기</button>
        <button className="btn big" onClick={() => setJourney(true)}><IconRoute aria-hidden />여정 {Math.min(q.completed_count, 12)}/12
          {nextStep && <small>다음: {nextStep.title}</small>}</button>
      </div>
      {ctx && <PanelHost ctx={ctx} onClose={() => setPanel(null)} />}
      {journey && <JourneySheet onClose={() => setJourney(false)} />}
      {choice && <ChoiceSheet items={FIRST_CHOICE} onClose={() => setChoice(false)} />}
    </div>
  );
}
