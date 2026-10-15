// 서버 함수 호출. 오류는 {code, message, retry}로 정리해 화면에 그대로 보여 줄 수 있게 한다.
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(public code: string, message: string, public retry: boolean, public extra?: string) { super(message); }
}

const FALLBACK: Record<string, string> = {
  network: '연결이 끊겼어요. 잠시 뒤에 다시 시도해 주세요.',
  not_signed_in: '다시 로그인해 주세요.',
};

export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch {
    throw new ApiError('network', FALLBACK.network, true);
  }
  const { data, error } = res;
  if (error) {
    const hint = (error as any).hint as string | undefined;
    const code = error.message || 'error';
    if (!(error as any).code && /fetch|network/i.test(code)) throw new ApiError('network', FALLBACK.network, true);
    const msg = (error as any).details || FALLBACK[code] || '잠시 문제가 생겼어요. 다시 시도해 주세요.';
    throw new ApiError(code, msg, hint === 'retry' || code === 'network', hint);
  }
  return data as T;
}

export const newOpId = () =>
  (crypto as any).randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
