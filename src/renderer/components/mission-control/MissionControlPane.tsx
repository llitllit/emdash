import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { MissionControlTask } from './types';
import type { Task } from '../../types/chat';
import { usePtyTailBuffer } from './usePtyTailBuffer';
import { useTaskAction } from '../../hooks/useTaskBusy';
import { useTerminalSnapshot } from './useTerminalSnapshot';
import { RelativeTime } from '../ui/relative-time';

interface MissionControlPaneProps {
  mcTask: MissionControlTask;
  tier: 'awaiting_input' | 'running' | 'idle';
  badge?: number;
  onFocus?: () => void;
  onSelectTask: (task: Task) => void;
}

/**
 * Dark terminal output block used as the primary fill area in all tile tiers.
 */
const TerminalOutputBlock: React.FC<{ lines: string[] }> = ({ lines }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto rounded-md bg-[#1a1a2e] p-2"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="truncate font-mono text-[11px] leading-relaxed text-[#a0a0b8]"
        >
          {line}
        </div>
      ))}
    </div>
  );
};

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

  const { lines: snapshotLines, loading: snapshotLoading } = useTerminalSnapshot(
    task.id,
    tier === 'idle'
  );

  if (tier === 'idle') {
    return (
      <motion.div
        layout
        layoutId={`mc-pane-${task.id}`}
        onClick={() => onSelectTask(task)}
        className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
      >
        {/* Row 1: dot + task name */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground/30" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.name}</span>
        </div>

        {/* Row 2: project + relative time */}
        <div className="ml-4 mt-0.5 flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground/60">
          <span className="truncate">{project.name}</span>
          {task.updatedAt && (
            <>
              <span>&middot;</span>
              <RelativeTime value={task.updatedAt} className="flex-shrink-0" />
            </>
          )}
        </div>

        {/* Terminal snapshot body */}
        {snapshotLoading ? (
          <div className="mt-2 min-h-0 flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted-foreground/10" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted-foreground/10" />
          </div>
        ) : snapshotLines.length > 0 ? (
          <div className="mt-2 min-h-0 flex-1">
            <TerminalOutputBlock lines={snapshotLines} />
          </div>
        ) : initialPrompt ? (
          <p className="mt-2 line-clamp-3 text-xs text-muted-foreground/80">
            {initialPrompt}
          </p>
        ) : (
          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
            <span className="text-xs text-muted-foreground/40">No terminal output</span>
          </div>
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
        className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-sky-400/20 bg-sky-400/[0.04] p-3 ring-1 ring-sky-400/30 transition-colors hover:bg-sky-400/[0.08]"
        style={{ boxShadow: '0 0 12px rgba(56,189,248,0.1)' }}
      >
        <div className="flex flex-shrink-0 items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {task.name}
          </span>
          <span className="flex-shrink-0 text-xs text-muted-foreground">
            {project.name}
          </span>
        </div>
        {actionText && (
          <div className="mt-1.5 flex-shrink-0 truncate text-xs text-sky-300/80">
            {actionText}
          </div>
        )}
        {tailLines.length > 0 ? (
          <div className="mt-2 min-h-0 flex-1">
            <TerminalOutputBlock lines={tailLines} />
          </div>
        ) : (
          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center rounded-md bg-[#1a1a2e]">
            <span className="text-xs text-[#a0a0b8]/40">Waiting for output...</span>
          </div>
        )}
      </motion.div>
    );
  }

  // Tier 1: awaiting_input
  return (
    <motion.div
      layout
      layoutId={`mc-pane-${task.id}`}
      onClick={onFocus}
      className="relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-4 ring-1 ring-orange-500/30 transition-colors hover:bg-orange-500/[0.08]"
      style={{ boxShadow: '0 0 12px rgba(249,115,22,0.12)' }}
    >
      {/* Number badge */}
      {badge != null && badge <= 9 && (
        <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-sm">
          {badge}
        </span>
      )}

      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-2">
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
        <div className="mt-1.5 flex-shrink-0 truncate text-xs text-orange-400/80">
          {actionText}
        </div>
      )}

      {/* Terminal output */}
      {tailLines.length > 0 ? (
        <div className="mt-2 min-h-0 flex-1">
          <TerminalOutputBlock lines={tailLines} />
        </div>
      ) : initialPrompt ? (
        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
          {initialPrompt}
        </p>
      ) : (
        <div className="mt-2 flex min-h-0 flex-1 items-center justify-center rounded-md bg-[#1a1a2e]">
          <span className="text-xs text-[#a0a0b8]/40">Waiting for output...</span>
        </div>
      )}

      {/* Awaiting input footer */}
      <div className="mt-2 flex flex-shrink-0 items-center gap-2">
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
