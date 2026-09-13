#!/bin/sh
set -eu

PYTHON_BIN="${DSG_AUTOMATION_PYTHON:-/opt/dsg-automation/bin/python}"
ENGINE="${DSG_AUTOMATION_ENGINE:-/app/automation_spacetime/engine.py}"

if [ ! -x "$PYTHON_BIN" ] || [ ! -r "$ENGINE" ]; then
  echo "BLOCK: Automation Spacetime engine is not installed" >&2
  exit 31
fi

PROBE="$(printf '%s' '{"operation":"probe"}' | "$PYTHON_BIN" "$ENGINE")" || {
  echo "BLOCK: Microsoft Agent Framework probe failed" >&2
  exit 32
}
case "$PROBE" in
  *'"ok":true'*'"version":"1.18.0"'*) ;;
  *)
    echo "BLOCK: Automation Spacetime version contract failed" >&2
    printf '%s\n' "$PROBE" >&2
    exit 33
    ;;
esac

exec node server.js
