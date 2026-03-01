import React from 'react';
import { motion } from 'motion/react';
import { PROVIDER_IDS } from '@shared/providers/registry';
import { makePtyId } from '@shared/ptyId';
import type { MissionControlTask } from './types';
import type { Task } from '../../types/chat';
import TileTerminal from './TileTerminal';
import { Button } from '../ui/button';

interface MissionControlFocusedPaneProps {
  mcTask: MissionControlTask;
  onDismiss: () => void;
  onSelectTask: (task: Task) => void;
}

const MissionControlFocusedPane: React.FC<MissionControlFocusedPaneProps> = ({
  mcTask,
  onDismiss,
  onSelectTask,
}) => {
  const { task, project } = mcTask;
  const initialPrompt = (task.metadata as any)?.initialPrompt as string | null;

  const handleApprove = () => {
    sendPtyInput(task, 'y\n');
    onDismiss();
  };

  const handleDeny = () => {
    sendPtyInput(task, 'n\n');
    onDismiss();
  };

  return (
    <motion.div
      layout
      layoutId={`mc-pane-${task.id}`}
      className="flex w-full flex-1 flex-col rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-6 ring-1 ring-orange-500/30"
      style={{ boxShadow: '0 0 20px rgba(249,115,22,0.15)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-orange-500" />
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {task.name}
        </h2>
        <span className="flex-shrink-0 text-sm text-muted-foreground">
          {project.name}
        </span>
      </div>

      {/* Original prompt */}
      {initialPrompt && (
        <div className="mt-3 max-h-24 overflow-y-auto rounded-md bg-black/[0.03] p-3 dark:bg-white/[0.03]">
          <p className="text-sm text-muted-foreground">{initialPrompt}</p>
        </div>
      )}

      {/* Terminal */}
      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-md">
        <TileTerminal taskId={task.id} agentId={task.agentId} />
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={handleApprove}
          className="bg-orange-500 text-white hover:bg-orange-600"
        >
          Approve
          <kbd className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">
            Enter
          </kbd>
        </Button>
        <Button variant="outline" onClick={handleDeny}>
          Deny
          <kbd className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/10">
            N
          </kbd>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectTask(task)}
          className="text-xs text-muted-foreground"
        >
          Open full view
        </Button>
        <span className="text-xs text-muted-foreground">
          <kbd className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/10">
            Esc
          </kbd>{' '}
          to go back
        </span>
      </div>
    </motion.div>
  );
};

/**
 * Send input to a task's PTY to approve/deny.
 * Broadcasts to all known providers since we may not know which is active.
 */
function sendPtyInput(task: Task, data: string) {
  const api = window.electronAPI;
  if (!api?.ptyInput) return;

  for (const prov of PROVIDER_IDS) {
    const ptyId = makePtyId(prov, 'main', task.id);
    try {
      api.ptyInput({ id: ptyId, data });
    } catch {}
  }
}

export default MissionControlFocusedPane;
