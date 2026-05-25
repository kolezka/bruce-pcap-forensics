// Maps (SSID, BSSID) → known router-family keygen hint, or null.
// Hints are *informational* — we do not run any keygen ourselves. They point
// the user at the right external tool when a default-PSK keygen exists.

export type KeygenHint = {
  family: string;
  tone: 'good' | 'meh' | 'bad';
  // 'good' = public keygen exists, deterministic per-BSSID
  // 'meh'  = sometimes works (firmware-dependent / partial)
  // 'bad'  = sticker key is properly random; only user-changed PSKs are attackable
  tool: string | null;
  note: string;
};

type Rule = {
  ssidPattern?: RegExp;
  ouiPrefixes?: string[]; // first 8 chars of BSSID, uppercase "XX:XX:XX"
  hint: KeygenHint;
};

const RULES: Rule[] = [
  {
    ssidPattern: /^UPC[0-9A-Z]{6,8}$/i,
    hint: {
      family: 'UPC Ubee/Compal',
      tone: 'good',
      tool: 'upc_keys',
      note: 'Deterministic default PSK on older UPC Ubee/Compal models. Generates a small candidate list per BSSID.',
    },
  },
  {
    ssidPattern: /^(TNCAP|SpeedTouch|Thomson)[0-9A-F]+/i,
    hint: {
      family: 'Thomson SpeedTouch',
      tone: 'good',
      tool: 'stkeys',
      note: 'Default PSK derived from serial visible in last 3 hex chars of SSID. Candidate list ~1k entries.',
    },
  },
  {
    ssidPattern: /^(BTHub|BTHomeHub|BTWifi)/i,
    hint: {
      family: 'BT HomeHub',
      tone: 'meh',
      tool: 'hashcat default-mask attack',
      note: 'Older HomeHub3 firmware had short default keys; newer models use proper RNG.',
    },
  },
  {
    ssidPattern: /^Sky[0-9A-Z]+$/,
    hint: {
      family: 'Sky (UK) router',
      tone: 'meh',
      tool: 'skyfu / hashcat',
      note: 'Pre-2015 Sky routers had 8-char uppercase alpha default. Modern ones random.',
    },
  },
  {
    ssidPattern: /^EasyBox[-_]?[0-9]+$/i,
    hint: {
      family: 'Vodafone EasyBox',
      tone: 'good',
      tool: 'easybox-keygen',
      note: 'Default PSK derivable from BSSID for older Arcadyan EasyBox 802/803.',
    },
  },
  {
    ssidPattern: /^(Belkin|belkin)[._-]?[0-9A-F]+/,
    hint: {
      family: 'Belkin (older)',
      tone: 'meh',
      tool: 'belkin-keygen / hashcat',
      note: 'Pre-2014 Belkin models had a deterministic keygen tied to MAC.',
    },
  },
  {
    ssidPattern: /^(FunBox|Funbox)[-_ ]?/i,
    hint: {
      family: 'Orange Funbox (PL)',
      tone: 'bad',
      tool: null,
      note: 'Sticker WPA key is a properly random 26-char hex string — bruteforce infeasible. Only user-changed PSKs are realistic targets (use polish-isp-defaults + CrackStation).',
    },
  },
  {
    ssidPattern: /^Livebox[-_ ]?/i,
    hint: {
      family: 'Orange Livebox (PL/FR)',
      tone: 'bad',
      tool: null,
      note: 'Sticker key is random; no public keygen for modern Liveboxes. Target user-changed PSKs.',
    },
  },
  {
    ssidPattern: /^(PLAY|Play)[-_ ]/,
    hint: {
      family: 'PLAY (P4 Poland)',
      tone: 'bad',
      tool: null,
      note: 'Sticker keys are random. Target user-changed PSKs — see polish-isp-defaults.txt.',
    },
  },
  {
    ssidPattern: /^NETIA[-_ ]/i,
    hint: {
      family: 'Netia (PL)',
      tone: 'bad',
      tool: null,
      note: 'No public keygen. Many users keep weak custom PSKs — try polish-isp-defaults + CrackStation.',
    },
  },
  {
    ssidPattern: /^(T-?Mobile|tmobile)[-_ ]/i,
    hint: {
      family: 'T-Mobile (PL)',
      tone: 'bad',
      tool: null,
      note: 'Sticker keys are random.',
    },
  },
  {
    ssidPattern: /^(Vectra|VECTRA)[-_ ]/,
    hint: {
      family: 'Vectra (PL)',
      tone: 'bad',
      tool: null,
      note: 'Sticker keys are random; check user-set PSKs.',
    },
  },
  {
    ssidPattern: /^Inea[-_ ]/i,
    hint: {
      family: 'Inea (PL)',
      tone: 'bad',
      tool: null,
      note: 'Sticker keys are random; check user-set PSKs.',
    },
  },
  {
    ssidPattern: /^Movistar[_-]?[0-9A-F]+/i,
    hint: {
      family: 'Movistar (ES)',
      tone: 'good',
      tool: 'movistar-keygen / hashcat',
      note: 'Older Comtrend/Zyxel Movistar routers had keygen-based defaults.',
    },
  },
];

export function keygenHint(ssid: string | null | undefined, bssid: string | null | undefined): KeygenHint | null {
  if (!ssid && !bssid) return null;
  const ssidStr = ssid ?? '';
  const ouiUpper = (bssid ?? '').slice(0, 8).toUpperCase();
  for (const rule of RULES) {
    if (rule.ssidPattern && ssidStr && rule.ssidPattern.test(ssidStr)) return rule.hint;
    if (rule.ouiPrefixes && ouiUpper && rule.ouiPrefixes.includes(ouiUpper)) return rule.hint;
  }
  return null;
}

export type WordlistSource = 'seclists' | 'crackstation' | 'generated' | 'polish' | 'user';

export function wordlistSource(name: string): WordlistSource {
  if (name.startsWith('seclists-wifi/')) return 'seclists';
  if (name.startsWith('crackstation/')) return 'crackstation';
  if (name.startsWith('generated/')) return 'generated';
  if (name === 'polish-isp-defaults.txt') return 'polish';
  return 'user';
}
