import { useEffect, useCallback, useRef } from 'react';
import type { MissionControlTask, FocusedPaneState } from './types';
import { PROVIDER_IDS } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';

interface UseMissionControlKeysOptions {
  tasks: MissionControlTask[];
  focusedPane: FocusedPaneState;
  focusTask: (taskId: string) => void;
  unfocus: () => void;
}

const IDLE_THRESHOLD_MS = 15_000;

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

  // --- Smart auto-focus: track user interaction ---
  const lastInteractionRef = useRef(Date.now());

  useEffect(() => {
    const markActive = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener('keydown', markActive, true);
    window.addEventListener('mousedown', markActive, true);
    return () => {
      window.removeEventListener('keydown', markActive, true);
      window.removeEventListener('mousedown', markActive, true);
    };
  }, []);

  // Auto-focus if exactly 1 awaiting task and user idle for 15s
  const autoFocusTargetId =
    !focusedPane && awaitingTasks.length === 1
      ? awaitingTasks[0].task.id
      : null;

  useEffect(() => {
    if (!autoFocusTargetId) return;

    let timerId: ReturnType<typeof setTimeout>;

    const check = () => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed >= IDLE_THRESHOLD_MS) {
        focusTask(autoFocusTargetId);
      } else {
        timerId = setTimeout(check, IDLE_THRESHOLD_MS - elapsed);
      }
    };

    check();

    return () => clearTimeout(timerId);
  }, [autoFocusTargetId, focusTask]);

  // --- Keyboard handler ---
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
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
          // Auto-advance to next awaiting task
          const remaining = awaitingTasks.filter(
            (t) => t.task.id !== focusedPane.taskId
          );
          if (remaining.length > 0) {
            focusTask(remaining[0].task.id);
          } else {
            unfocus();
          }
          return;
        }
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          sendPtyInput(focusedPane.taskId, 'n\n');
          // Auto-advance to next awaiting task
          const remaining = awaitingTasks.filter(
            (t) => t.task.id !== focusedPane.taskId
          );
          if (remaining.length > 0) {
            focusTask(remaining[0].task.id);
          } else {
            unfocus();
          }
          return;
        }
      } else {
        // --- Grid mode ---
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
