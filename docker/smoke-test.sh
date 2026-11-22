#!/usr/bin/env bash
# Smoke test of a built image through docker-compose.yml (#18), one profile at a time:
# the container turns healthy, GET /healthz answers 200, the SMTP port greets with 220,
# and the bundled CLI runs inside the image.
#   docker build -f docker/Dockerfile -t mailsink:local .
#   docker/smoke-test.sh pglite postgres
# Env: MAILSINK_IMAGE (default mailsink:local), MAILSINK_HTTP_PORT (3000),
# MAILSINK_SMTP_HOST_PORT (1025), SMOKE_PROJECT (compose project, default mailsink-smoke).
set -euo pipefail

cd "$(dirname "$0")"
export MAILSINK_IMAGE="${MAILSINK_IMAGE:-mailsink:local}"
export MAILSINK_HTTP_PORT="${MAILSINK_HTTP_PORT:-3000}"
export MAILSINK_SMTP_HOST_PORT="${MAILSINK_SMTP_HOST_PORT:-1025}"
project="${SMOKE_PROJECT:-mailsink-smoke}"

compose() { docker compose -p "$project" -f docker-compose.yml --profile "$profile" "$@"; }

wait_healthy() {
  local container status
  container="$(compose ps -q "$1")"
  # Covers the image's healthcheck start period (first PGlite boot, Postgres startup).
  for _ in $(seq 1 90); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container")"
    [ "$status" = healthy ] && return 0
    sleep 1
  done
  echo "service $1 is $status after 90 s" >&2
  return 1
}

check() {
  local service=$1 greeting
  shift
  wait_healthy "$service"
  curl -fsS "http://127.0.0.1:${MAILSINK_HTTP_PORT}/healthz"
  echo
  greeting="$(timeout 5 bash -c "exec 3<>/dev/tcp/127.0.0.1/${MAILSINK_SMTP_HOST_PORT}; head -1 <&3")"
  echo "smtp: ${greeting}"
  [[ "$greeting" == 220* ]]
  compose exec -T "$service" mailsink migrate "$@"
}

for profile in "$@"; do
  echo "== profile ${profile}"
  trap 'compose logs --no-color || true; compose down -v || true' EXIT
  compose up -d --no-build
  case "$profile" in
    # Never a second PGlite on the served folder: the CLI proves its deps load in memory.
    pglite) check mailsink --database-url pglite://memory ;;
    postgres) check mailsink-postgres ;;
    *) echo "unknown profile ${profile}" >&2; exit 2 ;;
  esac
  compose down -v
  trap - EXIT
done
echo "smoke test passed"
