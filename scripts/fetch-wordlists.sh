#!/usr/bin/env bash
# Fetch and generate wordlists for WPA cracking.
#
# Layout (all under wordlists/, which is gitignored):
#   seclists-wifi/        — curated SecLists WPA + common-credentials subset
#   crackstation/         — crackstation-human-only.txt (~684 MB extracted)
#   generated/            — crunch-generated default patterns
#   polish-isp-defaults.txt
#
# Idempotent: existing files are skipped unless --force.
# Flags:
#   --force                 redownload / regenerate everything
#   --skip-crackstation     skip the big CrackStation download
#   --skip-seclists         skip SecLists subset
#   --skip-crunch           skip crunch-generated lists
#   --skip-polish           skip Polish ISP defaults
#   --crunch-big            also generate 8-digit (~900 MB) list

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WL="$ROOT/wordlists"

FORCE=0
SKIP_CS=0
SKIP_SL=0
SKIP_CR=0
SKIP_PL=0
CRUNCH_BIG=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --skip-crackstation) SKIP_CS=1 ;;
    --skip-seclists) SKIP_SL=1 ;;
    --skip-crunch) SKIP_CR=1 ;;
    --skip-polish) SKIP_PL=1 ;;
    --crunch-big) CRUNCH_BIG=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

mkdir -p "$WL/seclists-wifi" "$WL/crackstation" "$WL/generated"

log() { printf '\033[1;34m[wordlists]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[wordlists]\033[0m %s\n' "$*" >&2; }

skip_if_exists() {
  local path="$1"
  if [[ $FORCE -eq 0 && -s "$path" ]]; then
    log "exists, skip: ${path#$WL/}"
    return 0
  fi
  return 1
}

# ---------- SecLists subset ----------
fetch_seclists() {
  local base='https://raw.githubusercontent.com/danielmiessler/SecLists/master'
  # name | path-in-repo
  local files=(
    "probable-v2-wpa-top62.txt|Passwords/WiFi-WPA/probable-v2-wpa-top62.txt"
    "probable-v2-wpa-top4800.txt|Passwords/WiFi-WPA/probable-v2-wpa-top4800.txt"
    "darkweb2017-top10000.txt|Passwords/darkweb2017-top10000.txt"
    "10-million-top-10000.txt|Passwords/Common-Credentials/10-million-password-list-top-10000.txt"
    "10-million-top-100000.txt|Passwords/Common-Credentials/10-million-password-list-top-100000.txt"
    "rockyou-75.txt|Passwords/Leaked-Databases/rockyou-75.txt"
  )
  for entry in "${files[@]}"; do
    local name="${entry%%|*}"
    local rel="${entry#*|}"
    local dst="$WL/seclists-wifi/$name"
    skip_if_exists "$dst" && continue
    log "fetch SecLists: $name"
    curl -fsSL --retry 3 --retry-delay 2 -o "$dst.tmp" "$base/$rel" \
      && mv "$dst.tmp" "$dst" \
      || { warn "failed: $name"; rm -f "$dst.tmp"; }
  done
}

# ---------- CrackStation human-only ----------
fetch_crackstation() {
  local gz="$WL/crackstation/crackstation-human-only.txt.gz"
  local out="$WL/crackstation/crackstation-human-only.txt"
  if skip_if_exists "$out"; then return; fi
  log "fetch CrackStation human-only (~247 MB compressed, ~684 MB extracted)…"
  curl -fL --retry 3 --retry-delay 2 -o "$gz" \
    'https://crackstation.net/files/crackstation-human-only.txt.gz'
  log "decompress…"
  gunzip -f "$gz"
  log "done: ${out#$WL/}"
}

# ---------- crunch patterns ----------
fetch_crunch() {
  if ! command -v crunch >/dev/null 2>&1; then
    warn "crunch not installed — install via 'brew install crunch' (macOS) or 'apt install crunch' (Debian/Ubuntu / Kali)"
    warn "skipping crunch-generated lists"
    return
  fi

  # Small/medium defaults useful for WPA bruteforce on weak numeric PSKs.
  # WPA min length is 8 chars, so we focus on >=8.
  local out
  out="$WL/generated/digits-8.txt"
  if ! skip_if_exists "$out"; then
    if [[ $CRUNCH_BIG -eq 1 ]]; then
      log "crunch: 8-digit numeric (00000000–99999999, ~900 MB)…"
      crunch 8 8 0123456789 -o "$out"
    else
      log "skip 8-digit (~900 MB); pass --crunch-big to generate"
    fi
  fi

  out="$WL/generated/digits-9.txt"
  if [[ $CRUNCH_BIG -eq 1 && ! ( $FORCE -eq 0 && -s "$out" ) ]]; then
    log "crunch: 9-digit numeric (~9 GB)…"
    crunch 9 9 0123456789 -o "$out"
  fi

  # Phone-number style: PL mobile (9 digits starting 4-8) — small, useful as default-PSK guess.
  out="$WL/generated/pl-mobile-9digit.txt"
  if ! skip_if_exists "$out"; then
    log "crunch: PL mobile 9-digit pattern (4-8 + 8 digits, ~500 MB)…"
    crunch 9 9 -t '%@@@@@@@@' -p 4 5 6 7 8 -o "$out" 2>/dev/null || \
      crunch 9 9 -t '%@@@@@@@@' -o "$out"  # fallback if -p syntax differs
  fi

  # 10-char hex (matches some sticker-WPA formats).
  out="$WL/generated/hex-10-lower.txt"
  if [[ $CRUNCH_BIG -eq 1 ]] && ! skip_if_exists "$out"; then
    log "crunch: 10-char lower-hex (~10 GB)…"
    crunch 10 10 0123456789abcdef -o "$out"
  fi

  # 8-char hex upper — Funbox/Livebox older sticker format.
  out="$WL/generated/hex-8-upper.txt"
  if ! skip_if_exists "$out"; then
    log "crunch: 8-char upper-hex (~32 MB)…"
    crunch 8 8 0123456789ABCDEF -o "$out"
  fi
}

