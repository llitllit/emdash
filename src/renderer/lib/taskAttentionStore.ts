import { activityStore } from './activityStore';

/**
 * Tracks "last viewed" vs "last active" per task so filtered cycling shortcuts
 * can skip tasks the user has already seen.
 */
class TaskAttentionStore {
  private lastViewed = new Map<string, number>(); // taskId → timestamp
  private lastActive = new Map<string, number>(); // taskId → timestamp (set by activity)

  markViewed(taskId: string) {
    this.lastViewed.set(taskId, Date.now());
  }

  markActive(taskId: string) {
    this.lastActive.set(taskId, Date.now());
  }

  hasUnseenActivity(taskId: string): boolean {
    const viewed = this.lastViewed.get(taskId) ?? 0;
    const active = this.lastActive.get(taskId) ?? 0;
    return active > viewed;
  }

  needsInput(taskId: string): boolean {
    return activityStore.getLastSignal(taskId) === 'awaiting_input';
  }
}

export const taskAttentionStore = new TaskAttentionStore();
