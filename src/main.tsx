import { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameProvider } from './lib/store';
import { App } from './App';
import './styles.css';

class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    if (this.state.err) return (
      <main className="page"><p className="error-line" role="alert">화면을 그리다 문제가 생겼어요. 진행 상황은 저장돼 있어요.</p>
        <button className="btn primary" onClick={() => location.reload()}>다시 열기</button></main>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Boundary><GameProvider><App /></GameProvider></Boundary></StrictMode>,
);

// 재방문 캐시: 그림·음악·데이터·빌드 파일을 기기에 보관
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
