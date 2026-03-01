import { useEffect, useState } from 'react';

export interface SummaryMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: string;
}

interface TaskSummary {
  firstUserMessage: string | null;
  lastAgentMessage: string | null;
  recentMessages: SummaryMessage[];
  loading: boolean;
}

export function useTaskSummary(taskId: string, enabled: boolean): TaskSummary {
  const [firstUserMessage, setFirstUserMessage] = useState<string | null>(null);
  const [lastAgentMessage, setLastAgentMessage] = useState<string | null>(null);
  const [recentMessages, setRecentMessages] = useState<SummaryMessage[]>([]);
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
          if (res.recentMessages?.length) {
            setRecentMessages(
              res.recentMessages.map((m: any) => ({
                id: m.id,
                sender: m.sender,
                content: m.content,
                timestamp: m.timestamp,
              }))
            );
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

  return { firstUserMessage, lastAgentMessage, recentMessages, loading };
}
