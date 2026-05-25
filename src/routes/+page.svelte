<script lang="ts">
  import Pill from '$lib/ui/Pill.svelte';
  import { formatDuration } from '$lib/format';
  let { data } = $props();
  let uploading = $state(false);
  let dragOver = $state(false);

  async function upload(file: File) {
    uploading = true;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/captures', { method: 'POST', body: fd });
    if (!res.ok) alert(`upload failed: ${res.status}`);
    uploading = false;
    location.reload();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    for (const f of e.dataTransfer?.files ?? []) {
      if (f.name.toLowerCase().endsWith('.pcap')) upload(f);
    }
  }

  function statusTone(s: string): 'default' | 'info' | 'warn' | 'high' | 'success' {
    if (s === 'ready') return 'success';
    if (s === 'parsing') return 'info';
    if (s === 'error') return 'high';
    return 'default';
  }
</script>

<svelte:window
  on:dragover|preventDefault={() => (dragOver = true)}
  on:dragleave={() => (dragOver = false)}
  on:drop={onDrop}
/>

{#if dragOver || uploading}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center pointer-events-none">
    <div class="rounded-2xl border-2 border-dashed border-[var(--color-accent)] px-8 py-6 text-lg">
      {uploading ? 'uploading…' : 'drop pcap to ingest'}
    </div>
  </div>
{/if}

<section class="p-6">
  <h1 class="text-xl font-semibold mb-4">Captures</h1>
  {#if data.captures.length === 0}
    <p class="text-[var(--color-fg-muted)]">
      No captures yet. Drop a .pcap on this window, or copy one into
      <span class="mono">./captures/</span>.
    </p>
  {:else}
    <table class="w-full text-sm">
      <thead class="text-left text-[var(--color-fg-muted)]">
        <tr>
          <th class="py-2 pr-4">Filename</th>
          <th class="py-2 pr-4">Status</th>
          <th class="py-2 pr-4 text-right">Packets</th>
          <th class="py-2 pr-4 text-right">Duration</th>
          <th class="py-2 pr-4">Source</th>
          <th class="py-2 pr-4">Parsed</th>
        </tr>
      </thead>
      <tbody>
        {#each data.captures as c (c.id)}
          <tr class="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-elev)]">
            <td class="py-2 pr-4"><a class="hover:underline" href={`/captures/${c.id}`}>{c.filename}</a></td>
            <td class="py-2 pr-4"><Pill tone={statusTone(c.status)}>{c.status}</Pill></td>
            <td class="py-2 pr-4 text-right mono">{c.packet_count}</td>
            <td class="py-2 pr-4 text-right mono">
              {c.first_ts_rel != null && c.last_ts_rel != null
                ? formatDuration(c.last_ts_rel - c.first_ts_rel)
                : '—'}
            </td>
            <td class="py-2 pr-4 text-[var(--color-fg-muted)]">{c.source}</td>
            <td class="py-2 pr-4 text-[var(--color-fg-muted)]">
              {c.parsed_at ? new Date(c.parsed_at).toLocaleString() : '—'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
