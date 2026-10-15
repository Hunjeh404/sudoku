// 받침에 맞춰 조사 붙이기: josa('의자', '을/를') → '의자를'
const DIGIT_BATCHIM: Record<string, boolean> = { '0': true, '1': true, '2': false, '3': true, '4': false, '5': false, '6': true, '7': true, '8': true, '9': false };
export function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  if (ch in DIGIT_BATCHIM) return DIGIT_BATCHIM[ch];
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}
export function josa(word: string, pair: '을/를' | '이/가' | '은/는' | '과/와' | '으로/로'): string {
  const [a, b] = pair.split('/');
  if (pair === '으로/로') {
    const ch = word.trim().slice(-1);
    const code = ch.charCodeAt(0) - 0xac00;
    const rieul = code >= 0 && code % 28 === 8;
    return word + (hasBatchim(word) && !rieul ? a : b);
  }
  return word + (hasBatchim(word) ? a : b);
}
