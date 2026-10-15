// 도감·이야기 데이터는 필요할 때 한 번만 불러온다(서비스워커가 재방문 시 캐시)
import { asset } from './store';

export interface Person { id: string; ko: string; en: string; cat: string; dom: string; sym: string[]; ep: string }
export interface Chapter { n: number; t: string; sub: string; open: boolean; b?: ({ k: 'img'; f: string; cap: string; who: string[] } | { k: 'p'; t: string } | { k: 'who'; id: string })[] }

const cache: Record<string, Promise<any>> = {};
function load<T>(name: string): Promise<T> {
  if (!cache[name]) {
    cache[name] = fetch(asset(`data/${name}.json`)).then((r) => {
      if (!r.ok) throw new Error('load');
      return r.json();
    }).catch((e) => { delete cache[name]; throw e; });
  }
  return cache[name];
}
export const loadPeople = () => load<Person[]>('people');
export const loadBook = () => load<Chapter[]>('book');
export const loadStories = () => load<Record<string, { s: [string, string][] }>>('stories');

export const CATEGORY_KO: Record<string, string> = {
  pri: '태초의 신', tit: '티탄', oly: '올림포스 12신', god: '여러 신', nym: '님프', mon: '괴물·생물', mor: '사람', grp: '무리', her: '영웅', art: '보물',
};
