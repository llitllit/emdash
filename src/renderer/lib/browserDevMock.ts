/**
 * Browser Dev Mock — injects a stub window.electronAPI when running in a
 * regular browser (i.e. NOT inside Electron). This lets us load the renderer
 * at localhost:3000 for visual inspection / Chrome DevTools MCP without
 * Electron crashing on `undefined`.
 *
 * Detection: only activates when window.electronAPI is missing.
 */

if (typeof window !== 'undefined' && !window.electronAPI) {
  console.info('[browserDevMock] Electron not detected — injecting mock electronAPI');

  // ---------------------------------------------------------------------------
  // Mock data
  // ---------------------------------------------------------------------------

  const now = new Date().toISOString();

  const MOCK_PROJECTS = [
    {
      id: 'proj-1',
      name: 'Demo App',
      path: '/Users/dev/demo-app',
      gitInfo: { isGitRepo: true, remote: 'origin', branch: 'main', baseRef: 'main' },
      githubInfo: { repository: 'user/demo-app', connected: true },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'proj-2',
      name: 'API Server',
      path: '/Users/dev/api-server',
      gitInfo: { isGitRepo: true, remote: 'origin', branch: 'main', baseRef: 'main' },
      createdAt: now,
      updatedAt: now,
    },
  ];

  const MOCK_TASKS = [
    // Project 1 — Demo App
    {
      id: 'task-1',
      projectId: 'proj-1',
      name: 'Add login page',
      branch: 'feat/login',
      path: '/Users/dev/demo-app/.worktrees/add-login-page',
      status: 'idle' as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-2',
      projectId: 'proj-1',
      name: 'Fix nav styling',
      branch: 'fix/nav-styling',
      path: '/Users/dev/demo-app/.worktrees/fix-nav-styling',
      status: 'running' as const,
      agentId: 'claude',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-3',
      projectId: 'proj-1',
      name: 'Refactor auth module',
      branch: 'refactor/auth',
      path: '/Users/dev/demo-app/.worktrees/refactor-auth',
      status: 'active' as const,
      agentId: 'claude',
      createdAt: now,
      updatedAt: now,
    },
    // Project 2 — API Server
    {
      id: 'task-4',
      projectId: 'proj-2',
      name: 'Setup database',
      branch: 'feat/database',
      path: '/Users/dev/api-server/.worktrees/setup-database',
      status: 'idle' as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-5',
      projectId: 'proj-2',
      name: 'Add REST endpoints',
      branch: 'feat/endpoints',
      path: '/Users/dev/api-server/.worktrees/add-rest-endpoints',
      status: 'idle' as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-6',
      projectId: 'proj-2',
      name: 'Review PR changes',
      branch: 'feat/review',
      path: '/Users/dev/api-server/.worktrees/review-pr-changes',
      status: 'active' as const,
      agentId: 'claude',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const MOCK_ARCHIVED_TASKS = [
    {
      id: 'task-archived-1',
      projectId: 'proj-2',
      name: 'Initial scaffold',
      branch: 'feat/scaffold',
      path: '/Users/dev/api-server/.worktrees/initial-scaffold',
      status: 'idle' as const,
      archivedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const noop = () => {};
  const noopUnsub = () => noop;
  const ok = () => Promise.resolve({ success: true });
  const okBool = () => Promise.resolve({ ok: true });

  // ---------------------------------------------------------------------------
  // Build the mock — uses a Proxy so any un-stubbed method returns a safe
  // default rather than blowing up the app.
  // ---------------------------------------------------------------------------

  const explicitMethods: Record<string, Function> = {
    // -- App info --
    getAppVersion: () => Promise.resolve('0.0.0-dev-mock'),
    getElectronVersion: () => Promise.resolve('0.0.0'),
    getPlatform: () => Promise.resolve('darwin'),
    listInstalledFonts: () => Promise.resolve({ success: true, fonts: ['SF Mono', 'Menlo'], cached: true }),
    undo: ok,
    redo: ok,

    // -- Updater --
    checkForUpdates: ok,
    downloadUpdate: ok,
    quitAndInstallUpdate: ok,
    openLatestDownload: ok,
    onUpdateEvent: noopUnsub,
    getUpdateState: () => Promise.resolve({ success: true, data: null }),
    getUpdateSettings: () => Promise.resolve({ success: true, data: {} }),
    updateUpdateSettings: ok,
    getReleaseNotes: () => Promise.resolve({ success: true, data: null }),
    checkForUpdatesNow: ok,

    // -- Menu events --
    onMenuOpenSettings: noopUnsub,
    onMenuCheckForUpdates: noopUnsub,
    onMenuUndo: noopUnsub,
    onMenuRedo: noopUnsub,

    // -- Settings --
    getSettings: () =>
      Promise.resolve({
        success: true,
        settings: {
          repository: { branchPrefix: '', pushOnCreate: false },
          defaultProvider: 'claude',
          tasks: { autoGenerateName: true, autoApproveByDefault: false },
          interface: { theme: 'dark' as const },
          terminal: { fontFamily: 'SF Mono' },
        },
      }),
    updateSettings: (_s: any) =>
      Promise.resolve({ success: true, settings: { repository: { branchPrefix: '', pushOnCreate: false } } }),

    // -- PTY --
    ptyStart: okBool,
    ptyStartDirect: okBool,
    ptyScpToRemote: ok,
    ptyInput: noop,
    ptyResize: noop,
    ptyKill: noop,
    onPtyData: (id: string, listener: (data: string) => void) => {
      // Simulate activity for mock tasks so status gradients appear
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (id.includes('task-2')) {
        // task-2 is "running" — emit busy signal (Claude pattern)
        timer = setTimeout(() => listener('⏳ Thinking... (esc to interrupt)\r\n'), 600);
      } else if (id.includes('task-3')) {
        // task-3 is "active" — emit awaiting_input signal
        timer = setTimeout(() => listener('Do you want to proceed? [y/n]\r\n'), 900);
      } else if (id.includes('task-6')) {
        // task-6 is "active" — emit awaiting_input signal (orange gradient)
        timer = setTimeout(() => listener('Allow this edit? [y/n]\r\n'), 1200);
      }
      return () => { if (timer) clearTimeout(timer); };
    },
    ptyGetSnapshot: () => Promise.resolve({ ok: true, snapshot: null }),
    ptySaveSnapshot: okBool,
    ptyClearSnapshot: okBool,
    onPtyExit: noopUnsub,
    onPtyStarted: noopUnsub,
    terminalGetTheme: () =>
      Promise.resolve({
        ok: true,
        config: {
          terminal: 'xterm-256color',
          theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
        },
      }),

    // -- Worktree --
    worktreeCreate: ok,
    worktreeList: () => Promise.resolve({ success: true, worktrees: [] }),
    worktreeRemove: ok,
    worktreeStatus: () => Promise.resolve({ success: true, status: null }),
    worktreeMerge: ok,
    worktreeGet: () => Promise.resolve({ success: true, worktree: null }),
    worktreeGetAll: () => Promise.resolve({ success: true, worktrees: [] }),
    worktreeEnsureReserve: ok,
    worktreeHasReserve: () => Promise.resolve({ success: true, hasReserve: false }),
    worktreeClaimReserve: ok,
    worktreeClaimReserveAndSaveTask: ok,
    worktreeRemoveReserve: ok,

    // -- Lifecycle --
    lifecycleGetScript: () => Promise.resolve({ success: true, script: null }),
    lifecycleSetup: () => Promise.resolve({ success: true, skipped: true }),
    lifecycleRunStart: () => Promise.resolve({ success: true, skipped: true }),
    lifecycleRunStop: () => Promise.resolve({ success: true, skipped: true }),
    lifecycleTeardown: () => Promise.resolve({ success: true, skipped: true }),
    lifecycleGetState: () =>
      Promise.resolve({
        success: true,
        state: {
          taskId: '',
          setup: { status: 'idle' as const },
          run: { status: 'idle' as const },
          teardown: { status: 'idle' as const },
        },
      }),
    lifecycleClearTask: ok,
    onLifecycleEvent: noopUnsub,

    // -- Project management --
    openProject: () => Promise.resolve({ success: false, error: 'Mock: cannot open project' }),
    getProjectSettings: (_id: string) =>
      Promise.resolve({
        success: true,
        settings: { projectId: _id, name: 'Mock', path: '/tmp/mock', baseRef: 'main' },
      }),
    updateProjectSettings: ok,
    getGitInfo: () =>
      Promise.resolve({ isGitRepo: true, remote: 'origin', branch: 'main', baseRef: 'main' }),
    getGitStatus: () => Promise.resolve({ success: true, changes: [] }),
    watchGitStatus: () => Promise.resolve({ success: true, watchId: 'mock-watch' }),
    unwatchGitStatus: ok,
    onGitStatusChanged: noopUnsub,
    getFileDiff: () => Promise.resolve({ success: true, diff: { lines: [] } }),
    stageFile: ok,
    stageAllFiles: ok,
    unstageFile: ok,
    revertFile: ok,
    gitCommitAndPush: ok,
    generatePrContent: () =>
      Promise.resolve({ success: true, title: 'Mock PR', description: 'Mock description' }),
    createPullRequest: ok,
    mergeToMain: ok,
    mergePr: ok,
    getPrStatus: () => Promise.resolve({ success: true, pr: null }),
    getCheckRuns: () => Promise.resolve({ success: true, checks: [] }),
    getPrComments: () => Promise.resolve({ success: true, comments: [], reviews: [] }),
    getBranchStatus: () =>
      Promise.resolve({ success: true, branch: 'main', defaultBranch: 'main', ahead: 0, behind: 0 }),
    renameBranch: ok,
    listRemoteBranches: () => Promise.resolve({ success: true, branches: [] }),

    // -- External / clipboard --
    openExternal: ok,
    clipboardWriteText: ok,
    paste: ok,
    openIn: ok,
    checkInstalledApps: () => Promise.resolve({}),
    connectToGitHub: () =>
      Promise.resolve({ success: false, error: 'Mock: GitHub not available' }),

    // -- Telemetry --
    captureTelemetry: () => Promise.resolve({ success: true, disabled: true }),
    getTelemetryStatus: () =>
      Promise.resolve({
        success: true,
        status: {
          enabled: false,
          envDisabled: true,
          userOptOut: false,
          hasKeyAndHost: false,
          onboardingSeen: true,
        },
      }),
    setTelemetryEnabled: () =>
      Promise.resolve({
        success: true,
        status: { enabled: false, envDisabled: true, userOptOut: false, hasKeyAndHost: false },
      }),
    setOnboardingSeen: () =>
      Promise.resolve({
        success: true,
        status: { enabled: false, envDisabled: true, userOptOut: false, hasKeyAndHost: false },
      }),

    // -- Filesystem --
    fsList: () => Promise.resolve({ success: true, items: [] }),
    fsRead: () => Promise.resolve({ success: true, content: '', size: 0 }),
    fsReadImage: () => Promise.resolve({ success: false, error: 'Mock: not available' }),
    fsSearchContent: () => Promise.resolve({ success: true, results: [] }),
    fsWriteFile: ok,
    fsRemove: ok,
    getProjectConfig: () => Promise.resolve({ success: true, content: '' }),
    saveProjectConfig: ok,
    saveAttachment: ok,

    // -- GitHub --
    githubAuth: () => Promise.resolve({ success: false, error: 'Mock: not available' }),
    githubCancelAuth: ok,
    onGithubAuthDeviceCode: noopUnsub,
    onGithubAuthPolling: noopUnsub,
    onGithubAuthSlowDown: noopUnsub,
    onGithubAuthSuccess: noopUnsub,
    onGithubAuthError: noopUnsub,
    onGithubAuthCancelled: noopUnsub,
    onGithubAuthUserUpdated: noopUnsub,
    githubIsAuthenticated: () => Promise.resolve(false),
    githubGetStatus: () => Promise.resolve({ installed: false, authenticated: false }),
    githubGetUser: () => Promise.resolve(null),
    githubGetRepositories: () => Promise.resolve([]),
    githubCloneRepository: ok,
    githubGetOwners: () => Promise.resolve({ success: true, owners: [] }),
    githubValidateRepoName: () => Promise.resolve({ success: true, valid: true, exists: false }),
    githubCreateNewProject: ok,
    githubCheckCLIInstalled: () => Promise.resolve(false),
    githubInstallCLI: ok,
    githubListPullRequests: () => Promise.resolve({ success: true, prs: [] }),
    githubCreatePullRequestWorktree: ok,
    githubLogout: () => Promise.resolve(),
    githubIssuesList: () => Promise.resolve({ success: true, issues: [] }),
    githubIssuesSearch: () => Promise.resolve({ success: true, issues: [] }),
    githubIssueGet: () => Promise.resolve({ success: true, issue: null }),

    // -- Linear --
    linearCheckConnection: () => Promise.resolve({ connected: false }),
    linearSaveToken: ok,
    linearClearToken: ok,
    linearInitialFetch: () => Promise.resolve({ success: true, issues: [] }),
    linearSearchIssues: () => Promise.resolve({ success: true, issues: [] }),

    // -- Jira --
    jiraSaveCredentials: ok,
    jiraClearCredentials: ok,
    jiraCheckConnection: () => Promise.resolve({ connected: false }),
    jiraInitialFetch: () => Promise.resolve({ success: true, issues: [] }),
    jiraSearchIssues: () => Promise.resolve({ success: true, issues: [] }),

    // -- Provider statuses --
    getProviderStatuses: () => Promise.resolve({ success: true, statuses: {} }),
    onProviderStatusUpdated: noopUnsub,
    getProviderCustomConfig: () => Promise.resolve({ success: true, config: {} }),
    getAllProviderCustomConfigs: () => Promise.resolve({ success: true, configs: {} }),
    updateProviderCustomConfig: ok,

    // -- Database --
    getProjects: () => Promise.resolve(MOCK_PROJECTS),
    saveProject: ok,
    getTasks: (projectId?: string) => {
      const tasks = projectId
        ? MOCK_TASKS.filter((t) => t.projectId === projectId)
        : MOCK_TASKS;
      return Promise.resolve(tasks);
    },
    saveTask: ok,
    deleteProject: ok,
    deleteTask: ok,
    archiveTask: ok,
    restoreTask: ok,
    getArchivedTasks: (projectId?: string) => {
      const tasks = projectId
        ? MOCK_ARCHIVED_TASKS.filter((t) => t.projectId === projectId)
        : MOCK_ARCHIVED_TASKS;
      return Promise.resolve(tasks);
    },

    // -- Conversations --
    saveConversation: ok,
    getConversations: () => Promise.resolve({ success: true, conversations: [] }),
    deleteConversation: ok,
    cleanupSessionDirectory: () => Promise.resolve({ success: true }),
    saveMessage: ok,
    getMessages: () => Promise.resolve({ success: true, messages: [] }),
    getOrCreateDefaultConversation: (taskId: string) =>
      Promise.resolve({
        success: true,
        conversation: { id: `conv-${taskId}`, taskId, title: 'Main', isMain: true, isActive: true, createdAt: now, updatedAt: now },
      }),
    createConversation: () => Promise.resolve({ success: true, conversation: null }),
    setActiveConversation: ok,
    getActiveConversation: () => Promise.resolve({ success: true, conversation: null }),
    reorderConversations: ok,
    updateConversationTitle: ok,

    // -- Debug --
    debugAppendLog: ok,

    // -- Line comments --
    lineCommentsGet: () => Promise.resolve({ success: true, comments: [] }),
    lineCommentsCreate: () => Promise.resolve({ success: true, id: 'mock-comment' }),
    lineCommentsUpdate: ok,
    lineCommentsDelete: ok,
    lineCommentsGetFormatted: () => Promise.resolve({ success: true, formatted: '' }),
    lineCommentsMarkSent: ok,
    lineCommentsGetUnsent: () => Promise.resolve({ success: true, comments: [] }),

    // -- SSH --
    sshTestConnection: ok,
    sshSaveConnection: () =>
      Promise.resolve({ id: 'mock', name: 'mock', host: 'localhost', port: 22, username: 'user', authType: 'agent' as const }),
    sshGetConnections: () => Promise.resolve([]),
    sshDeleteConnection: () => Promise.resolve(),
    sshConnect: () => Promise.resolve('mock-connection'),
    sshDisconnect: () => Promise.resolve(),
    sshExecuteCommand: () => Promise.resolve({ stdout: '', stderr: '', exitCode: 0 }),
    sshListFiles: () => Promise.resolve([]),
    sshReadFile: () => Promise.resolve(''),
    sshWriteFile: () => Promise.resolve(),
    sshGetState: () => Promise.resolve('disconnected' as const),
    sshGetConfig: () => Promise.resolve({ success: true, hosts: [] }),
    sshGetSshConfigHost: () => Promise.resolve({ success: true }),
    sshCheckIsGitRepo: () => Promise.resolve(false),
    sshInitRepo: () => Promise.resolve(''),
    sshCloneRepo: () => Promise.resolve(''),

    // -- Skills --
    skillsGetCatalog: () => Promise.resolve({ success: true, data: { skills: [], lastUpdated: now } }),
    skillsRefreshCatalog: () => Promise.resolve({ success: true, data: { skills: [], lastUpdated: now } }),
    skillsInstall: ok,
    skillsUninstall: ok,
    skillsGetDetail: () => Promise.resolve({ success: true }),
    skillsGetDetectedAgents: () => Promise.resolve({ success: true, data: [] }),
    skillsCreate: ok,

    // -- Browser preview (used by BrowserPane.tsx) --
    hostPreviewStart: ok,
    hostPreviewSetup: ok,
    hostPreviewStop: ok,
    hostPreviewStopAll: ok,
    onHostPreviewEvent: noopUnsub,
    browserShow: ok,
    browserHide: ok,
    browserSetBounds: ok,
    browserLoadURL: ok,
    browserGoBack: ok,
    browserGoForward: ok,
    browserReload: ok,
    browserOpenDevTools: ok,
    browserClear: ok,
    onBrowserViewEvent: noopUnsub,

    // -- Net / Plan --
    netProbePorts: () => Promise.resolve({ success: true, ports: [] }),
    planApplyLock: ok,
    planReleaseLock: ok,
    onPlanEvent: noopUnsub,
  };

  // Proxy catches any method not explicitly listed above and returns a safe
  // no-op so the app never crashes on missing stubs.
  const handler: ProxyHandler<Record<string, Function>> = {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // Return a function that logs and resolves safely
      return (..._args: any[]) => {
        console.debug(`[browserDevMock] unstubbed call: electronAPI.${prop}`, _args);
        return Promise.resolve({ success: true });
      };
    },
  };

  (window as any).electronAPI = new Proxy(explicitMethods, handler);
}
