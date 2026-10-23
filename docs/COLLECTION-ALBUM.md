# 신화 여행첩 (2026-10-23)

도감 → 여행첩에서 장면 24장과 세트 완성 배경 6종을 모은다. 홈의 여행첩 버튼과 퍼즐 완료 화면에서도 바로 이동한다.

| 세트 | 장면 획득 판수 | 완성 배경 |
| --- | --- | --- |
| 세상의 첫빛 | 5, 10, 15, 20 | 태초의 은하수 |
| 구름 위의 신들 | 25, 30, 40, 50 | 구름 위 신전 |
| 꽃과 노래의 정원 | 60, 70, 85, 100 | 페르세포네의 정원 |
| 영웅의 발자취 | 115, 135, 155, 180 | 페가소스의 쉼터 |
| 황금빛 항해 | 205, 235, 265, 300 | 아르고호의 항구 |
| 별을 따라 집으로 | 340, 390, 440, 500 | 이타카의 달빛 |

## 저장과 호환

- 획득 여부는 기존 `get_state().quest.completed_count`로 계산한다. 기존 이용자도 접속 즉시 지난 보상을 얻으며, 별도 수령이나 소급 지급 SQL이 없다.
- 기존 초상화·보물·칭호, 별빛·점수, 서버 여정 보상 12단계는 그대로다. `DISPLAY_JOURNEY`가 화면에서만 여행첩 목표를 합쳐 500판까지 안내한다.
- 홈 배경 선택은 기존 `update_profile(p, patch)`의 `settings.collectionBackdrop`에 저장한다. 서버 성공 후에만 화면·기기 캐시를 갱신한다. 실패 시 이전 선택을 유지하고 재시도할 수 있다.
- 서버에서 받은 설정을 우선해 다른 기기의 이전 캐시가 홈 배경 선택을 덮어쓰지 않게 한다. 사용자의 누적 판수로 해금되지 않은 ID·알 수 없는 ID는 표시하지 않는다.
- 서버 스키마와 함수는 변경하지 않았다. 실제 운영 DB의 `update_profile(uuid,jsonb)` 정의를 읽어 JSON 설정 저장과 `private.require_act(p)` 권한 검사를 확인했다.
- 그림은 필요할 때 로드한다. 6개 새 배경은 1200×800 WebP이며 합계 약 1.3MB다. 서비스워커 버전 v15.

## 그림 출처와 생성

장면 24장은 기존 `public/assets/scenes/` 이야기책 삽화를 재사용한다. 배경 6종은 built-in image_gen으로 새로 생성하고 WebP로 최적화했다. 창작 배경이며 특정 고대 유적의 고증 재현이 아니다.

공통 생성 프롬프트:

> Use case: illustration-story. Create ONE landscape 3:2 collectible illustrated background for a children's Greek mythology sudoku game. Scene: [아래 장면]. Soft pastel watercolor on cream paper, loose natural brush edges, broad simple shapes, very sparse fine warm gray lines, gentle 1-2 tone shading, tasteful gold accents, dreamy storybook mood. Landscape fills canvas, spacious composition, no people, no text, no letters, no UI, no border or frame, no watermark. Finished beautiful illustration, not a diagram or mockup.

각 장면 / 최종 파일:

- `public/assets/collections/genesis.webp`: a tranquil primordial night sky with a luminous Milky Way, tiny gold stars, pale violet nebula reflected in a still silver sea, a curved ivory marble terrace at bottom
- `public/assets/collections/olympus.webp`: a small ivory ancient Greek temple on a floating island above soft peach and lavender clouds, sunlit marble steps and olive branches, distant Olympus mountain
- `public/assets/collections/garden.webp`: a spring garden of Persephone, an ivory Greek colonnade beside a clear round fountain, pink wildflowers and sage olive trees, a few pomegranate blossoms
- `public/assets/collections/heroes.webp`: a quiet Greek sanctuary on a high coastal cliff, a small white winged horse resting near marble columns, laurel greenery and a golden sunset over mountains
- `public/assets/collections/voyage.webp`: the Argo, a graceful ancient Greek wooden sailing ship with one cream sail, safely anchored in a turquoise cove, rocky islands, gentle morning light
- `public/assets/collections/homecoming.webp`: a peaceful Ithaca island harbor at twilight, a small ivory Greek home with a warm lit doorway and flowering olive tree, purple sea and a gold crescent moon

## 검증

- `npm test`: 기존 20개 + 여행첩 경계값·이전 사용자·위조 설정·파일 존재 검사 5개, 25개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.
- `node --import tsx tests/e2e/collections-check.ts`: 자체 로컬 Vite 서버와 가짜 API를 사용하며 운영 데이터에 쓰지 않는다. 360px/768px에서 잠금, 세트 완성, 저장 실패·재시도, 새로고침 유지, 다른 기기 설정 우선, 70판 소급 적용, 해제, 잘못된 배경 ID, 500판 완성을 검사한다. 퍼즐 입력 → 완료 → 카드·배경 동시 알림 → 여행첩 이동도 검사한다.
- 운영 계정의 실제 로그인/설정 쓰기 테스트는 하지 않았다. 운영 DB는 함수 정의 읽기만 수행했다.
