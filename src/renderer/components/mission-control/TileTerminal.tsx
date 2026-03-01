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
 * Interactive terminal view for Mission Control tiles.
 *
 * Always creates a standalone xterm.js Terminal (never touches existing sessions).
 * Loads the saved snapshot for initial content, then subscribes to onPtyData
 * for live streaming. Keyboard input is forwarded via ptyInput IPC.
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
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#1f2937',
        foreground: '#f9fafb',
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
    // Store the resolved ptyId so onData can send input to the correct PTY
    const ptyIdRef: { current: string | null } = { current: null };

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
            ptyIdRef.current = ptyId;
            terminal.write(res.snapshot.data);
            terminal.scrollToBottom();

            // Subscribe to live PTY output
            if (api.onPtyData) {
              offPtyData = api.onPtyData(ptyId, (data: string) => {
                terminal.write(data);
                terminal.scrollToBottom();
              });
            }

            // Sync PTY size to current terminal dimensions
            if (api.ptyResize) {
              try {
                api.ptyResize({ id: ptyId, cols: terminal.cols, rows: terminal.rows });
              } catch {}
            }

            return;
          }
        } catch {
          // try next provider
        }
      }
    })();

    // Forward keyboard input to the PTY
    const onDataDisposable = terminal.onData((data) => {
      const id = ptyIdRef.current;
      if (id && window.electronAPI?.ptyInput) {
        window.electronAPI.ptyInput({ id, data });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        // Notify PTY of new dimensions
        const id = ptyIdRef.current;
        if (id && window.electronAPI?.ptyResize) {
          window.electronAPI.ptyResize({ id, cols: terminal.cols, rows: terminal.rows });
        }
      } catch {}
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      offPtyData?.();
      onDataDisposable.dispose();
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
      }}
    />
  );
};

export default TileTerminal;
