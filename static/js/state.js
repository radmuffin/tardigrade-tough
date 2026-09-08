import { FlyClient } from '/_fly/fly-device-sync.js';

export function getRoomFromUrl() {
  const match = window.location.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') || null;
}

export function formatNumber(num) {
  return Math.round(num || 0).toLocaleString('en-US');
}

export function isToday(dateOrIso) {
  if (!dateOrIso) return false;
  const d = new Date(dateOrIso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}

export function formatDayLabel(dateOrIso) {
  if (!dateOrIso) return '';
  const d = new Date(dateOrIso);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
    return 'Today';
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? `${window.location.origin}/api`
  : '/api';

const urlRoom = getRoomFromUrl();
const storedRoom = (typeof localStorage !== 'undefined')
  ? localStorage.getItem('tardigrade_current_room')
  : null;

export const state = {
  roomSlug: urlRoom || storedRoom || 'current',
  apiBase,
  client: new FlyClient({ baseUrl: apiBase }),
  diorama: null,
  trophyDiorama: null,
  offlineSync: null,
  currentRoomData: null,
  selectedGoalIndex: 0,
  pendingGoalTheme: null,
  ws: null,
  lastLoggedSet: null,
  activityFilter: 'all',
  leaderboardCategory: 'all',
};
