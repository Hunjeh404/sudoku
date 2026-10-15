#!/bin/sh
# 로컬 Postgres에 Supabase 흉내 + 마이그레이션 전체 적용
set -e
DB=${DB:-olympus_test}
export PGPASSWORD=postgres
psql -h localhost -U postgres -q -c "drop database if exists $DB" -c "create database $DB"
psql -h localhost -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do psql -h localhost -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f "$f"; done
echo "db $DB ready"
