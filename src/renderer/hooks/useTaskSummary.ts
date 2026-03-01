import { useEffect, useState } from 'react';

interface TaskSummary {
  lastAgentMessage: string | null;
  loading: boolean;
}

export function useTaskSummary(taskId: string, enabled: boolean): TaskSummary {
  const [lastAgentMessage, setLastAgentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await window.electronAPI.getLastAgentMessage(taskId);
        if (cancelled) return;
        if (res?.success && res.message?.content) {
          setLastAgentMessage(res.message.content);
        }
      } catch {
        // gracefully ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [taskId, enabled]);

  return { lastAgentMessage, loading };
}
