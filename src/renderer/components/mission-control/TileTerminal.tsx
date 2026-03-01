import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { PROVIDER_IDS, type ProviderId } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';
import { terminalSessionRegistry } from '../../terminal/SessionRegistry';
import type { TerminalSessionManager } from '../../terminal/TerminalSessionManager';

interface TileTerminalProps {
  taskId: string;
  agentId?: string;
  className?: string;
}

/**
 * Lightweight terminal view for Mission Control tiles.
 *
 * If an existing TerminalSessionManager exists in the registry (running/awaiting
 * tasks, or idle tasks that were previously viewed), it re-attaches that session
 * in preview mode (suppressing PTY resize).
 *
 * If no session exists (idle task never opened this app session), it creates a
 * standalone xterm.js Terminal and loads the saved snapshot for ANSI-colored display
 * without starting a PTY process.
 */
const TileTerminal: React.FC<TileTerminalProps> = ({ taskId, agentId, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Try to find an existing session in the registry
    let session: TerminalSessionManager | undefined;

    // Try agentId first for fast lookup, then fall back to iterating all providers
    const providerOrder: ProviderId[] = agentId
      ? [agentId as ProviderId, ...PROVIDER_IDS.filter((p) => p !== agentId)]
      : [...PROVIDER_IDS];

    for (const prov of providerOrder) {
      const ptyId = makePtyId(prov, 'main', taskId);
      session = terminalSessionRegistry.getSession(ptyId);
      if (session) break;
    }

    if (session) {
      // Existing session — attach in preview mode (suppresses PTY resize)
      session.setPreviewMode(true);
      session.attach(container);
      session.scrollToBottom();

      const s = session; // capture for cleanup
      return () => {
        s.setPreviewMode(false);
        s.detach();
      };
    }

    // No session — create standalone terminal for snapshot display (no PTY)
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

    // Load snapshot data asynchronously
    let cancelled = false;
    (async () => {
      const api = window.electronAPI;
      if (!api?.ptyGetSnapshot) return;

      for (const prov of PROVIDER_IDS) {
        if (cancelled) return;
        const ptyId = makePtyId(prov, 'main', taskId);
        try {
          const res = await api.ptyGetSnapshot({ id: ptyId });
          if (cancelled) return;
          if (res?.ok && res.snapshot?.data) {
            terminal.write(res.snapshot.data);
            terminal.scrollToBottom();
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
