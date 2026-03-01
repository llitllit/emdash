import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { activityStore } from '../../lib/activityStore';
import type { Project } from '../../types/app';
import type { Task } from '../../types/chat';
import type { TaskStatus } from '../../hooks/useTaskBusy';
import type {
  MissionControlTask,
  MissionControlFilter,
  MissionControlStatusCounts,
  FocusedPaneState,
} from './types';

const LAYOUT_HYSTERESIS_MS = 2000;

interface UseMissionControlStoreOptions {
  projects: Project[];
}

function tierOrder(status: TaskStatus): number {
  if (status === 'awaiting_input') return 0;
  if (status === 'running') return 1;
  return 2;
}

export function useMissionControlStore(options: UseMissionControlStoreOptions) {
  const { projects } = options;

  // --- Core state ---
  const [filter, setFilter] = useState<MissionControlFilter>('all');
  const [focusedPane, setFocusedPane] = useState<FocusedPaneState>(null);

  // --- Derived: all non-archived tasks across all projects ---
  const allTaskEntries = useMemo(() => {
    const entries: { task: Task; project: Project }[] = [];
    for (const project of projects) {
      for (const task of (project.tasks || []) as Task[]) {
        if (task.archivedAt) continue;
        entries.push({ task, project });
      }
    }
    return entries;
  }, [projects]);

  // --- Per-task status subscriptions ---
  const [statusMap, setStatusMap] = useState<Map<string, TaskStatus>>(new Map());

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    for (const { task } of allTaskEntries) {
      const off = activityStore.subscribe(
        task.id,
        (_busy) => {
          const sig = activityStore.getLastSignal(task.id);
          const status: TaskStatus =
            sig === 'awaiting_input'
              ? 'awaiting_input'
              : _busy
                ? 'running'
                : 'idle';
          setStatusMap((prev) => {
            if (prev.get(task.id) === status) return prev;
            const next = new Map(prev);
            next.set(task.id, status);
            return next;
          });
        },
        { kinds: ['main'] }
      );
      unsubs.push(off);
    }

    return () => {
      for (const off of unsubs) {
        try {
          off();
        } catch {}
      }
    };
  }, [allTaskEntries]);

  // --- Status counts ---
  const counts = useMemo<MissionControlStatusCounts>(() => {
    let running = 0;
    let awaitingInput = 0;
    let idle = 0;
    for (const { task } of allTaskEntries) {
      const s = statusMap.get(task.id) || 'idle';
      if (s === 'running') running++;
      else if (s === 'awaiting_input') awaitingInput++;
      else idle++;
    }
    return { total: allTaskEntries.length, running, awaitingInput, idle };
  }, [allTaskEntries, statusMap]);

  // --- Raw filtered + sorted task list ---
  const rawTasks = useMemo<MissionControlTask[]>(() => {
    let awaitingIdx = 0;
    return allTaskEntries
      .map(({ task, project }) => {
        const status = statusMap.get(task.id) || 'idle';
        return { task, project, status, tailLines: [], awaitingInputIndex: null as number | null };
      })
      .filter((t) => filter === 'all' || t.status === filter)
      .sort((a, b) => tierOrder(a.status) - tierOrder(b.status))
      .map((t) => ({
        ...t,
        awaitingInputIndex: t.status === 'awaiting_input' ? ++awaitingIdx : null,
      }));
  }, [allTaskEntries, statusMap, filter]);

  // --- Layout hysteresis ---
  const [stableTasks, setStableTasks] = useState<MissionControlTask[]>([]);
  const hysteresisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tierCount = (arr: MissionControlTask[], s: TaskStatus) =>
      arr.filter((t) => t.status === s).length;

    const tierCountsMatch =
      tierCount(rawTasks, 'awaiting_input') ===
        tierCount(stableTasks, 'awaiting_input') &&
      tierCount(rawTasks, 'running') === tierCount(stableTasks, 'running') &&
      tierCount(rawTasks, 'idle') === tierCount(stableTasks, 'idle') &&
      rawTasks.length === stableTasks.length;

    if (tierCountsMatch) {
      // Content-only change — update immediately
      setStableTasks(rawTasks);
      return;
    }

    // Tier counts changed — debounce
    if (hysteresisTimerRef.current) {
      clearTimeout(hysteresisTimerRef.current);
    }
    hysteresisTimerRef.current = setTimeout(() => {
      setStableTasks(rawTasks);
      hysteresisTimerRef.current = null;
    }, LAYOUT_HYSTERESIS_MS);

    return () => {
      if (hysteresisTimerRef.current) {
        clearTimeout(hysteresisTimerRef.current);
      }
    };
  }, [rawTasks]); // intentionally not including stableTasks to avoid loop

  // --- Actions ---
  const focusTask = useCallback((taskId: string) => {
    setFocusedPane({ taskId });
  }, []);

  const unfocus = useCallback(() => {
    setFocusedPane(null);
  }, []);

  return {
    filter,
    setFilter,
    focusedPane,
    focusTask,
    unfocus,
    tasks: stableTasks,
    counts,
    allTaskEntries,
  };
}
