import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber, isToday, formatDayLabel } from './state.js';

export function setupActivityFilters({ onFilterChange } = {}) {
  const allBtn = document.getElementById('filterAllCrewBtn');
  const myBtn = document.getElementById('filterMyLiftsBtn');

  if (!allBtn || !myBtn) return;

  allBtn.addEventListener('click', () => {
    state.activityFilter = 'all';
    allBtn.classList.add('active');
    myBtn.classList.remove('active');
    if (onFilterChange) onFilterChange('all');
    else renderFeed();
  });

  myBtn.addEventListener('click', () => {
    state.activityFilter = 'my';
    myBtn.classList.add('active');
    allBtn.classList.remove('active');
    if (onFilterChange) onFilterChange('my');
    else renderFeed();
  });
}

export function renderFeed({ onReloadState } = {}) {
  const container = document.getElementById('activityFeedList');
  if (!container || !state.currentRoomData) return;
  container.innerHTML = '';

  const activities = (state.currentRoomData.recent_activities || []).filter(act => {
    if (state.activityFilter === 'my') {
      return act.user_token === state.currentRoomData.user_profile?.user_token;
    }
    return true;
  });

  // Update Today's Total Summary Banner
  const bannerTitle = document.getElementById('activityDayBannerTitle');
  const bannerSub = document.getElementById('activityDayBannerSub');
  const bannerVal = document.getElementById('activityDayBannerVal');
  const bannerSets = document.getElementById('activityDayBannerSets');

  if (bannerTitle && bannerSub && bannerVal && bannerSets) {
    const isMy = state.activityFilter === 'my';
    bannerTitle.textContent = isMy ? "Today's Work" : "Today's Crew Work";
    bannerSub.textContent = isMy ? "My Sets Today" : "All Crew Sets Today";

    let todayWeight = 0;
    let todayDistance = 0;
    let todayElevation = 0;
    let todaySets = 0;

    activities.forEach(act => {
      if (isToday(act.created_at)) {
        if (act.activity_type === 'weight') {
          todayWeight += act.total_metric || 0;
        } else if (act.activity_type === 'distance') {
          todayDistance += act.distance_val || act.total_metric || 0;
        } else if (act.activity_type === 'elevation') {
          todayElevation += act.elevation_val || act.total_metric || 0;
        } else if (act.weight_per_rep > 0) {
          todayWeight += act.total_metric || 0;
        }
        todaySets += (act.sets || 1);
      }
    });

    const parts = [];
    if (todayWeight > 0) parts.push(`${formatNumber(todayWeight)} lbs`);
    if (todayDistance > 0) parts.push(`${Number.isInteger(todayDistance) ? todayDistance : (Math.round(todayDistance * 10) / 10)} mi`);
    if (todayElevation > 0) parts.push(`${formatNumber(todayElevation)} ft`);

    bannerVal.textContent = parts.length > 0 ? parts.join(' · ') : '0 lbs';
    bannerSets.textContent = `${todaySets} set${todaySets === 1 ? '' : 's'}`;
  }

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="activity-empty-state">
        <div class="activity-empty-icon">📊</div>
        <div class="activity-empty-title">No activity yet</div>
      </div>
    `;
    return;
  }

  // Group activities by day
  const dayGroups = [];
  const groupMap = new Map();

  activities.forEach(act => {
    const dayKey = new Date(act.created_at).toDateString();
    if (!groupMap.has(dayKey)) {
      const group = {
        dateStr: act.created_at,
        activities: [],
        totalWeight: 0,
        totalDistance: 0,
        totalElevation: 0,
        totalSets: 0,
      };
      groupMap.set(dayKey, group);
      dayGroups.push(group);
    }
    const group = groupMap.get(dayKey);
    group.activities.push(act);
    if (act.activity_type === 'weight') {
      group.totalWeight += act.total_metric || 0;
    } else if (act.activity_type === 'distance') {
      group.totalDistance += act.distance_val || act.total_metric || 0;
    } else if (act.activity_type === 'elevation') {
      group.totalElevation += act.elevation_val || act.total_metric || 0;
    } else if (act.weight_per_rep > 0) {
      group.totalWeight += act.total_metric || 0;
    }
    group.totalSets += (act.sets || 1);
  });

  dayGroups.forEach(group => {
    // Day group divider with daily total stats
    const divider = document.createElement('div');
    divider.className = 'activity-day-divider';

    const dayLabel = formatDayLabel(group.dateStr);
    const dayParts = [];
    if (group.totalWeight > 0) dayParts.push(`${formatNumber(group.totalWeight)} lbs`);
    if (group.totalDistance > 0) dayParts.push(`${Number.isInteger(group.totalDistance) ? group.totalDistance : (Math.round(group.totalDistance * 10) / 10)} mi`);
    if (group.totalElevation > 0) dayParts.push(`${formatNumber(group.totalElevation)} ft`);
    const statsStr = dayParts.length > 0
      ? `${dayParts.join(' · ')} • ${group.totalSets} set${group.totalSets === 1 ? '' : 's'}`
      : `${group.totalSets} set${group.totalSets === 1 ? '' : 's'}`;

    divider.innerHTML = `
      <span class="activity-day-label">${dayLabel}</span>
      <span class="activity-day-stats">${statsStr}</span>
    `;
    container.appendChild(divider);

    group.activities.forEach(act => {
      const item = document.createElement('div');
      item.className = 'activity-item';

      const isMe = act.user_token === state.currentRoomData.user_profile?.user_token;
      let metricText = '';
      if (act.activity_type === 'weight') {
        metricText = `+${formatNumber(act.total_metric)} lbs`;
      } else if (act.activity_type === 'distance') {
        metricText = `+${act.total_metric} mi`;
      } else if (act.activity_type === 'elevation') {
        metricText = `+${formatNumber(act.total_metric)} ft`;
      } else if (act.activity_type === 'ability') {
        metricText = '⚡ Feat';
      } else {
        const matchGoal = (state.currentRoomData.active_goals || []).find(g => g.id === act.goal_id || g.category === act.activity_type);
        const unit = matchGoal?.unit || '';
        metricText = `+${formatNumber(act.total_metric)} ${unit}`.trim();
      }

      let detailStr = act.activity_type === 'weight'
        ? `${act.sets}x${act.reps} @ ${act.weight_per_rep}lbs`
        : act.activity_type === 'ability'
        ? 'Accomplished'
        : (act.sets > 1 || act.reps > 1 ? `${act.sets}x${act.reps}` : '');

      const displayAvatar = act.user_avatar_emoji || (act.user_nickname || 'L').substring(0, 1).toUpperCase();
      const isEmoji = /\p{Extended_Pictographic}/u.test(displayAvatar);
      const avatarFontSize = isEmoji ? '1.1rem' : displayAvatar.length > 2 ? '0.74rem' : displayAvatar.length === 2 ? '0.82rem' : '0.9rem';
      const avatarFontWeight = isEmoji ? 'normal' : '700';

      const prBadge = act.is_pr
        ? ` <span class="pr-badge ${isMe ? 'pr-badge-clickable' : ''}" data-id="${act.id}" title="${isMe ? 'Click to edit info or PR' : 'Personal Record'}">👑 PR</span>`
        : '';
      const combBadge = act.is_combined
        ? ` <span class="combined-badge" title="Combined volume (excluded from PR)">📦 Combined</span>`
        : '';
      const privateBadge = act.is_private
        ? ` <span class="private-badge" title="Private workout (solo only)">🔒 Private</span>`
        : '';

      item.innerHTML = `
        <div class="activity-left">
          <div class="user-avatar" style="background-color: ${act.user_avatar_color}; width: 32px; height: 32px; font-size: ${avatarFontSize}; font-weight: ${avatarFontWeight};">
            ${FlyToast.escape(displayAvatar)}
          </div>
          <div class="activity-text">
            <div><strong class="activity-user">${FlyToast.escape(act.user_nickname)}</strong> <span style="color: var(--text-secondary);">${FlyToast.escape(act.exercise_name)}${detailStr ? ` (${detailStr})` : ''}</span>${prBadge}${combBadge}${privateBadge}</div>
            <div class="activity-meta">
              <span>${act.notes ? `"${FlyToast.escape(act.notes)}" • ` : ''}${formatTimeAgo(act.created_at)}</span>
              <span class="activity-inline-reactions">
                <button class="activity-react-btn" data-emoji="💪" title="Cheer 💪" type="button">💪</button>
                <button class="activity-react-btn" data-emoji="🔥" title="Cheer 🔥" type="button">🔥</button>
                <button class="activity-react-btn" data-emoji="👏" title="Cheer 👏" type="button">👏</button>
              </span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="activity-metric-badge">${metricText}</span>
          ${isMe ? `<button class="edit-activity-btn" data-id="${act.id}" title="Edit Info / PR">✎</button>` : ''}
          ${isMe ? `<button class="delete-btn" data-id="${act.id}" title="Undo / Delete">✕</button>` : ''}
        </div>
      `;

      if (isMe) {
        const delBtn = item.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', () => deleteActivity(act.id, { onReloadState }));
        }
        const editBtn = item.querySelector('.edit-activity-btn');
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            if (window.openActivityEditModal) window.openActivityEditModal(act);
          });
        }
        const prClickable = item.querySelector('.pr-badge-clickable');
        if (prClickable) {
          prClickable.addEventListener('click', () => {
            if (window.openActivityEditModal) window.openActivityEditModal(act);
          });
        }
      }

      container.appendChild(item);
    });
  });
}

export function formatTimeAgo(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch (_) {
    return '';
  }
}

export async function deleteActivity(id, { onReloadState } = {}) {
  if (!confirm('Undo / delete this activity?')) return;
  try {
    const res = await state.client.delete(`/activities/${id}`);
    if (res && res.success) {
      FlyToast.info('Activity removed.');
      if (onReloadState) await onReloadState();
    }
  } catch (err) {
    FlyToast.error('Failed to delete activity');
  }
}

export function setupCheers() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.cheer-btn, .activity-cheer-bar-btn, .activity-react-btn');
    if (!btn) return;
    const emoji = btn.dataset.emoji;
    if (!emoji) return;

    btn.classList.add('cheer-pop');
    setTimeout(() => btn.classList.remove('cheer-pop'), 250);

    if (state.diorama) {
      state.diorama.spawnEmojiReaction(emoji);
    }

    try {
      await state.client.post('/cheer', { room_slug: state.roomSlug, emoji });
    } catch (_) {}
  });
}
