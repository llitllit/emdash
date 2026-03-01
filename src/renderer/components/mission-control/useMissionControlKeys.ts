import { useEffect, useCallback } from 'react';
import type { MissionControlTask, FocusedPaneState } from './types';
import { PROVIDER_IDS } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';

interface UseMissionControlKeysOptions {
  tasks: MissionControlTask[];
  focusedPane: FocusedPaneState;
  focusTask: (taskId: string) => void;
  unfocus: () => void;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function sendPtyInput(taskId: string, data: string) {
  const api = window.electronAPI;
  if (!api?.ptyInput) return;

  for (const prov of PROVIDER_IDS) {
    const ptyId = makePtyId(prov, 'main', taskId);
    try {
      api.ptyInput({ id: ptyId, data });
    } catch {}
  }
}

export function useMissionControlKeys(options: UseMissionControlKeysOptions) {
  const { tasks, focusedPane, focusTask, unfocus } = options;

  const awaitingTasks = tasks.filter((t) => t.status === 'awaiting_input');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (isEditableTarget(e.target)) return;
      // Skip if any modifier keys are held (avoid conflicting with global shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (focusedPane) {
        // --- Focused mode ---
        if (e.key === 'Escape') {
          e.preventDefault();
          unfocus();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          sendPtyInput(focusedPane.taskId, 'y\n');
          unfocus();
          return;
        }
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          sendPtyInput(focusedPane.taskId, 'n\n');
          unfocus();
          return;
        }
      } else {
        // --- Grid mode ---
        // Number keys 1-9 focus the Nth awaiting task
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          const target = awaitingTasks.find(
            (t) => t.awaitingInputIndex === num
          );
          if (target) {
            e.preventDefault();
            focusTask(target.task.id);
            return;
          }
        }
        // Enter auto-focuses if exactly 1 awaiting task
        if (e.key === 'Enter' && awaitingTasks.length === 1) {
          e.preventDefault();
          focusTask(awaitingTasks[0].task.id);
          return;
        }
      }
    },
    [focusedPane, awaitingTasks, focusTask, unfocus]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
