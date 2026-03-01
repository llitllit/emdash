import { useEffect, useState } from 'react';

interface TaskSummary {
  firstUserMessage: string | null;
  lastAgentMessage: string | null;
  loading: boolean;
}

export function useTaskSummary(taskId: string, enabled: boolean): TaskSummary {
  const [firstUserMessage, setFirstUserMessage] = useState<string | null>(null);
  const [lastAgentMessage, setLastAgentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await window.electronAPI.getTaskSummaryMessages(taskId);
        if (cancelled) return;
        if (res?.success) {
          if (res.firstUserMessage?.content) {
            setFirstUserMessage(res.firstUserMessage.content);
          }
          if (res.lastAgentMessage?.content) {
            setLastAgentMessage(res.lastAgentMessage.content);
          }
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

  return { firstUserMessage, lastAgentMessage, loading };
}
