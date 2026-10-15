// 기기 임시 저장. 실패해도 게임은 그대로 돌아가야 하므로 모든 접근을 try/catch로 감싼다.
export function getLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function setLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 공간 없음 */ }
}
export function delLocal(key: string) {
  try { localStorage.removeItem(key); } catch { /* 무시 */ }
}
