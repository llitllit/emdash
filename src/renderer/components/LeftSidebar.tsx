import React, { useEffect, useCallback, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import ReorderList from './ReorderList';
import { Button } from './ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from './ui/sidebar';
import { formatShortcut, APP_SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  Home,
  Plus,
  FolderOpen,
  FolderClosed,
  FolderPlus,
  Github,
  Server,
  Puzzle,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import SidebarEmptyState from './SidebarEmptyState';
import { TaskItem } from './TaskItem';
import { RemoteProjectIndicator } from './ssh/RemoteProjectIndicator';
import { useRemoteProject } from '../hooks/useRemoteProject';
import { useProjectStatus, useTaskStatus, type ProjectStatus } from '../hooks/useTaskBusy';
import type { Project } from '../types/app';
import type { Task } from '../types/chat';
import type { ConnectionState } from './ssh';

interface LeftSidebarProps {
  projects: Project[];
  archivedTasksVersion?: number;
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onGoHome: () => void;
  onOpenProject?: () => void;
  onNewProject?: () => void;
  onCloneProject?: () => void;
  onAddRemoteProject?: () => void;
  onSelectTask?: (task: Task) => void;
  activeTask?: Task | null;
  onReorderProjects?: (sourceId: string, targetId: string) => void;
  onReorderProjectsFull?: (newOrder: Project[]) => void;
  onSidebarContextChange?: (state: {
    open: boolean;
    isMobile: boolean;
    setOpen: (next: boolean) => void;
  }) => void;
  onCreateTaskForProject?: (project: Project) => void;
  onDeleteTask?: (project: Project, task: Task) => void | Promise<void | boolean>;
  onRenameTask?: (project: Project, task: Task, newName: string) => void | Promise<void>;
  onArchiveTask?: (project: Project, task: Task) => void | Promise<void | boolean>;
  onRestoreTask?: (project: Project, task: Task) => void | Promise<void>;
  onDeleteProject?: (project: Project) => void | Promise<void>;
  pinnedTaskIds?: Set<string>;
  onPinTask?: (task: Task) => void;
  isHomeView?: boolean;
  onGoToSkills?: () => void;
  isSkillsView?: boolean;
  onCloseSettingsPage?: () => void;
}

interface MenuItemButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}

// Helper to determine if a project is remote
const isRemoteProject = (project: Project): boolean => {
  return Boolean((project as any).isRemote || (project as any).sshConnectionId);
};

// Get connection ID from project
const getConnectionId = (project: Project): string | null => {
  return (project as any).sshConnectionId || null;
};

// Wrapper component so the useRemoteProject hook can be called per-project
// (the ReorderList render callback is not a React component).
const RemoteIndicator: React.FC<{ project: Project }> = ({ project }) => {
  const remote = useRemoteProject(project);
  const connectionId = getConnectionId(project);
  if (!connectionId) return null;
  return (
    <RemoteProjectIndicator
      host={remote.host || undefined}
      connectionState={remote.connectionState as ConnectionState}
      size="md"
      onReconnect={remote.reconnect}
      disabled={remote.isLoading}
    />
  );
};

// Hook to get project status from task IDs
const useProjectStatusFromTasks = (tasks: Task[] | undefined): ProjectStatus => {
  const taskIds = React.useMemo(() => (tasks || []).map((t) => t.id), [tasks]);
  return useProjectStatus(taskIds);
};

// Hook to fetch archived tasks for a project
const useArchivedTasks = (projectId: string, version?: number) => {
  const [archivedTasks, setArchivedTasks] = React.useState<Task[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const result = await window.electronAPI.getArchivedTasks(projectId);
        if (!cancelled && Array.isArray(result)) {
          setArchivedTasks(result);
        }
      } catch {}
    };
    void fetch();
    return () => { cancelled = true; };
  }, [projectId, version]);

  return archivedTasks;
};

