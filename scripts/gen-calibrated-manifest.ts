// 보정된 매니페스트: npx tsx scripts/gen-calibrated-manifest.ts
// 원본 asset-manifest.json은 그대로 두고, 게임에서 실제로 쓰는 바닥 꼭짓점·발자국·크기·받침 위치를 덧붙인 사본을 만든다.
import { readFileSync, writeFileSync } from 'node:fs';
import { ITEM_BY_ID } from '../src/data/catalog';
const src = JSON.parse(readFileSync('assets-src/quarterview-v1/asset-manifest.json', 'utf8'));
const cal = JSON.parse(readFileSync('src/data/calibration.json', 'utf8'));
const out = structuredClone(src);
out.calibration = {
  date: '2026-10-15', method: '게임 렌더러에서 390·520px 화면 캡처로 눈 검수(논리 격자·발자국 겹쳐 보기, tests/e2e/calib-shot.ts)',
  note: '방향이 다르던 발자국 2건 수정: cloud_bed [2,3]→[3,2], laurel_bench [3,1]→[1,3] (긴 축이 그림과 맞도록). 표시 크기는 suggestedVisibleWidthFractionOfFloor × scale.',
};
for (const a of out.assets) {
  if (a.kind === 'environment') {
    a.placement.calibratedFloorCornersPx = cal.environments[a.id].floorCornersPx;
    a.placement.calibrationStatus = 'calibrated-in-engine';
    continue;
  }
  const it = ITEM_BY_ID[a.id];
  const c = cal.items[a.id] ?? {};
  a.placement.gameFootprintTiles = [it.fw, it.fh];
  a.placement.gameSurface = it.surface;
  a.placement.gameSpaces = it.spaces;
  a.placement.displayScale = c.scale ?? 1;
  if (c.slot) a.placement.supportSlotOffsetSpritePx = c.slot;
  a.placement.calibrationStatus = 'calibrated-in-engine';
  a.gameItemId = a.id;
}
writeFileSync('assets-src/quarterview-v1/asset-manifest.calibrated.json', JSON.stringify(out, null, 1));
console.log('written');
