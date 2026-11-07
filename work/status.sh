#!/bin/sh
# Print the task board by reading the Status line out of every task file.
# The task files are the single source of truth; this script only summarises.
#
#   sh work/status.sh            all tasks
#   sh work/status.sh blocked    only tasks matching a status (case-insensitive)

set -eu

root=$(dirname "$0")/requirements
want=$(printf '%s' "${1-}" | tr '[:upper:]' '[:lower:]')

total=0; done_n=0; prog=0; block=0; todo=0

for epic in "$root"/EPIC-*/; do
  [ -d "$epic" ] || continue
  printed=0
  for f in "$epic"[TB]-*.md; do
    [ -f "$f" ] || continue

    # "| Status | Not started |" -> "Not started"
    status=$(sed -n 's/^| *Status *| *\(.*[^ ]\) *|.*/\1/p' "$f" | head -1)
    [ -n "$status" ] || status='(none)'
    title=$(sed -n 's/^# *//p' "$f" | head -1)

    total=$((total + 1))
    case $(printf '%s' "$status" | tr '[:upper:]' '[:lower:]') in
      done)        done_n=$((done_n + 1)); mark='x' ;;
      'in progress') prog=$((prog + 1));   mark='~' ;;
      blocked)     block=$((block + 1));   mark='!' ;;
      *)           todo=$((todo + 1));     mark=' ' ;;
    esac

    if [ -n "$want" ]; then
      printf '%s' "$status" | tr '[:upper:]' '[:lower:]' | grep -q "$want" || continue
    fi

    if [ "$printed" -eq 0 ]; then
      printf '\n%s\n' "$(basename "$epic")"
      printed=1
    fi
    printf '  [%s] %s\n' "$mark" "$title"
  done
done

printf '\n%d tasks: %d done, %d in progress, %d blocked, %d not started\n' \
  "$total" "$done_n" "$prog" "$block" "$todo"
