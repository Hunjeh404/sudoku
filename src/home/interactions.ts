// interaction-spec.json(가구 20종) + 보물 10종의 반응 정의
import { sfx } from '../lib/sound';
import type { EffectKind } from './effects';

export type PanelKind = 'exhibit' | 'friends' | 'music' | 'guestbook' | 'gallery' | 'stories' | 'collection' | 'lyre' | 'thread' | 'mirror';

export interface Reaction {
  effect?: EffectKind;
  ms: number;
  cooldown: number;
  anchor?: [number, number];
  amount?: number;
  sound?: () => void;
  panel?: PanelKind;
  toggle?: boolean; // 켜짐/꺼짐(방문자는 기기에서만)
  extra?: EffectKind; // 눌림과 함께 나오는 반짝임
}

export const REACTIONS: Record<string, Reaction> = {
  bed_bounce: { effect: 'squash', amount: 0.97, ms: 420, cooldown: 500, sound: sfx.soft, extra: 'sparkle' },
  cushion_squish: { effect: 'squash', amount: 0.92, ms: 360, cooldown: 500, sound: sfx.soft },
  exhibit_panel: { panel: 'exhibit', ms: 0, cooldown: 500, sound: sfx.tap },
  flower_glimmer: { effect: 'butterfly', ms: 1000, cooldown: 1000, sound: sfx.chime },
  bench_bounce: { effect: 'stars', ms: 450, cooldown: 500, sound: sfx.soft },
  door_chime: { panel: 'friends', effect: 'sparkle', ms: 350, cooldown: 500, sound: sfx.door },
  soft_sparkle: { effect: 'ring', ms: 900, cooldown: 900, sound: sfx.chime },
  curtain_glimmer: { effect: 'sunbeam', ms: 900, cooldown: 900 },
  music_select: { panel: 'music', ms: 0, cooldown: 500, sound: sfx.tap },
  leaf_rustle: { effect: 'leaves', ms: 700, cooldown: 700, sound: sfx.rustle },
  mail_panel: { panel: 'guestbook', ms: 0, cooldown: 500, sound: sfx.tap },
  gallery: { panel: 'gallery', ms: 0, cooldown: 500, sound: sfx.tap },
  stool_bounce: { effect: 'hop', ms: 350, cooldown: 500, sound: sfx.pop },
  open_story: { panel: 'stories', ms: 0, cooldown: 500, sound: sfx.tap },
  water_ripple: { effect: 'ripple', ms: 1100, cooldown: 1100, anchor: [0.5, 0.6], sound: sfx.water },
  light_toggle: { toggle: true, effect: 'sparkle', ms: 250, cooldown: 500, anchor: [0.5, 0.55], sound: sfx.tap },
  mobile_chime: { effect: 'chime', ms: 800, cooldown: 800, sound: sfx.chime },
  path_steps: { effect: 'steps', ms: 750, cooldown: 750, sound: sfx.pop },
  steam: { effect: 'steam', ms: 1100, cooldown: 1100, anchor: [0.33, 0.36] },
  treasure_panel: { panel: 'collection', ms: 0, cooldown: 500, sound: sfx.tap },
  // 보물 10종: 고유 반응 10, 작은 놀이 2(리라·실타래) + 책장 이야기 넘기기 1
  lyre_play: { panel: 'lyre', ms: 0, cooldown: 300 },
  lamp_glow: { toggle: true, effect: 'sparkle', ms: 600, cooldown: 500, sound: sfx.chime },
  harvest_burst: { effect: 'fruit', ms: 900, cooldown: 900, sound: sfx.pop },
  olive_glint: { effect: 'sparkle', ms: 900, cooldown: 900, sound: sfx.rustle },
  wind_gust: { effect: 'wind', ms: 900, cooldown: 900, sound: sfx.rustle },
  golden_shimmer: { effect: 'gold', ms: 1000, cooldown: 1000, sound: sfx.chime },
  mirror_pick: { panel: 'mirror', ms: 0, cooldown: 500, sound: sfx.tap },
  thread_stars: { panel: 'thread', ms: 0, cooldown: 500, sound: sfx.tap },
  crown_constellation: { effect: 'crown', ms: 1200, cooldown: 1200, sound: sfx.chime },
  hope_light: { effect: 'hope', ms: 1400, cooldown: 1400, sound: sfx.chime },
};
