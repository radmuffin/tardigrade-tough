import { FlyClient } from '/_fly/fly-device-sync.js';

export function getRoomFromUrl() {
  const match = window.location.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') || 'main';
}

export function formatNumber(num) {
  return Math.round(num || 0).toLocaleString('en-US');
}

const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? `${window.location.origin}/api`
  : '/api';

export const state = {
  roomSlug: getRoomFromUrl() || 'main',
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
