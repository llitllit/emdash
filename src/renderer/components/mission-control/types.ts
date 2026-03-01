import type { Task } from '../../types/chat';
import type { Project } from '../../types/app';
import type { TaskStatus } from '../../hooks/useTaskBusy';

export interface MissionControlTask {
  task: Task;
  project: Project;
  status: TaskStatus;
  /** 1-based badge number for awaiting_input tasks, null otherwise */
  awaitingInputIndex: number | null;
}

export type MissionControlFilter = 'all' | 'awaiting_input' | 'running' | 'idle';

export interface MissionControlStatusCounts {
  total: number;
  running: number;
  awaitingInput: number;
  idle: number;
}

export type FocusedPaneState = {
  taskId: string;
} | null;
