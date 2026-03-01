import { useEffect, useState } from 'react';
import { PROVIDER_IDS } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';

const DEFAULT_MAX_LINES = 50;

function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][0-9A-Za-z]/g, '')
    .replace(/\x1b[#=>\x1b]/g, '')
    .replace(/[\r\x07]/g, '');
}

/**
 * Loads a saved terminal snapshot for an idle task.
 * Iterates provider IDs to find the correct ptyId, strips ANSI, returns lines.
 */
export function useTerminalSnapshot(
  taskId: string,
  enabled: boolean,
  maxLines = DEFAULT_MAX_LINES
): { lines: string[]; loading: boolean } {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLines([]);
      setLoading(false);
      return;
    }

    const api = window.electronAPI;
    if (!api?.ptyGetSnapshot) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      for (const prov of PROVIDER_IDS) {
        if (cancelled) return;
        const ptyId = makePtyId(prov, 'main', taskId);
        try {
          const res = await api.ptyGetSnapshot({ id: ptyId });
          if (cancelled) return;
          if (res?.ok && res.snapshot?.data) {
            const clean = stripAnsi(res.snapshot.data);
            const allLines = clean.split('\n');
            const nonEmpty = allLines
              .map((l) => l.trimEnd())
              .filter((l) => l.length > 0);
            setLines(nonEmpty.slice(-maxLines));
            setLoading(false);
            return;
          }
        } catch {
          // try next provider
        }
      }
      if (!cancelled) {
        setLines([]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [taskId, enabled, maxLines]);

  return { lines, loading };
}
