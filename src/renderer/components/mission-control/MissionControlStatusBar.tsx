import React from 'react';
import { LayoutGrid } from 'lucide-react';
import type { MissionControlFilter, MissionControlStatusCounts } from './types';

interface MissionControlStatusBarProps {
  counts: MissionControlStatusCounts;
  filter: MissionControlFilter;
  onFilterChange: (filter: MissionControlFilter) => void;
}

const FILTERS: { key: MissionControlFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_input', label: 'Awaiting Input' },
  { key: 'running', label: 'Active' },
  { key: 'idle', label: 'Idle' },
];

const MissionControlStatusBar: React.FC<MissionControlStatusBarProps> = ({
  counts,
  filter,
  onFilterChange,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-3">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {counts.running > 0 && (
            <>
              <span className="font-medium text-sky-500">{counts.running}</span>
              {' active'}
            </>
          )}
          {counts.running > 0 && counts.awaitingInput > 0 && ', '}
          {counts.awaitingInput > 0 && (
            <>
              <span className="font-medium text-orange-500">
                {counts.awaitingInput}
              </span>
              {' awaiting input'}
            </>
          )}
          {(counts.running > 0 || counts.awaitingInput > 0) && counts.idle > 0 && ', '}
          {counts.idle > 0 && (
            <>
              <span className="font-medium">{counts.idle}</span>
              {' idle'}
            </>
          )}
          {counts.total === 0 && 'No tasks'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Filter toggles */}
        <div className="flex items-center rounded-md border border-border">
          {FILTERS.map(({ key, label }) => {
            const count =
              key === 'all'
                ? counts.total
                : key === 'awaiting_input'
                  ? counts.awaitingInput
                  : key === 'running'
                    ? counts.running
                    : counts.idle;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                  filter === key
                    ? 'bg-black/[0.06] text-foreground dark:bg-white/[0.08]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1 text-[10px] opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MissionControlStatusBar;
