import React from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import { LayoutGrid } from 'lucide-react';
import type { Project } from '../../types/app';
import type { Task } from '../../types/chat';
import { useMissionControlStore } from './useMissionControlStore';
import MissionControlStatusBar from './MissionControlStatusBar';
import MissionControlPane from './MissionControlPane';
import MissionControlFocusedPane from './MissionControlFocusedPane';
import { useMissionControlKeys } from './useMissionControlKeys';

interface MissionControlViewProps {
  projects: Project[];
  onSelectTask: (task: Task) => void;
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
    groupByProject,
    setGroupByProject,
  } = store;

  useMissionControlKeys({ tasks, focusedPane, focusTask, unfocus });

  const focusedMcTask =
    focusedPane ? tasks.find((t) => t.task.id === focusedPane.taskId) : null;

  const awaitingTasks = tasks.filter((t) => t.status === 'awaiting_input');
  const runningTasks = tasks.filter((t) => t.status === 'running');
  const idleTasks = tasks.filter((t) => t.status === 'idle');

  // Empty state
  if (counts.total === 0) {
    return (
      <div className="flex h-full flex-col bg-background">
        <MissionControlStatusBar
          counts={counts}
          filter={filter}
          onFilterChange={setFilter}
          groupByProject={groupByProject}
          onGroupByProjectChange={setGroupByProject}
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
        groupByProject={groupByProject}
        onGroupByProjectChange={setGroupByProject}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {focusedMcTask ? (
              <MissionControlFocusedPane
                key="focused"
                mcTask={focusedMcTask}
                onDismiss={unfocus}
                onSelectTask={onSelectTask}
              />
            ) : (
              <div key="grid" className="space-y-4">
                {/* Awaiting input section */}
                {awaitingTasks.length > 0 && (
                  <div>
                    {(runningTasks.length > 0 || idleTasks.length > 0) && (
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Needs Attention
                      </h3>
                    )}
                    <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                      {awaitingTasks.map((mcTask) => (
                        <MissionControlPane
                          key={mcTask.task.id}
                          mcTask={mcTask}
                          tier="awaiting_input"
                          badge={mcTask.awaitingInputIndex ?? undefined}
                          onFocus={() => focusTask(mcTask.task.id)}
                          onSelectTask={onSelectTask}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Running section */}
                {runningTasks.length > 0 && (
                  <div>
                    {(awaitingTasks.length > 0 || idleTasks.length > 0) && (
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Running
                      </h3>
                    )}
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {runningTasks.map((mcTask) => (
                        <MissionControlPane
                          key={mcTask.task.id}
                          mcTask={mcTask}
                          tier="running"
                          onSelectTask={onSelectTask}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Idle section */}
                {idleTasks.length > 0 && (
                  <div>
                    {(awaitingTasks.length > 0 || runningTasks.length > 0) && (
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Idle
                      </h3>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {idleTasks.map((mcTask) => (
                        <MissionControlPane
                          key={mcTask.task.id}
                          mcTask={mcTask}
                          tier="idle"
                          onSelectTask={onSelectTask}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  );
};

export default MissionControlView;