# ---------- Polish ISP curated defaults ----------
write_polish_defaults() {
  local out="$WL/polish-isp-defaults.txt"
  if skip_if_exists "$out"; then return; fi
  log "write polish-isp-defaults.txt (curated, ~250 lines)"
  cat > "$out" <<'EOF'
# Polish ISP / common WiFi default-PSK seeds.
# Source: publicly known sticker/default patterns for routers commonly
# deployed by PL ISPs. Use against networks you own / have permission to test.
# Sticker keys are mostly random; this file targets the *human-changed* and
# *factory-weak* tail. For serial-derived keygen attacks (UPC, some Liveboxes,
# Thomson, Belkin) use dedicated keygens (mkr-router-keygen, upc_keys, etc.).

# Generic Polish weak passwords
admin
admin1
admin123
administrator
administrator1
haslo123
haslo1234
haslo12345
haslo123456
qwerty
qwerty123
qwerty1234
qwertyuiop
zaqwsx
zaq12wsx
zaq1@WSX
1qaz2wsx
1qaz@WSX
polska
polska1
polska123
polska2020
polska2021
polska2022
polska2023
polska2024
polska2025
warszawa
warszawa1
krakow
krakow1
internet
internet1
internet123
internetowe
swiatlowod
swiatlowod1
swiatlowod123
swiatlowodowy
swiatlowodowy1

# Common base passwords (worldwide top + PL local)
password
password1
password123
welcome
welcome1
welcome123
12345678
123456789
1234567890
qwerty12345
letmein
letmein1
iloveyou
princess
monkey12
dragon123
sunshine

# Orange / Funbox / Livebox — human-changed common
funbox
funbox1
funbox123
funbox2024
funbox2025
livebox
livebox1
livebox123
orange
orange1
orange123
orangepl
orangepolska
neostrada
neostrada1
neostrada123
neostrada2020
tppsa
tppsa123

# PLAY (P4)
play
play1
play123
play2024
play2025
playmobile
play_4g
play5g
play_swiatlowod
playswiatlowod
P4_internet

# T-Mobile / Era / Heyah
tmobile
tmobile1
tmobile123
era_gsm
heyah
heyah1
heyah123

# UPC / Vectra / Multimedia / Inea
upc12345
upc123456
upc1234567
upc12345678
vectra
vectra1
vectra123
multimedia
multimedia1
multimedia123
inea
inea1
inea123
inea2024
inea2025

# Netia
netia
netia1
netia123
netia2024
netia2025
netia_internet
netiaspot

# Plus / Cyfrowy Polsat
plus_gsm
plusgsm
cyfrowy_polsat
polsat
polsat1
polsat123
ipla

# Aero2 / Nju / Lycamobile / Klucz
aero2
aero2_internet
nju_mobile
nju1
nju123
lycamobile

# Common router admin defaults often reused as WPA key
admin_admin
admin_password
1234567a
asdfghjkl
asdfghjkl1
zxcvbnm
zxcvbnm1
0987654321

# Year-tail patterns (people append year to base words)
haslo2020
haslo2021
haslo2022
haslo2023
haslo2024
haslo2025
admin2020
admin2021
admin2022
admin2023
admin2024
admin2025
internet2020
internet2021
internet2022
internet2023
internet2024
internet2025

# Polish first-name + year (common PSK style "Mariusz2024")
# (small sample — extend with combinator + names list for full coverage)
adam2024
adam2025
piotr2024
piotr2025
kasia2024
kasia2025
ania2024
ania2025
marek2024
marek2025
tomek2024
tomek2025
michal2024
michal2025
kasia123
ania123
marek123
tomek123

# Numeric quick wins
00000000
11111111
22222222
33333333
44444444
55555555
66666666
77777777
88888888
99999999
12121212
13131313
14141414
12344321
87654321
01234567
EOF
}

# ---------- run ----------
[[ $SKIP_SL -eq 1 ]] || fetch_seclists
[[ $SKIP_CS -eq 1 ]] || fetch_crackstation
[[ $SKIP_CR -eq 1 ]] || fetch_crunch
[[ $SKIP_PL -eq 1 ]] || write_polish_defaults

log "done. inventory:"
find "$WL" -maxdepth 2 -type f -printf '  %p  (%s bytes)\n' 2>/dev/null \
  || find "$WL" -maxdepth 2 -type f -exec ls -lh {} \; | awk '{print "  "$NF"  ("$5")"}'
