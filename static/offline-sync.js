/**
 * offline-sync.js - Offline persistence and queue manager for Gym Logs
 * Caches activities in localStorage when offline and flushes them in a batch
 * as soon as connectivity is restored.
 */

export class OfflineSyncManager {
  constructor(client, onStatusChange = null) {
    this.client = client;
    this.storageKey = 'tardigrade_offline_queue';
    this.onStatusChange = onStatusChange;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyStatus();
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyStatus();
    });

    // Periodic sync check every 15 seconds
    setInterval(() => {
      if (navigator.onLine && this.getQueue().length > 0 && !this.isSyncing) {
        this.flushQueue();
      }
    }, 15000);
  }

  notifyStatus() {
    const queue = this.getQueue();
    if (this.onStatusChange) {
      this.onStatusChange({
        isOnline: this.isOnline,
        pendingCount: queue.length,
        isSyncing: this.isSyncing,
      });
    }
  }

  getQueue() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  saveQueue(queue) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(queue));
    } catch (_) {}
    this.notifyStatus();
  }

  enqueue(activityReq) {
    const queue = this.getQueue();
    const queuedItem = {
      ...activityReq,
      _queued_at: new Date().toISOString(),
      _temp_id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    };
    queue.push(queuedItem);
    this.saveQueue(queue);
    return queuedItem;
  }

  async flushQueue() {
    const queue = this.getQueue();
    if (queue.length === 0 || this.isSyncing) return;

    this.isSyncing = true;
    this.notifyStatus();

    try {
      // Send batch to backend
      const res = await this.client.post('/activities/batch', {
        activities: queue.map(item => {
          const clean = { ...item };
          delete clean._queued_at;
          delete clean._temp_id;
          return clean;
        }),
      });

      if (res && res.success) {
        this.saveQueue([]); // cleared!
        this.isSyncing = false;
        this.notifyStatus();
        return { success: true, count: queue.length };
      }
    } catch (err) {
      console.warn('OfflineSyncManager flush failed, keeping queue:', err);
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }

    return { success: false, count: queue.length };
  }
}
