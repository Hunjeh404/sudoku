# 올림포스의 작은 정원

스도쿠로 별빛을 모아 그리스신화 인물 초상화(4티어 390장)를 모으고, 전체 순위표에서 겨루고, 친구·가족의 소식에 이모티콘을 다는 온라인 게임.
처음 기획(쿼터뷰 집 꾸미기, `assets-src/quarterview-v1/PROJECT_SPEC.md`)에서 2026-10-15에 집 꾸미기·방문·방명록을 빼고 지금 구조로 바꿨다.

- 화면: React 19 + Vite 7 + TypeScript, GitHub Pages(https://hunjeh404.github.io/sudoku/)
- 서버: Supabase(구글 로그인 + Postgres + RLS + 검증 함수). Edge Function 없음, SQL만 실행하면 된다.
- 원본 자원: https://github.com/Hunjeh404/greek-myth-map 커밋 `286dfbce4bef3a9d4ca09ae6b61956043d792451` 스냅샷에서 복사(`asset-sources.json`). 원본 사이트는 수정하지 않았다.

## 처음 한 번 설정

### 1. Supabase에 데이터베이스 만들기
1. Supabase 대시보드 → SQL Editor → New query
2. `supabase/setup-all.sql` 전체를 붙여 넣고 Run. (마이그레이션 0001~0009를 순서대로 합친 파일)
   이미 0007까지 실행한 프로젝트는 `0008_portraits_scores_social.sql`, `0009_portrait_data.sql`을 차례로 실행한다(기존 사용자 얼굴 그림·지난 판 점수는 옮겨진다).
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
| `src/screens/` | 시작·프로필, 홈, 스도쿠·결과, 순위, 친구(소식·이모티콘·이메일 요청), 도감(초상화 상점·이야기책), 설정·우편함, 여정·선물 |
| `src/data/catalog.ts` | 초상화 티어·가격, 여정 12단계, 칭호, 보상, 순위표 종류, 이모티콘(서버 데이터 SQL의 원본) |
| `supabase/migrations/` | 0001 스키마·RLS, 0002 서버 함수, 0005 문제 은행(252문제), 0007 힌트 감점, 0008 초상화·점수·순위·친구·소식, 0009 초상화 목록·여정·기존 사용자 옮기기 (0003·0006은 예전 집 꾸미기용) |
| `public/assets/` | 게임용 WebP(인물 224px, 장면 900px, 스도쿠 장식)와 96kbps 음악 |
| `public/sw.js` | 그림·데이터를 기기에 저장하는 서비스워커(재방문 시 전송량 감소) |
| `tests/` | 엔진 단위 테스트, DB 권한·거래 테스트, 기존 DB 옮기기 테스트, 로컬 E2E |

## 다시 만들기
- 문제 은행: `npm run gen:puzzles` (약 5분, 고정 시드)
- 초상화·여정·칭호 SQL: `npm run gen:portraits` (→ `0009_portrait_data.sql`)
- 그림 파생본·데이터: `python3 -I scripts/import-assets.py <greek-myth-map 경로>`, 스도쿠 장식: `python3 -I scripts/import-sudoku-ui.py`
- 그림을 바꾸면 `public/sw.js`의 `VERSION`을 올린다(같은 파일명 캐시 갱신).

## 테스트
- `npm test`: 스도쿠 엔진·힌트 11개
- `tests/db/reset.sh && npm run test:db`: 로컬 Postgres에 Supabase 역할·auth 흉내(`tests/db/supabase-stub.sql`) + 마이그레이션 적용 후 권한·거래 23개
- 로컬 E2E: `DB=olympus_e2e tests/db/reset.sh`, `sh tests/e2e/gw.sh`(로그인·RPC 흉내 게이트웨이), `tests/e2e/rebuild.sh`, `npx vite preview --outDir dist-local --port 4173`, `npx tsx tests/e2e/flow.ts`

- 기존 DB 옮기기: `DB=olympus_legacy UNTIL=0007_z sh tests/db/reset.sh && DB=olympus_legacy npx tsx tests/db/legacy-check.ts`

결과와 미완료 항목은 `docs/TEST-RESULTS.md`.