const MenuItemButton: React.FC<MenuItemButtonProps> = ({
  icon: Icon,
  label,
  ariaLabel,
  onClick,
}) => {
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={0}
      aria-label={ariaLabel}
      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted dark:text-muted-foreground dark:hover:bg-accent"
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
};

// Extracted project row component so hooks can be used per-project
interface ProjectRowProps {
  project: Project;
  isProjectActive: boolean;
  activeTask?: Task | null;
  selectedProject: Project | null;
  forceOpenIds: Set<string>;
  setForceOpenIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pinnedTaskIds?: Set<string>;
  onPinTask?: (task: Task) => void;
  onSelectProject: (project: Project) => void;
  onSelectTask?: (task: Task) => void;
  onCreateTaskForProject?: (project: Project) => void;
  onRenameTask?: (project: Project, task: Task, newName: string) => void | Promise<void>;
  onArchiveTask?: (project: Project, task: Task) => void | Promise<void | boolean>;
  onRestoreTask?: (project: Project, task: Task) => void | Promise<void>;
  handleNavigationWithCloseSettings: (callback: () => void) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivedTasksVersion?: number;
}

const ProjectRow: React.FC<ProjectRowProps> = ({
  project: typedProject,
  isProjectActive,
  activeTask,
  selectedProject,
  forceOpenIds,
  setForceOpenIds,
  pinnedTaskIds,
  onPinTask,
  onSelectProject,
  onSelectTask,
  onCreateTaskForProject,
  onRenameTask,
  onArchiveTask,
  onRestoreTask,
  handleNavigationWithCloseSettings,
  showArchived,
  onToggleArchived,
  archivedTasksVersion,
}) => {
  const projectIsRemote = isRemoteProject(typedProject);
  const projectStatus = useProjectStatusFromTasks(typedProject.tasks);
  const archivedTasks = useArchivedTasks(typedProject.id, archivedTasksVersion);

  const statusGradient =
    projectStatus === 'awaiting_input'
      ? 'bg-orange-500/[0.08]'
      : projectStatus === 'running'
        ? 'bg-sky-400/[0.10]'
        : '';

  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen
        open={forceOpenIds.has(typedProject.id) ? true : undefined}
        onOpenChange={() => {
          if (forceOpenIds.has(typedProject.id)) {
            setForceOpenIds((s) => {
              const next = new Set(s);
              next.delete(typedProject.id);
              return next;
            });
          }
        }}
        className="group/collapsible"
      >
        <div
          className={`group/project relative flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pl-1 pr-1 text-sm font-medium hover:bg-accent ${
            isProjectActive ? 'bg-black/[0.06] dark:bg-white/[0.08]' : ''
          } ${statusGradient}`}
          title={projectIsRemote ? 'Remote Project' : undefined}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex-shrink-0 rounded p-0.5 outline-none hover:bg-black/5 focus-visible:outline-none dark:hover:bg-white/5"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle tasks for ${typedProject.name}`}
            >
              <FolderOpen className="hidden h-4 w-4 text-foreground/60 group-data-[state=open]/collapsible:block" />
              <FolderClosed className="block h-4 w-4 text-foreground/60 group-data-[state=open]/collapsible:hidden" />
            </button>
          </CollapsibleTrigger>
          <motion.button
            type="button"
            className="min-w-0 flex-1 cursor-default truncate bg-transparent text-left text-foreground/60 outline-none focus-visible:outline-none"
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, ease: 'easeInOut' }}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigationWithCloseSettings(() =>
                onSelectProject(typedProject)
              );
            }}
          >
            {typedProject.name}
          </motion.button>
          {projectIsRemote && <RemoteIndicator project={typedProject} />}
          <div className="flex min-w-7 flex-shrink-0 items-center justify-end gap-0.5">
            {archivedTasks.length > 0 && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`flex-shrink-0 rounded p-0.5 text-muted-foreground outline-none hover:bg-black/5 focus-visible:outline-none dark:hover:bg-white/5 ${
                        showArchived ? 'opacity-100' : 'opacity-0 group-hover/project:opacity-100'
                      } transition-opacity`}
                      aria-label={showArchived ? 'Hide archived tasks' : 'Show archived tasks'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleArchived();
                      }}
                    >
                      {showArchived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4}>
                    {showArchived ? 'Hide archived' : `Archived (${archivedTasks.length})`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onCreateTaskForProject && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex-shrink-0 rounded p-0.5 text-muted-foreground outline-none hover:bg-black/5 focus-visible:outline-none dark:hover:bg-white/5"
                      aria-label={`New Task for ${typedProject.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigationWithCloseSettings(() => {
                          if (
                            onSelectProject &&
                            selectedProject?.id !== typedProject.id
                          ) {
                            onSelectProject(typedProject);
                          } else if (!selectedProject) {
                            onSelectProject?.(typedProject);
                          }
                          onCreateTaskForProject(typedProject);
                        });
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4}>
                    New Task
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <CollapsibleContent asChild>
          <div className="mt-1 min-w-0">
            <div className="flex min-w-0 flex-col gap-1">
              {typedProject.tasks
                ?.slice()
                .sort((a, b) => {
                  const aPinned = pinnedTaskIds?.has(a.id) ? 1 : 0;
                  const bPinned = pinnedTaskIds?.has(b.id) ? 1 : 0;
                  return bPinned - aPinned;
                })
                .map((task) => {
                  const isActive = activeTask?.id === task.id;
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isActive={isActive}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigationWithCloseSettings(() => {
                          if (
                            onSelectProject &&
                            selectedProject?.id !== typedProject.id
                          ) {
                            onSelectProject(typedProject);
                          }
                          onSelectTask && onSelectTask(task);
                        });
                      }}
                    >
                      <TaskItem
                        task={task}
                        showDelete={false}
                        showDirectBadge={false}
                        isPinned={pinnedTaskIds?.has(task.id)}
                        onPin={onPinTask ? () => onPinTask(task) : undefined}
                        onRename={
                          onRenameTask && !task.metadata?.multiAgent?.enabled
                            ? (newName) =>
                                onRenameTask(typedProject, task, newName)
                            : undefined
                        }
                        onArchive={
                          onArchiveTask
                            ? () => onArchiveTask(typedProject, task)
                            : undefined
                        }
                      />
                    </TaskRow>
                  );
                })}
            </div>
            {showArchived && archivedTasks.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 px-1 text-xs font-medium text-muted-foreground/50">
                  Archived ({archivedTasks.length})
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  {archivedTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.1, ease: 'easeInOut' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigationWithCloseSettings(() => {
                          if (
                            onSelectProject &&
                            selectedProject?.id !== typedProject.id
                          ) {
                            onSelectProject(typedProject);
                          }
                          onSelectTask && onSelectTask(task);
                        });
                      }}
                      className="group/task min-w-0 rounded-md py-1 pl-1 pr-2 opacity-50 hover:bg-accent hover:opacity-75"
                      title={task.name}
                    >
                      <TaskItem
                        task={task}
                        showDelete={false}
                        showDirectBadge={false}
                        onArchive={
                          onRestoreTask
                            ? () => onRestoreTask(typedProject, task)
                            : undefined
                        }
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
};

// Wrapper so task rows can call useTaskStatus (hooks can't be called inside .map())
const TaskRow: React.FC<{
  task: Task;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}> = ({ task, isActive, onClick, children }) => {
  const taskStatus = useTaskStatus(task.id);
  const taskGradient =
    taskStatus === 'awaiting_input'
      ? 'bg-orange-500/[0.08]'
      : taskStatus === 'running'
        ? 'bg-sky-400/[0.10]'
        : '';

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: 'easeInOut' }}
      onClick={onClick}
      className={`group/task min-w-0 rounded-md py-1.5 pl-1 pr-2 hover:bg-accent ${
        isActive ? 'bg-black/[0.06] dark:bg-white/[0.08]' : ''
      } ${taskGradient}`}
      title={task.name}
    >
      {children}
    </motion.div>
  );
};

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  projects,
  archivedTasksVersion,
  selectedProject,
  onSelectProject,
  onGoHome,
  onOpenProject,
  onNewProject,
  onCloneProject,
  onAddRemoteProject,
  onSelectTask,
  activeTask,
  onReorderProjects,
  onReorderProjectsFull,
  onSidebarContextChange,
  onCreateTaskForProject,
  onDeleteTask: _onDeleteTask,
  onRenameTask,
  onArchiveTask,
  onRestoreTask: _onRestoreTask,
  onDeleteProject: _onDeleteProject,
  pinnedTaskIds,
  onPinTask,
  isHomeView,
  onGoToSkills,
  isSkillsView,
  onCloseSettingsPage,
}) => {
  const { open, isMobile, setOpen } = useSidebar();

  // Track projects that should be force-expanded (e.g. when first task is created)
  const [forceOpenIds, setForceOpenIds] = useState<Set<string>>(new Set());
  const prevTaskCountsRef = useRef<Map<string, number>>(new Map());

  // Per-project archive section visibility
  const [showArchivedMap, setShowArchivedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const prev = prevTaskCountsRef.current;
    for (const project of projects) {
      const taskCount = project.tasks?.length ?? 0;
      const prevCount = prev.get(project.id) ?? 0;
      if (prevCount === 0 && taskCount > 0) {
        setForceOpenIds((s) => new Set(s).add(project.id));
      }
      prev.set(project.id, taskCount);
    }
  }, [projects]);

  useEffect(() => {
    onSidebarContextChange?.({ open, isMobile, setOpen });
  }, [open, isMobile, setOpen, onSidebarContextChange]);

  // Helper to close settings page when navigating
  const handleNavigationWithCloseSettings = useCallback(
    (callback: () => void) => {
      onCloseSettingsPage?.();
      callback();
    },
    [onCloseSettingsPage]
  );

  return (
    <div className="relative h-full">
      <Sidebar className="!w-full lg:border-r-0">
        <SidebarHeader className="border-b-0 px-3 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={`min-w-0 ${isHomeView ? 'bg-black/[0.06] dark:bg-white/[0.08]' : ''}`}
              >
                <Button
                  variant="ghost"
                  onClick={() => handleNavigationWithCloseSettings(onGoHome)}
                  aria-label="Home"
                  className="w-full justify-start"
                >
                  <Home className="h-5 w-5 text-muted-foreground sm:h-4 sm:w-4" />
                  <span className="hidden text-sm font-medium sm:inline">Home</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {onGoToSkills && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={`min-w-0 ${isSkillsView ? 'bg-black/[0.06] dark:bg-white/[0.08]' : ''}`}
                >
                  <Button
                    variant="ghost"
                    onClick={() => handleNavigationWithCloseSettings(onGoToSkills)}
                    aria-label="Skills"
                    className="w-full justify-start"
                  >
                    <Puzzle className="h-5 w-5 text-muted-foreground sm:h-4 sm:w-4" />
                    <span className="hidden text-sm font-medium sm:inline">Skills</span>
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="flex flex-col">
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between pr-0">
              <span className="cursor-default select-none text-sm font-medium normal-case tracking-normal text-foreground/30">
                Projects
              </span>
              {onOpenProject && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-foreground/30"
                      aria-label="Add project"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start" sideOffset={4}>
                    <div className="space-y-1">
                      <MenuItemButton
                        icon={FolderOpen}
                        label="Open Folder"
                        ariaLabel="Open Folder"
                        onClick={() => onOpenProject?.()}
                      />
                      <MenuItemButton
                        icon={Plus}
                        label="Create New"
                        ariaLabel="Create New Project"
                        onClick={() => onNewProject?.()}
                      />
                      <MenuItemButton
                        icon={Github}
                        label="Clone from GitHub"
                        ariaLabel="Clone from GitHub"
                        onClick={() => onCloneProject?.()}
                      />
                      {onAddRemoteProject && (
                        <MenuItemButton
                          icon={Server}
                          label="Add Remote Project"
                          ariaLabel="Add Remote Project"
                          onClick={() => onAddRemoteProject?.()}
                        />
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <ReorderList
                  as="div"
                  axis="y"
                  items={projects}
                  onReorder={(newOrder) => {
                    if (onReorderProjectsFull) {
                      onReorderProjectsFull(newOrder as Project[]);
                    } else if (onReorderProjects) {
                      const oldIds = projects.map((p) => p.id);
                      const newIds = (newOrder as Project[]).map((p) => p.id);
                      for (let i = 0; i < newIds.length; i++) {
                        if (newIds[i] !== oldIds[i]) {
                          const sourceId = newIds.find((id) => id === oldIds[i]);
                          const targetId = newIds[i];
                          if (sourceId && targetId && sourceId !== targetId) {
                            onReorderProjects(sourceId, targetId);
                          }
                          break;
                        }
                      }
                    }
                  }}
                  className="m-0 flex min-w-0 list-none flex-col gap-1 p-0"
                  itemClassName="relative group cursor-pointer rounded-md list-none min-w-0"
                  getKey={(p) => (p as Project).id}
                >
                  {(project) => (
                    <ProjectRow
                      project={project as Project}
                      isProjectActive={selectedProject?.id === (project as Project).id && !activeTask}
                      activeTask={activeTask}
                      selectedProject={selectedProject}
                      forceOpenIds={forceOpenIds}
                      setForceOpenIds={setForceOpenIds}
                      pinnedTaskIds={pinnedTaskIds}
                      onPinTask={onPinTask}
                      onSelectProject={onSelectProject}
                      onSelectTask={onSelectTask}
                      onCreateTaskForProject={onCreateTaskForProject}
                      onRenameTask={onRenameTask}
                      onArchiveTask={onArchiveTask}
                      onRestoreTask={_onRestoreTask}
                      handleNavigationWithCloseSettings={handleNavigationWithCloseSettings}
                      showArchived={showArchivedMap[(project as Project).id] ?? false}
                      archivedTasksVersion={archivedTasksVersion}
                      onToggleArchived={() =>
                        setShowArchivedMap((prev) => ({
                          ...prev,
                          [(project as Project).id]: !prev[(project as Project).id],
                        }))
                      }
                    />
                  )}
                </ReorderList>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {projects.length === 0 && (
            <div className="mt-auto">
              <SidebarEmptyState
                title="Put your agents to work"
                description="Create a task and run one or more agents on it in parallel."
                actionLabel={onOpenProject ? 'Open Folder' : undefined}
                onAction={onOpenProject}
                secondaryActionLabel={onNewProject ? 'New Project' : undefined}
                onSecondaryAction={onNewProject}
              />
            </div>
          )}
        </SidebarContent>
        {projects.length > 0 && (
          <SidebarFooter className="px-3 py-2">
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground/60">
              <div className="flex items-center justify-between">
                <span>Next/prev task</span>
                <span className="font-mono">{formatShortcut(APP_SHORTCUTS.NEXT_TASK)} / {formatShortcut(APP_SHORTCUTS.PREV_TASK)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                  Active tasks
                </span>
                <span className="font-mono">{formatShortcut(APP_SHORTCUTS.NEXT_ACTIVE_TASK)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                  Needs input
                </span>
                <span className="font-mono">{formatShortcut(APP_SHORTCUTS.NEXT_NEEDS_INPUT)}</span>
              </div>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>
    </div>
  );
};

export default LeftSidebar;
