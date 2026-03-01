import React, { useCallback } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import { LayoutGrid } from 'lucide-react';
import type { Project } from '../../types/app';
import type { Task } from '../../types/chat';
import { useMissionControlStore } from './useMissionControlStore';
import MissionControlStatusBar from './MissionControlStatusBar';
import MissionControlPane from './MissionControlPane';
import MissionControlFocusedPane from './MissionControlFocusedPane';
import { useMissionControlKeys, getNextAwaitingTask } from './useMissionControlKeys';

interface MissionControlViewProps {
  projects: Project[];
  onSelectTask: (task: Task) => void;
}

function gridCols(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

const MissionControlView: React.FC<MissionControlViewProps> = ({
  projects,
  onSelectTask,
}) => {
  const store = useMissionControlStore({ projects });
  const {
    tasks,
    counts,
    filter,
    setFilter,
    focusedPane,
    focusTask,
    unfocus,
  } = store;

  useMissionControlKeys({ tasks, focusedPane, focusTask, unfocus });

  const focusedMcTask =
    focusedPane ? tasks.find((t) => t.task.id === focusedPane.taskId) : null;

  const awaitingTasks = tasks.filter((t) => t.status === 'awaiting_input');

  const cols = gridCols(tasks.length);
  const rows = Math.ceil(tasks.length / cols) || 1;

  // Auto-advance after approve/deny button clicks (same logic as keyboard Enter/N)
  const handleAfterAction = useCallback(() => {
    if (!focusedPane) {
      unfocus();
      return;
    }
    const next = getNextAwaitingTask(awaitingTasks, focusedPane.taskId);
    if (next) {
      focusTask(next.task.id);
    } else {
      unfocus();
    }
  }, [focusedPane, awaitingTasks, focusTask, unfocus]);

  // Empty state
  if (counts.total === 0) {
    return (
      <div className="flex h-full flex-col bg-background">
        <MissionControlStatusBar
          counts={counts}
          filter={filter}
          onFilterChange={setFilter}
        />
        <div className="flex flex-1 flex-col items-center justify-center text-foreground">
          <LayoutGrid className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-lg font-medium">Mission Control</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No active tasks across {projects.length} project
            {projects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <MissionControlStatusBar
        counts={counts}
        filter={filter}
        onFilterChange={setFilter}
      />

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {focusedMcTask ? (
              <MissionControlFocusedPane
                key="focused"
                mcTask={focusedMcTask}
                onDismiss={handleAfterAction}
                onSelectTask={onSelectTask}
              />
            ) : (
              <div
                key="grid"
                className="h-full gap-3 p-0"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
              >
                {tasks.map((mcTask) => (
                  <MissionControlPane
                    key={mcTask.task.id}
                    mcTask={mcTask}
                    tier={mcTask.status}
                    badge={mcTask.status === 'awaiting_input' ? mcTask.awaitingInputIndex ?? undefined : undefined}
                    onFocus={mcTask.status === 'awaiting_input' ? () => focusTask(mcTask.task.id) : undefined}
                    onSelectTask={onSelectTask}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  );
};

export default MissionControlView;
