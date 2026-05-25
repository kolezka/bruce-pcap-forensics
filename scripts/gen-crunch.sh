#!/usr/bin/env bash
# Named crunch recipes for WPA-style wordlists.
#
# Usage: ./scripts/gen-crunch.sh <recipe>
# Recipes:
#   digits-8         00000000–99999999            (~900 MB)
#   digits-9         000000000–999999999          (~9 GB)
#   digits-10        0000000000–9999999999        (~100 GB)
#   pl-mobile        9-digit, leading 4–8         (~500 MB)
#   hex-8-upper      00000000–FFFFFFFF            (~32 MB)
#   hex-10-lower     10-char lower hex            (~10 GB)
#   alnum-8          8-char [a-zA-Z0-9]           (~1.8 TB — don't.)
#   funbox-26        26-char upper-hex Funbox PSK (~7e30 — pointless without keygen)
#   ssid-suffix      <ssid>00 .. <ssid>99 + year tails   (needs $2 = ssid)
#   list             list recipes
#
# Output goes to wordlists/generated/<recipe>.txt
# Override with OUT=/path/to/file ./gen-crunch.sh <recipe>

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/wordlists/generated"
mkdir -p "$GEN"

if ! command -v crunch >/dev/null 2>&1; then
  echo "crunch not installed. Install:" >&2
  echo "  macOS:        brew install crunch" >&2
  echo "  Debian/Kali:  sudo apt install crunch" >&2
  exit 1
fi

recipe="${1:-list}"
out="${OUT:-$GEN/$recipe.txt}"

case "$recipe" in
  list)
    sed -n '5,18p' "$0"
    ;;
  digits-8)
    crunch 8 8 0123456789 -o "$out"
    ;;
  digits-9)
    crunch 9 9 0123456789 -o "$out"
    ;;
  digits-10)
    crunch 10 10 0123456789 -o "$out"
    ;;
  pl-mobile)
    crunch 9 9 -t '%@@@@@@@@' -o "$out"
    ;;
  hex-8-upper)
    crunch 8 8 0123456789ABCDEF -o "$out"
    ;;
  hex-10-lower)
    crunch 10 10 0123456789abcdef -o "$out"
    ;;
  alnum-8)
    echo "alnum-8 produces ~1.8 TB. abort." >&2
    exit 2
    ;;
  funbox-26)
    echo "26-char upper-hex Funbox stickers are random; brute-forcing the keyspace is infeasible." >&2
    echo "Use a keygen attack (per-BSSID, exploiting serial-derived keys) instead." >&2
    exit 2
    ;;
  ssid-suffix)
    ssid="${2:-}"
    if [[ -z "$ssid" ]]; then echo "usage: gen-crunch.sh ssid-suffix <ssid>" >&2; exit 2; fi
    out="${OUT:-$GEN/ssid-${ssid}.txt}"
    {
      for n in $(seq 0 99); do printf '%s%02d\n' "$ssid" "$n"; done
      for y in 2018 2019 2020 2021 2022 2023 2024 2025 2026; do
        printf '%s%d\n' "$ssid" "$y"
        printf '%s_%d\n' "$ssid" "$y"
      done
      printf '%s123\n%s1234\n%s12345\n%s123456\n%s1234567\n%s12345678\n' \
        "$ssid" "$ssid" "$ssid" "$ssid" "$ssid" "$ssid"
      printf '%s!\n%s@\n%s#\n%s.\n%s_\n' "$ssid" "$ssid" "$ssid" "$ssid" "$ssid"
    } > "$out"
    ;;
  *)
    echo "unknown recipe: $recipe" >&2
    sed -n '5,18p' "$0" >&2
    exit 2
    ;;
esac

if [[ -f "$out" ]]; then
  echo "wrote $out  ($(wc -l < "$out") lines, $(du -h "$out" | cut -f1))"
fi
