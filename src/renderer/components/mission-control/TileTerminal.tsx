import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { PROVIDER_IDS, type ProviderId } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';

interface TileTerminalProps {
  taskId: string;
  agentId?: string;
  className?: string;
}

/**
 * Lightweight read-only terminal view for Mission Control tiles.
 *
 * Always creates a standalone xterm.js Terminal (never touches existing sessions).
 * Loads the saved snapshot for initial content, then subscribes to onPtyData
 * for live streaming. This avoids stealing the session from the main task view.
 */
const TileTerminal: React.FC<TileTerminalProps> = ({ taskId, agentId, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 1000,
      convertEol: true,
      disableStdin: true,
      cursorBlink: false,
      cursorStyle: 'bar',
      cursorInactiveStyle: 'none',
      theme: {
        background: '#1f2937',
        foreground: '#f9fafb',
        cursor: 'transparent',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    try {
      fitAddon.fit();
    } catch {}

    // Try agentId first for fast lookup, then fall back to iterating all providers
    const providerOrder: ProviderId[] = agentId
      ? [agentId as ProviderId, ...PROVIDER_IDS.filter((p) => p !== agentId)]
      : [...PROVIDER_IDS];

    // Load snapshot and subscribe to live data
    let cancelled = false;
    let offPtyData: (() => void) | undefined;

    (async () => {
      const api = window.electronAPI;
      if (!api?.ptyGetSnapshot) return;

      for (const prov of providerOrder) {
        if (cancelled) return;
        const ptyId = makePtyId(prov, 'main', taskId);
        try {
          const res = await api.ptyGetSnapshot({ id: ptyId });
          if (cancelled) return;
          if (res?.ok && res.snapshot?.data) {
            terminal.write(res.snapshot.data);
            terminal.scrollToBottom();

            // Subscribe to live PTY output
            if (api.onPtyData) {
              offPtyData = api.onPtyData(ptyId, (data: string) => {
                terminal.write(data);
                terminal.scrollToBottom();
              });
            }
            return;
          }
        } catch {
          // try next provider
        }
      }
    })();

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {}
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      offPtyData?.();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [taskId, agentId]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
};

export default TileTerminal;
