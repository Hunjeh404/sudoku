// 이야기책: 1장은 처음부터, 이후 스도쿠 5판마다 한 장씩 열린다. 그림과 함께 한 쪽씩 읽는다
import { useEffect, useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { asset, useGame } from '../lib/store';
import { chapterOpen, STORY_EVERY } from '../data/catalog';
import { loadBook, Chapter } from '../lib/content';
import { sfx } from '../lib/sound';
import { Sheet, ErrorLine, Spinner } from '../ui';

export function StoriesPanel({ onClose, startChapter }: { onClose: () => void; startChapter?: number }) {
  const { state } = useGame();
  const done = state!.quest.completed_count;
  const [book, setBook] = useState<Chapter[] | null>(null);
  const [err, setErr] = useState(false);
  const [ch, setCh] = useState<number | null>(startChapter ?? null);
  const [page, setPage] = useState(0);
  useEffect(() => { loadBook().then(setBook).catch(() => setErr(true)); }, []);
  const open = (book ?? []).filter((c) => c.open && chapterOpen(c.n, done));
  const chapter = open.find((c) => c.n === ch);
  // 쪽 나누기: 그림 하나 + 이어지는 글
  const pages = useMemo(() => {
    if (!chapter?.b) return [];
    const out: { img?: any; text: string[] }[] = [];
    for (const b of chapter.b) {
      if (b.k === 'img') out.push({ img: b, text: [] });
      else if (b.k === 'p') { if (!out.length) out.push({ text: [] }); out[out.length - 1].text.push(b.t); }
    }
    return out;
  }, [chapter]);
  return (
    <Sheet title={chapter ? chapter.t : '이야기책'} onClose={onClose} wide>
      {err && <ErrorLine msg="이야기를 불러오지 못했어요." />}
      {!book && !err && <Spinner />}
      {book && !chapter && (
        <ul className="chapter-list">
          {book.map((c) => {
            const unlocked = c.open && chapterOpen(c.n, done);
            return <li key={c.n}>
              <button className="chapter" disabled={!unlocked} onClick={() => { setCh(c.n); setPage(0); }}>
                <span className="ch-n">{c.n}장</span><span className="grow">{c.t}</span>
                <small>{unlocked ? '읽기' : `${(c.n - 1) * STORY_EVERY}판에서 열려요`}</small>
              </button></li>;
          })}
        </ul>
      )}
      {chapter && pages[page] && (
        <article className="story-page">
          {pages[page].img && <figure><img src={asset(pages[page].img.f)} alt={pages[page].img.cap} /></figure>}
          {pages[page].text.map((t, i) => <p key={i}>{t}</p>)}
          <nav className="pager">
            <button className="icon-btn" aria-label="이전 쪽" disabled={page === 0} onClick={() => { setPage(page - 1); sfx.tap(); }}><IconChevronLeft /></button>
            <span>{page + 1} / {pages.length}</span>
            {page < pages.length - 1
              ? <button className="icon-btn" aria-label="다음 쪽" onClick={() => { setPage(page + 1); sfx.tap(); }}><IconChevronRight /></button>
              : <button className="btn small" onClick={() => setCh(null)}>목록으로</button>}
          </nav>
        </article>
      )}
    </Sheet>
  );
}
