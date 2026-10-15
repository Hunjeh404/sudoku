#!/bin/sh
# 로컬 Postgres에 Supabase 흉내 + 마이그레이션 적용(UNTIL=0007_z 처럼 주면 그 이름까지만)
set -e
DB=${DB:-olympus_test}
export PGPASSWORD=postgres
psql -h localhost -U postgres -q -c "drop database if exists $DB" -c "create database $DB"
psql -h localhost -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do [ -n "$UNTIL" ] && [ "$(basename $f)" \> "$UNTIL" ] && break; psql -h localhost -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f "$f"; done
echo "db $DB ready"
