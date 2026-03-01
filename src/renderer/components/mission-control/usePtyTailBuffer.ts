import { useEffect, useState } from 'react';
import { PROVIDER_IDS } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';

const DEFAULT_MAX_LINES = 8;
const FLUSH_INTERVAL_MS = 200;

function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, '')   // CSI + DEC private mode
    .replace(/\x1b\][^\x07]*\x07/g, '')           // OSC sequences
    .replace(/\x1b[()][0-9A-Za-z]/g, '')          // Character set selection
    .replace(/\x1b[#=>\x1b]/g, '')                // Other ESC sequences
    .replace(/[\r\x07]/g, '');                     // CR + BEL
}

interface BufferEntry {
  lines: string[];
  partial: string;
  listeners: Set<(lines: string[]) => void>;
  unsubs: Array<() => void>;
}

/**
 * Singleton manager that subscribes to PTY data for multiple tasks
 * and maintains a ring buffer of the last N ANSI-stripped lines per task.
 */
class PtyTailBufferManager {
  private buffers = new Map<string, BufferEntry>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = new Set<string>();

  subscribe(
    taskId: string,
    maxLines: number,
    listener: (lines: string[]) => void
  ): () => void {
    let entry = this.buffers.get(taskId);
    if (!entry) {
      entry = { lines: [], partial: '', listeners: new Set(), unsubs: [] };
      this.buffers.set(taskId, entry);
      this.setupPtyListeners(taskId, entry, maxLines);
    }
    entry.listeners.add(listener);

    // Emit current state immediately
    listener([...entry.lines]);

    return () => {
      const e = this.buffers.get(taskId);
      if (!e) return;
      e.listeners.delete(listener);
      if (e.listeners.size === 0) {
        // No more listeners — tear down PTY subscriptions
        for (const off of e.unsubs) {
          try { off(); } catch {}
        }
        this.buffers.delete(taskId);
      }
    };
  }

  private setupPtyListeners(
    taskId: string,
    entry: BufferEntry,
    maxLines: number
  ) {
    const api = window.electronAPI;
    if (!api?.onPtyData) return;

    for (const prov of PROVIDER_IDS) {
      const ptyId = makePtyId(prov, 'main', taskId);
      const off = api.onPtyData(ptyId, (chunk: string) => {
        this.handleChunk(taskId, entry, chunk, maxLines);
      });
      if (off) entry.unsubs.push(off);
    }
  }

  private handleChunk(
    taskId: string,
    entry: BufferEntry,
    chunk: string,
    maxLines: number
  ) {
    const clean = stripAnsi(chunk);
    const combined = entry.partial + clean;
    const parts = combined.split('\n');
    entry.partial = parts.pop() || '';

    let changed = false;
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      entry.lines.push(trimmed);
      if (entry.lines.length > maxLines) {
        entry.lines.shift();
      }
      changed = true;
    }

    if (changed) {
      this.dirty.add(taskId);
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const ids = [...this.dirty];
      this.dirty.clear();
      for (const taskId of ids) {
        const entry = this.buffers.get(taskId);
        if (!entry) continue;
        const snapshot = [...entry.lines];
        for (const listener of entry.listeners) {
          listener(snapshot);
        }
      }
    }, FLUSH_INTERVAL_MS);
  }
}

const manager = new PtyTailBufferManager();

/**
 * Hook that subscribes to PTY data for a task and returns the last N
 * ANSI-stripped, non-empty lines of output.
 */
export function usePtyTailBuffer(
  taskId: string,
  maxLines = DEFAULT_MAX_LINES
): string[] {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    return manager.subscribe(taskId, maxLines, setLines);
  }, [taskId, maxLines]);

  return lines;
}
