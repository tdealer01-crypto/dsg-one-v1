#!/usr/bin/env bash
set -euo pipefail
# This test never connects to a hosted database or reads provider credentials.
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGDATABASE:-}" != "jobs_replay_test" ]]; then
  echo 'ISOLATED_JOBS_REPLAY_TEST_DATABASE_REQUIRED' >&2
  exit 2
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql -X -v ON_ERROR_STOP=1 -c 'create role anon; create role authenticated; create role service_role;'
psql -X -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/202610130001_jobs_delegation_replay_guard.sql"
psql -X -v ON_ERROR_STOP=1 -f "$root/tests/dsg/sql/jobs-delegation-replay.sql"

outputs="$(mktemp -d)"
trap 'rm -rf "$outputs"' EXIT
# First transaction holds the unique key while the competing session attempts
# the same receipt. Exactly one RPC must succeed, across independent sessions.
psql -X -qAt -v ON_ERROR_STOP=1 -c "begin; set local role service_role; select public.consume_dsg_jobs_delegation(repeat('d',64),floor(extract(epoch from clock_timestamp()))::bigint+25); select pg_sleep(1); commit;" >"$outputs/first" &
first=$!
psql -X -qAt -v ON_ERROR_STOP=1 -c "set role service_role; select public.consume_dsg_jobs_delegation(repeat('d',64),floor(extract(epoch from clock_timestamp()))::bigint+25);" >"$outputs/second" &
second=$!
wait "$first"
wait "$second"
actual="$(cat "$outputs/first" "$outputs/second" | sed '/^$/d' | sort)"
[[ "$actual" == $'f\nt' ]] || { echo 'CONCURRENT_REPLAY_ARBITRATION_FAILED' >&2; exit 1; }
echo 'JOBS_REPLAY_DATABASE_TESTS_PASS'
