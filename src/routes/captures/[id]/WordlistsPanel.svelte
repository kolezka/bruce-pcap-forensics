<script lang="ts">
  import Pill from '$lib/ui/Pill.svelte';
  import { wordlistSource, type WordlistSource } from '$lib/keygenHints';
  import { onDestroy } from 'svelte';

  type Wordlist = { name: string; bytes: number };
  type FetchJob = {
    status: 'idle' | 'running' | 'done' | 'error';
    log: string;
    startedAt: number | null;
    finishedAt: number | null;
    exitCode: number | null;
  };

  let { wordlists = $bindable<Wordlist[]>([]) } = $props<{ wordlists: Wordlist[] }>();

  let open = $state(false);
  let busy = $state(false);
  let job = $state<FetchJob>({ status: 'idle', log: '', startedAt: null, finishedAt: null, exitCode: null });
  let includeCrackstation = $state(false);
  let crunchBig = $state(false);
  let force = $state(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    wordlists = await fetch('/api/wordlists').then((r) => r.json());
  }

  async function pollJob(): Promise<void> {
    job = await fetch('/api/wordlists/fetch').then((r) => r.json());
    if (job.status !== 'running' && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      await refresh();
    }
  }

  async function startFetch(): Promise<void> {
    busy = true;
    const r = await fetch('/api/wordlists/fetch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ includeCrackstation, crunchBig, force }),
    });
    busy = false;
    if (!r.ok) { alert('fetch start failed: ' + (await r.text())); return; }
    job = await r.json();
    if (!pollTimer) pollTimer = setInterval(pollJob, 1500);
  }

  // Pick up an already-running job if the page was just opened mid-fetch
  void (async () => {
    job = await fetch('/api/wordlists/fetch').then((r) => r.json()).catch(() => job);
    if (job.status === 'running' && !pollTimer) pollTimer = setInterval(pollJob, 1500);
  })();

  onDestroy(() => { if (pollTimer) clearInterval(pollTimer); });

  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  const SOURCE_LABEL: Record<WordlistSource, string> = {
    seclists: 'SecLists',
    crackstation: 'CrackStation',
    generated: 'Generated',
    polish: 'Polish defaults',
    user: 'User',
  };
  const SOURCE_TONE: Record<WordlistSource, 'default' | 'info' | 'warn' | 'high' | 'success'> = {
    seclists: 'info',
    crackstation: 'warn',
    generated: 'success',
    polish: 'high',
    user: 'default',
  };

  const grouped = $derived.by(() => {
    const m: Record<WordlistSource, Wordlist[]> = { polish: [], seclists: [], crackstation: [], generated: [], user: [] };
    for (const wl of wordlists) m[wordlistSource(wl.name)].push(wl);
    return m;
  });

  const totalBytes = $derived(wordlists.reduce((a: number, b: Wordlist) => a + b.bytes, 0));
</script>

<div class="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
  <button
    class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-[color-mix(in_oklab,var(--color-bg-elev),var(--color-accent)_8%)]"
    onclick={() => (open = !open)}
  >
    <span class="flex items-center gap-2">
      <span class="text-[var(--color-fg-muted)]">{open ? '▾' : '▸'}</span>
      <strong>Wordlists</strong>
      <span class="text-[var(--color-fg-muted)]">
        {wordlists.length} files · {fmtBytes(totalBytes)} total
      </span>
      {#if job.status === 'running'}
        <Pill tone="info">fetching…</Pill>
      {:else if job.status === 'error'}
        <Pill tone="high">fetch error</Pill>
      {:else if job.status === 'done'}
        <Pill tone="success">fetched</Pill>
      {/if}
    </span>
    <span class="flex items-center gap-2">
      <span
        role="button"
        tabindex="0"
        class="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)] cursor-pointer"
        onclick={(e) => { e.stopPropagation(); void refresh(); }}
        onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void refresh(); } }}
      >refresh</span>
    </span>
  </button>

  {#if open}
    <div class="border-t border-[var(--color-border)] px-3 py-3">
      <div class="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <label class="flex items-center gap-1"><input type="checkbox" bind:checked={includeCrackstation} /> include CrackStation (~684 MB)</label>
        <label class="flex items-center gap-1"><input type="checkbox" bind:checked={crunchBig} /> crunch-big (~900 MB+ patterns)</label>
        <label class="flex items-center gap-1"><input type="checkbox" bind:checked={force} /> force re-download</label>
        <button
          class="text-xs rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] px-3 py-1 disabled:opacity-50"
          disabled={busy || job.status === 'running'}
          onclick={startFetch}
        >
          {job.status === 'running' ? 'fetching…' : 'fetch wordlists'}
        </button>
        <span class="text-[var(--color-fg-muted)]">runs <span class="mono">scripts/fetch-wordlists.sh</span></span>
      </div>

      {#if job.log}
        <pre class="mb-3 max-h-40 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs whitespace-pre-wrap">{job.log.slice(-3000)}</pre>
      {/if}

      {#if wordlists.length === 0}
        <p class="text-sm text-[var(--color-fg-muted)]">No wordlists found. Click <em>fetch wordlists</em> above, or drop files into <span class="mono">./wordlists/</span>.</p>
      {:else}
        <table class="w-full text-xs">
          <thead class="text-left text-[var(--color-fg-muted)]">
            <tr><th class="py-1">Source</th><th class="py-1">Name</th><th class="py-1 text-right">Size</th></tr>
          </thead>
          <tbody>
            {#each (['polish','seclists','crackstation','generated','user'] as WordlistSource[]) as src}
              {#each grouped[src] as wl (wl.name)}
                <tr class="border-t border-[var(--color-border)]">
                  <td class="py-1 pr-3"><Pill tone={SOURCE_TONE[src]}>{SOURCE_LABEL[src]}</Pill></td>
                  <td class="py-1 pr-3 mono">{wl.name}</td>
                  <td class="py-1 pr-3 text-right mono">{fmtBytes(wl.bytes)}</td>
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</div>
