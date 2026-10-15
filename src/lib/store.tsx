import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { rpc, ApiError } from './api';
import { getLocal, setLocal } from './local';
import { configureSound } from './sound';

export interface Settings { sound: boolean; fx: number; music: number; reducedMotion: boolean; autoNotes: boolean; showTimer: boolean; pictureMode: boolean }
export const DEFAULT_SETTINGS: Settings = { sound: false, fx: 0.6, music: 0.4, reducedMotion: false, autoNotes: true, showTimer: false, pictureMode: false };

export interface GameState {
  profile: { id: string; nickname: string; avatar_id: string; title: string; is_child: boolean; settings: Partial<Settings> };
  balance: number;
  quest: { completed_count: number; no_hint_count: number };
  unlocks: string[];
  owned: string[];
  gifts: { id: string; tier: number; options: string[] }[];
  points: { total: number; week: number };
  records: Record<string, number>;
  active: { id: string; puzzle_id: string; size: number; difficulty: string; updated_at: string }[];
  unread: number;
  family_role: 'guardian' | 'adult' | 'child';
}
export interface ProfileSummary { id: string; nickname: string; avatar_id: string; is_child: boolean; mine: boolean }

interface Ctx {
  session: Session | null;
  authReady: boolean;
  profiles: ProfileSummary[] | null;
  profileId: string | null;
  state: GameState | null;
  settings: Settings;
  error: string | null;
  selectProfile: (id: string | null) => void;
  reloadProfiles: () => Promise<ProfileSummary[]>;
  refresh: () => Promise<GameState | null>;
  patchState: (f: (s: GameState) => GameState) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  signOut: () => Promise<void>;
}

const C = createContext<Ctx>(null as any);
export const useGame = () => useContext(C);

export function GameProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const uid = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const reloadProfiles = useCallback(async () => {
    const list = await rpc<ProfileSummary[]>('my_profiles');
    setProfiles(list);
    return list;
  }, []);

  // 로그인 사용자가 바뀌면 프로필 목록·선택을 새로(이전 프로필 대기 요청은 키가 달라 섞이지 않음)
  useEffect(() => {
    setProfiles(null); setState(null); setProfileId(null);
    if (!uid) return;
    reloadProfiles().then((list) => {
      const saved = getLocal<string | null>(`sel:${uid}`, null);
      const pick = list.find((p) => p.id === saved) ?? (list.length === 1 ? list[0] : null);
      setProfileId(pick?.id ?? null);
    }).catch((e: ApiError) => setError(e.message));
  }, [uid, reloadProfiles]);

  const refresh = useCallback(async () => {
    if (!profileId) return null;
    try {
      const s = await rpc<GameState>('get_state', { p: profileId });
      setState(s);
      setError(null);
      return s;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [profileId]);

  useEffect(() => { setState(null); if (profileId) refresh(); }, [profileId, refresh]);

  const settings = useMemo<Settings>(() => {
    const local = getLocal<Partial<Settings>>(`settings:${profileId}`, {});
    const sys = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { ...DEFAULT_SETTINGS, reducedMotion: sys, ...(state?.profile.settings ?? {}), ...local };
  }, [state, profileId]);

  useEffect(() => {
    configureSound({ enabled: settings.sound, fx: settings.fx, music: settings.music });
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduce' : 'full';
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    if (!state || !profileId) return;
    const next = { ...settings, ...patch };
    setLocal(`settings:${profileId}`, next);
    setState({ ...state, profile: { ...state.profile, settings: next } });
    rpc('update_profile', { p: profileId, patch: { settings: next } }).catch(() => {});
  }, [state, profileId, settings]);

  const selectProfile = useCallback((id: string | null) => {
    if (uid) setLocal(`sel:${uid}`, id);
    setProfileId(id);
  }, [uid]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const patchState = useCallback((f: (s: GameState) => GameState) => setState((s) => (s ? f(s) : s)), []);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); setSession(null); }, []);

  return (
    <C.Provider value={{ session, authReady, profiles, profileId, state, settings, error, selectProfile, reloadProfiles, refresh, patchState, updateSettings, toast, toastMsg, signOut }}>
      {children}
    </C.Provider>
  );
}

export const assetBase = import.meta.env.BASE_URL;
export const asset = (p: string) => `${assetBase}${p}`;
export const portrait = (id: string) => asset(`assets/portraits/${id}.webp`);
export const tierOpen = (s: GameState, tier: number) => tier === 1 || s.unlocks.includes(`tier:${tier}`);
