# 올림포스의 작은 정원

스도쿠로 별빛을 모아 쿼터뷰 집과 구름 정원을 꾸미고, 가족·친구의 집에 놀러 가 방명록을 남기는 그리스신화 온라인 게임.
기획 명세는 `assets-src/quarterview-v1/PROJECT_SPEC.md`(v1.1), 작업 지시는 `assets-src/quarterview-v1/CLAUDE_TASK.md`.

- 화면: React 19 + Vite 7 + TypeScript, GitHub Pages(https://hunjeh404.github.io/sudoku/)
- 서버: Supabase(구글 로그인 + Postgres + RLS + 검증 함수). Edge Function 없음, SQL만 실행하면 된다.
- 원본 자원: https://github.com/Hunjeh404/greek-myth-map 커밋 `286dfbce4bef3a9d4ca09ae6b61956043d792451` 스냅샷에서 복사(`asset-sources.json`). 원본 사이트는 수정하지 않았다.

## 처음 한 번 설정

### 1. Supabase에 데이터베이스 만들기
1. Supabase 대시보드 → SQL Editor → New query
2. `supabase/setup-all.sql` 전체를 붙여 넣고 Run. (마이그레이션 0001~0006을 순서대로 합친 파일)
   이미 0001~0005를 실행한 프로젝트는 `supabase/migrations/0006_stacking.sql`만 추가로 실행한다.
3. 같은 SQL을 다시 실행하면 `already exists` 오류가 난다. 처음부터 다시 하려면 새 프로젝트를 쓰는 편이 안전하다.

### 2. 구글 로그인 연결
1. Google Cloud Console → API 및 서비스 → OAuth 동의 화면: 외부, 앱 이름·지원 이메일 입력, 테스트 사용자에 가족 구글 계정 추가(또는 앱 게시).
2. 사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션
   - 승인된 JavaScript 원본: `https://hunjeh404.github.io`
   - 승인된 리디렉션 URI: `https://rxzqlopkrlftbkzxrqmd.supabase.co/auth/v1/callback`
3. 받은 클라이언트 ID·보안 비밀을 Supabase → Authentication → Sign In / Providers → Google에 넣고 켠다.
4. Supabase → Authentication → URL Configuration
   - Site URL: `https://hunjeh404.github.io/sudoku/`
   - Redirect URLs: `https://hunjeh404.github.io/sudoku/`

### 3. GitHub Pages 켜기
저장소 Settings → Pages → Build and deployment → Source: **GitHub Actions**. 이후 main에 올릴 때마다 `.github/workflows/pages.yml`이 테스트·빌드·배포한다.

공개 키는 `.env.production`에 들어 있다(브라우저에 노출돼도 되는 publishable 키). service_role/secret 키는 어디에도 넣지 않는다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/sudoku/` | 규칙·유일해(engine), 논리 기법 풀이(logic), 4단계 힌트(hints), 문제 생성(generate) |
| `src/home/` | 쿼터뷰 투영·배치 규칙(geometry), 공간 렌더러·투명도 터치 판정(SpaceView), 반응 효과(effects, interactions) |
| `src/screens/` | 시작·프로필, 집, 꾸미기, 스도쿠, 친구·방문, 도감, 설정·우편함, 여정 |
| `src/panels/` | 가구를 누르면 열리는 창(받침대·악보대·방명록·액자·책장·보물 상자·리라·실타래·거울 방패) |
| `src/data/catalog.ts` | 아이템 30종·여정 12단계·보상·안내 친구(서버 카탈로그 SQL의 원본) |
| `src/data/calibration.json` | 바닥 꼭짓점·가구 크기·받침 위치 보정값 |
| `supabase/migrations/` | 0001 스키마·RLS, 0002 서버 함수, 0003 카탈로그, 0005 문제 은행(252문제), 0006 쌓기 규칙 |
| `assets-src/quarterview-v1/` | 받은 쿼터뷰 팩 원본(PNG·매니페스트·명세) + `asset-manifest.calibrated.json` |
| `public/assets/` | 게임용 WebP 파생본(배경 1024px, 가구 512px, 인물 224px, 장면 900px)과 96kbps 음악 |
| `public/sw.js` | 그림·데이터를 기기에 저장하는 서비스워커(재방문 시 전송량 감소) |
| `tests/` | 엔진 단위 테스트, DB 권한 테스트, 로컬 E2E |

## 다시 만들기
- 문제 은행: `npm run gen:puzzles` (약 5분, 고정 시드)
- 카탈로그 SQL: `npm run gen:catalog`
- 그림 파생본·데이터: `python3 -I scripts/import-assets.py <greek-myth-map 경로> <쿼터뷰 팩 경로>`
- 터치 마스크: `python3 -I scripts/gen-alpha-masks.py`
- 보정 매니페스트: `npx tsx scripts/gen-calibrated-manifest.ts`
- 그림을 바꾸면 `public/sw.js`의 `VERSION`을 올린다(같은 파일명 캐시 갱신).

## 테스트
- `npm test`: 스도쿠 엔진·힌트 11개
- `tests/db/reset.sh && npm run test:db`: 로컬 Postgres에 Supabase 역할·auth 흉내(`tests/db/supabase-stub.sql`) + 마이그레이션 적용 후 권한·거래 24개
- 로컬 E2E: `DB=olympus_e2e tests/db/reset.sh`, `sh tests/e2e/gw.sh`(로그인·RPC 흉내 게이트웨이), `tests/e2e/rebuild.sh`, `npx vite preview --outDir dist-local --port 4173`, `npx tsx tests/e2e/flow.ts`

결과와 미완료 항목은 `docs/TEST-RESULTS.md`.
