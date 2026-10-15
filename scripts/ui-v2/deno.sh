#!/bin/sh
# Keep Deno's pinned npm graph separate from the frontend npm workspaces.
command_name="$1"
shift
binary="${FISIOFIT_DENO_BIN:-/private/tmp/deno-2.9.7/deno}"
case "$command_name" in
  check|test) exec "$binary" "$command_name" --no-lock --node-modules-dir=none "$@" ;;
  run) exec "$binary" "$command_name" --no-lock "$@" ;;
  *) exec "$binary" "$command_name" "$@" ;;
esac
