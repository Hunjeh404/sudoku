// 첫 화면: 내 초상화·칭호·별빛·점수, 선물 상자, 다음 여정, 친구 소식 미리보기
import { useState } from 'react';
import { IconGift, IconRoute, IconChevronRight } from '@tabler/icons-react';
import { useGame } from '../lib/store';
import { GUIDES, rewardText } from '../data/catalog';
import { Avatar, TitleTag, tierOf } from '../ui';
import { JourneySheet, GiftSheet, nextJourney } from './Journey';
import { FeedList } from './Friends';

const TOTAL_PORTRAITS = 390;

export function HomeScreen({ goSudoku, goFriends, goDex }: { goSudoku: () => void; goFriends: () => void; goDex: () => void }) {
  const { state } = useGame();
  const s = state!;
  const [journey, setJourney] = useState(false);
  const [gift, setGift] = useState(false);
  const q = s.quest;
  const next = nextJourney(q.completed_count);
  const hestia = GUIDES[0];

  let line: string;
  let note: string | null = null;
  if (q.completed_count === 0) line = `${hestia.line} 첫 판을 끝내면 첫 초상화를 골라 가질 수 있어요.`;
  else if (s.gifts.length) line = '선물 상자가 도착했어요! 열어서 초상화를 골라 보세요.';
  else if (next) { line = `다음 여정「${next.title}」까지 ${next.need - q.completed_count}판 남았어요.`; note = `보상: ${rewardText(next.reward)}`; }
  else line = '여정을 모두 마쳤어요. 순위표에서 이번 주 1등에 도전해 보세요.';

  return (
    <div className="page">
      <section className="me-card">
        <Avatar id={s.profile.avatar_id} size={96} badge={s.profile.badge} />
        <div className="grow">
          <h1 className="me-nick">{s.profile.nickname}</h1>
          <TitleTag id={s.profile.title} />
          {!s.profile.avatar_id && <p className="fine">아직 초상화가 없어요.</p>}
        </div>
      </section>
      <dl className="stat-row">
        <div><dt>별빛</dt><dd>✦ {s.balance.toLocaleString()}</dd></div>
        <div><dt>누적 점수</dt><dd>{s.points.total.toLocaleString()}</dd></div>
        <div><dt>이번 주</dt><dd>{s.points.week.toLocaleString()}</dd></div>
        <div><dt>모은 초상화</dt><dd><button className="link" onClick={goDex}>{s.owned.filter((id) => (tierOf(id) ?? 0) >= 1).length}<small>/{TOTAL_PORTRAITS}</small></button></dd></div>
      </dl>

      {s.gifts.length > 0 && (
        <button className="gift-banner" onClick={() => setGift(true)}>
          <IconGift size={28} aria-hidden /><span className="grow"><strong>초상화 선물 상자</strong><small>{s.gifts[0].tier}티어 초상화 셋 중 하나를 골라요</small></span>
          <IconChevronRight aria-hidden />
        </button>
      )}

      <div className="guide-bubble">
        <Avatar id={hestia.id} size={56} />
        <div><p><strong>{hestia.name}</strong> {line}{note && <small className="bubble-note">{note}</small>}</p>
          <button className="btn small primary" onClick={goSudoku}>스도쿠 하러 가기</button></div>
      </div>

      <button className="journey-btn" onClick={() => setJourney(true)}>
        <IconRoute aria-hidden /><span className="grow"><strong>여정 {q.completed_count}판</strong>
          <small>{next ? `다음: ${next.need}판「${next.title}」` : '모두 마쳤어요'}</small></span><IconChevronRight aria-hidden />
      </button>

      <div className="sub-row"><h2 className="sub">친구 소식</h2><button className="link" onClick={goFriends}>모두 보기</button></div>
      <FeedList limit={3} empty="아직 소식이 없어요. 친구 탭에서 이메일로 친구를 맺어 보세요." />

      {journey && <JourneySheet onClose={() => setJourney(false)} />}
      {gift && <GiftSheet onClose={() => setGift(false)} />}
    </div>
  );
}
