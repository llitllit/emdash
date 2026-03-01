import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { MissionControlTask } from './types';
import type { Task } from '../../types/chat';
import { usePtyTailBuffer } from './usePtyTailBuffer';
import { useTaskAction } from '../../hooks/useTaskBusy';
import { useTaskSummary } from '../../hooks/useTaskSummary';
import { RelativeTime } from '../ui/relative-time';

interface MissionControlPaneProps {
  mcTask: MissionControlTask;
  tier: 'awaiting_input' | 'running' | 'idle';
  badge?: number;
  onFocus?: () => void;
  onSelectTask: (task: Task) => void;
}

const MissionControlPane: React.FC<MissionControlPaneProps> = ({
  mcTask,
  tier,
  badge,
  onFocus,
  onSelectTask,
}) => {
  const { task, project } = mcTask;
  const tailLines = usePtyTailBuffer(task.id);
  const actionText = useTaskAction(task.id);
  const initialPrompt = (task.metadata as any)?.initialPrompt as string | null;

  const { lastAgentMessage, loading: summaryLoading } = useTaskSummary(task.id, tier === 'idle');

  if (tier === 'idle') {
    return (
      <motion.div
        layout
        layoutId={`mc-pane-${task.id}`}
        onClick={() => onSelectTask(task)}
        className="cursor-pointer rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground/30" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.name}</span>
          <span className="flex-shrink-0 text-xs text-muted-foreground">{project.name}</span>
          {task.updatedAt && (
            <RelativeTime
              value={task.updatedAt}
              className="flex-shrink-0 text-xs text-muted-foreground/60"
            />
          )}
        </div>

        {/* Initial prompt */}
        {initialPrompt && (
          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground/80">{initialPrompt}</p>
        )}

        {/* Last agent message */}
        {summaryLoading ? (
          <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
        ) : (
          lastAgentMessage && (
            <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground/60">
              {lastAgentMessage}
            </p>
          )
        )}
      </motion.div>
    );
  }

  if (tier === 'running') {
    return (
      <motion.div
        layout
        layoutId={`mc-pane-${task.id}`}
        onClick={() => onSelectTask(task)}
        className="cursor-pointer rounded-lg border border-sky-400/20 bg-sky-400/[0.04] p-3 ring-1 ring-sky-400/30 transition-colors hover:bg-sky-400/[0.08]"
        style={{ boxShadow: '0 0 12px rgba(56,189,248,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {task.name}
          </span>
          <span className="flex-shrink-0 text-xs text-muted-foreground">
            {project.name}
          </span>
        </div>
        {actionText && (
          <div className="mt-1.5 truncate text-xs text-sky-300/80">
            {actionText}
          </div>
        )}
        {tailLines.length > 0 && (
          <div className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
            {tailLines[tailLines.length - 1]}
          </div>
        )}
      </motion.div>
    );
  }

  // Tier 1: awaiting_input (large)
  return (
    <motion.div
      layout
      layoutId={`mc-pane-${task.id}`}
      onClick={onFocus}
      className="relative cursor-pointer rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-4 ring-1 ring-orange-500/30 transition-colors hover:bg-orange-500/[0.08]"
      style={{ boxShadow: '0 0 12px rgba(249,115,22,0.12)' }}
    >
      {/* Number badge */}
      {badge != null && badge <= 9 && (
        <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-sm">
          {badge}
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-orange-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {task.name}
        </span>
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          {project.name}
        </span>
      </div>

      {/* Action text */}
      {actionText && (
        <div className="mt-1.5 truncate text-xs text-orange-400/80">
          {actionText}
        </div>
      )}

      {/* Original prompt */}
      {!actionText && initialPrompt && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {initialPrompt}
        </p>
      )}

      {/* Terminal tail */}
      {tailLines.length > 0 && (
        <div className="mt-2 max-h-32 overflow-hidden rounded-md bg-black/[0.03] p-2 dark:bg-white/[0.03]">
          {tailLines.slice(-5).map((line, i) => (
            <div
              key={i}
              className="truncate font-mono text-[11px] leading-relaxed text-muted-foreground"
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Awaiting input indicator */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
          Awaiting input
        </span>
        {badge != null && (
          <span className="text-xs text-muted-foreground">
            Press {badge} to focus
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MissionControlPane;
