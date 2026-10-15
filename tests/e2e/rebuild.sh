#!/bin/sh
# 로컬 테스트용 빌드(게이트웨이 주소 + 보정 화면 허용)
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_KEY=local VITE_CALIB=1 npx vite build --outDir dist-local >/dev/null 2>&1 && echo built
