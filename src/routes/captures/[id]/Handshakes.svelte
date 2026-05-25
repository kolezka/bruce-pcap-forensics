<script lang="ts">
  import Pill from '$lib/ui/Pill.svelte';
  import MacBadge from '$lib/ui/MacBadge.svelte';
  import WordlistsPanel from './WordlistsPanel.svelte';
  import { formatDuration } from '$lib/format';
  import { keygenHint } from '$lib/keygenHints';
  import { onMount, onDestroy } from 'svelte';

  let { data, gotoNetwork, gotoDevice } = $props<{
    data: any;
    gotoNetwork: (bssid: string) => void;
    gotoDevice: (mac: string) => void;
  }>();

  type Hs = (typeof data.handshakes)[number];

  let handshakes = $state<Hs[]>(data.handshakes);
  let wordlists = $state<{ name: string; bytes: number }[]>([]);
  let pickerOpenFor = $state<number | null>(null);
  let pickedWordlist = $state<string>('');
  let busy = $state(false);
  let genBusyFor = $state<number | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    wordlists = await fetch('/api/wordlists').then((r) => r.json());
    pollTimer = setInterval(refresh, 1500);
  });
  onDestroy(() => { if (pollTimer) clearInterval(pollTimer); });

  async function refresh() {
    if (!handshakes.some((h) => h.crack_status === 'running')) return;
    const updated: Hs[] = [];
    for (const h of handshakes) {
      if (h.crack_status === 'running') {
        const r = await fetch(`/api/handshakes/${h.id}`).then((r) => r.json());
        updated.push(r);
      } else updated.push(h);
    }
    handshakes = updated;
  }

  async function crack(id: number) {
    if (!pickedWordlist) return;
    busy = true;
    const r = await fetch(`/api/handshakes/${id}/crack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wordlist: pickedWordlist })
    });
    busy = false;
    if (!r.ok) { alert('crack failed: ' + (await r.text())); return; }
    pickerOpenFor = null;
    const updated = await r.json();
    handshakes = handshakes.map((h) => (h.id === updated.id ? updated : h));
  }

  let bulkPickerOpen = $state(false);
  let bulkWordlist = $state('');
  async function crackAll() {
    if (!bulkWordlist) return;
    busy = true;
    const r = await fetch(`/api/captures/${data.capture.id}/crack-all`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wordlist: bulkWordlist })
    });
    busy = false;
    if (!r.ok) { alert('crack-all failed: ' + (await r.text())); return; }
    const { started, total } = await r.json();
    bulkPickerOpen = false;
    // refresh from server
    const detail = await fetch(`/api/captures/${data.capture.id}`).then((r) => r.json());
    handshakes = detail.handshakes;
    if (started < total) alert(`Started ${started} of ${total} handshakes (already cracked ones skipped)`);
  }

  function hintClass(tone: 'good' | 'meh' | 'bad'): string {
    if (tone === 'good') return 'bg-[color-mix(in_oklab,var(--color-enc-wpa3),transparent_70%)] text-[var(--color-enc-wpa3)]';
    if (tone === 'meh') return 'bg-[color-mix(in_oklab,var(--color-sev-warn),transparent_70%)] text-[var(--color-sev-warn)]';
    return 'bg-[color-mix(in_oklab,var(--color-sev-high),transparent_70%)] text-[var(--color-sev-high)]';
  }

  async function packageForSsid(h: Hs): Promise<void> {
    const ssid = h.ssid;
    if (!ssid) { alert('SSID is hidden — no target name to package'); return; }
    genBusyFor = h.id;
    try {
      const r = await fetch('/api/wordlists/gen-ssid', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ssid }),
      });
      if (!r.ok) { alert('gen-ssid failed: ' + (await r.text())); return; }
      const { path } = (await r.json()) as { path: string; lines: number };
      wordlists = await fetch('/api/wordlists').then((r) => r.json());
      pickerOpenFor = h.id;
      pickedWordlist = path;
    } finally {
      genBusyFor = null;
    }
  }

  function statusTone(s: string): 'default' | 'info' | 'warn' | 'high' | 'success' {
    if (s === 'cracked') return 'success';
    if (s === 'running') return 'info';
    if (s === 'error') return 'high';
    if (s === 'not_found') return 'warn';
    return 'default';
  }
  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
</script>

<WordlistsPanel bind:wordlists />

{#if handshakes.length === 0}
  <p class="text-[var(--color-fg-muted)]">No EAPOL handshakes detected in this capture.</p>
{:else}
  <div class="mb-3 flex items-center gap-3">
    <span class="text-sm text-[var(--color-fg-muted)]">{handshakes.length} handshake(s)</span>
    {#if handshakes.some((h) => h.is_complete && h.crack_status !== 'cracked' && h.crack_status !== 'running')}
      <button
        class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)]"
        onclick={() => { bulkPickerOpen = !bulkPickerOpen; bulkWordlist = wordlists[0]?.name ?? ''; }}
      >crack all (uncracked)</button>
    {/if}
  </div>

  {#if bulkPickerOpen}
    <div class="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-2 flex items-center gap-3">
      <label class="text-sm text-[var(--color-fg-muted)]">wordlist for all:</label>
      <select class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm" bind:value={bulkWordlist}>
        {#each wordlists as wl (wl.name)}<option value={wl.name}>{wl.name} ({fmtBytes(wl.bytes)})</option>{/each}
      </select>
      <button
        class="text-sm rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] px-3 py-1 disabled:opacity-50"
        disabled={busy || !bulkWordlist}
        onclick={crackAll}
      >start aircrack-ng on all</button>
      <button class="text-sm hover:underline" onclick={() => (bulkPickerOpen = false)}>cancel</button>
    </div>
  {/if}

  <table class="w-full text-sm">
    <thead class="text-left text-[var(--color-fg-muted)] sticky top-0 bg-[var(--color-bg)]">
      <tr>
        <th class="py-2">SSID</th>
        <th class="py-2">AP (BSSID)</th>
        <th class="py-2">Station</th>
        <th class="py-2 text-right">Frames</th>
        <th class="py-2 text-right">Duration</th>
        <th class="py-2">Status</th>
        <th class="py-2">Result</th>
        <th class="py-2 text-right">Action</th>
      </tr>
    </thead>
    <tbody>
      {#each handshakes as h (h.id)}
        <tr class="border-t border-[var(--color-border)] align-top">
          <td class="py-2 pr-4">
            <button class="hover:underline" onclick={() => gotoNetwork(h.bssid)}>
              {h.ssid ?? '<hidden>'}
            </button>
            {#if keygenHint(h.ssid, h.bssid)}
              {@const hint = keygenHint(h.ssid, h.bssid)!}
              <div class="mt-1">
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] cursor-help ${hintClass(hint.tone)}`}
                  title={hint.note + (hint.tool ? `\n\nTool: ${hint.tool}` : '')}
                >
                  {hint.family}{#if hint.tool} · {hint.tool}{/if}
                </span>
              </div>
            {/if}
          </td>
          <td class="py-2 pr-4">
            <button class="text-left" onclick={() => gotoNetwork(h.bssid)}><MacBadge mac={h.bssid} /></button>
          </td>
          <td class="py-2 pr-4">
            <button class="text-left" onclick={() => gotoDevice(h.sta_mac)}><MacBadge mac={h.sta_mac} /></button>
          </td>
          <td class="py-2 pr-4 text-right mono">{h.frame_count}</td>
          <td class="py-2 pr-4 text-right mono">{formatDuration(h.ts_rel_end - h.ts_rel_start)}</td>
          <td class="py-2 pr-4">
            <Pill tone={statusTone(h.crack_status)}>{h.crack_status}</Pill>
            {#if h.is_complete}<Pill tone="success">complete</Pill>{:else}<Pill tone="warn">partial</Pill>{/if}
          </td>
          <td class="py-2 pr-4 text-xs">
            {#if h.crack_password}
              <span class="mono text-[var(--color-enc-wpa3)]">{h.crack_password}</span>
              <div class="text-[var(--color-fg-muted)] mt-0.5">
                via {h.crack_wordlist} · {h.crack_keys_tested?.toLocaleString() ?? '?'} keys
              </div>
            {:else if h.crack_status === 'running'}
              <span class="text-[var(--color-fg-muted)] mono">
                {(h.crack_keys_tested ?? 0).toLocaleString()} keys tested…
              </span>
            {:else if h.crack_status === 'not_found'}
              <span class="text-[var(--color-fg-muted)]">
                not in {h.crack_wordlist} ({h.crack_keys_tested?.toLocaleString() ?? '?'} tried)
              </span>
            {:else if h.crack_status === 'error'}
              <span class="text-[var(--color-sev-high)] text-xs mono">error — see log</span>
            {:else}
              <span class="text-[var(--color-fg-muted)]">—</span>
            {/if}
          </td>
          <td class="py-2 pr-4 text-right whitespace-nowrap">
            <a
              class="text-xs hover:underline text-[var(--color-fg-muted)] mr-2"
              href={`/api/handshakes/${h.id}/pcap`}
              download
            >.pcap</a>
            {#if h.is_complete && h.crack_status !== 'running'}
              {#if h.ssid}
                <button
                  class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 mr-1 hover:border-[var(--color-accent)] disabled:opacity-50"
                  disabled={genBusyFor === h.id}
                  title="Generate SSID-targeted wordlist (ssid+00..99, years, common suffixes) and pick it"
                  onclick={() => packageForSsid(h)}
                >
                  {genBusyFor === h.id ? 'packaging…' : 'package for SSID'}
                </button>
              {/if}
              <button
                class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)]"
                onclick={() => { pickerOpenFor = h.id; pickedWordlist = wordlists[0]?.name ?? ''; }}
              >
                {h.crack_status === 'idle' ? 'crack' : 're-crack'}
              </button>
            {/if}
          </td>
        </tr>
        {#if pickerOpenFor === h.id}
          <tr class="border-t border-[var(--color-border)] bg-[var(--color-bg-elev)]">
            <td colspan="8" class="py-3 px-2">
              {#if wordlists.length === 0}
                <p class="text-sm text-[var(--color-fg-muted)]">
                  No wordlists found. Drop a wordlist file into
                  <span class="mono">./wordlists/</span> and reload this page.
                </p>
              {:else}
                <div class="flex items-center gap-3">
                  <label class="text-sm text-[var(--color-fg-muted)]">wordlist:</label>
                  <select
                    class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
                    bind:value={pickedWordlist}
                  >
                    {#each wordlists as wl (wl.name)}
                      <option value={wl.name}>{wl.name} ({fmtBytes(wl.bytes)})</option>
                    {/each}
                  </select>
                  <button
                    class="text-sm rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] px-3 py-1 disabled:opacity-50"
                    disabled={busy || !pickedWordlist}
                    onclick={() => crack(h.id)}
                  >start aircrack-ng</button>
                  <button class="text-sm hover:underline" onclick={() => (pickerOpenFor = null)}>cancel</button>
                </div>
                <p class="mt-2 text-xs text-[var(--color-fg-muted)]">
                  aircrack-ng runs on CPU; pace depends on wordlist size and your hardware. The job runs
                  in the background, this view polls status every 1.5s.
                </p>
              {/if}
            </td>
          </tr>
        {/if}
        {#if h.crack_log && (h.crack_status === 'running' || h.crack_status === 'error')}
          <tr class="bg-[var(--color-bg-elev)]">
            <td colspan="8" class="p-3 mono text-xs whitespace-pre-wrap text-[var(--color-fg-muted)]">{h.crack_log.slice(-1200)}</td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
{/if}
