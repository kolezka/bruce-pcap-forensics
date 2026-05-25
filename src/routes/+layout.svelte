<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <header class="border-b border-[var(--color-border)] px-6 py-3 flex items-center gap-6">
    <a href="/" class="font-semibold tracking-tight">PCAP Forensics</a>
    <nav class="text-sm text-[var(--color-fg-muted)] flex gap-4">
      <a href="/" class="hover:text-[var(--color-fg)]">Captures</a>
      <a href="/networks" class="hover:text-[var(--color-fg)]">Networks</a>
      <a href="/devices" class="hover:text-[var(--color-fg)]">Devices</a>
    </nav>
  </header>
  <main class="flex-1">{@render children()}</main>
</div>
