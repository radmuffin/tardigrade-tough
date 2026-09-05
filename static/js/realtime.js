import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';
import { showReactionToast } from './reaction-toast.js';

export function initWebSocket({ onReloadState } = {}) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/ws?room=${state.roomSlug}&token=${state.client.token}`;

  try {
    state.ws = new WebSocket(wsUrl);

    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsEvent(msg, { onReloadState });
      } catch (e) {
        console.error('Invalid WS payload:', e);
      }
    };

    state.ws.onclose = () => {
      setTimeout(() => initWebSocket({ onReloadState }), 3000);
    };
  } catch (err) {
    console.warn('WS connection failed, falling back:', err);
  }
}

export function handleWsEvent(msg, { onReloadState } = {}) {
  if (msg.event === 'cheer_reaction') {
    if (state.diorama && msg.payload && msg.payload.emoji) {
      state.diorama.spawnEmojiReaction(msg.payload.emoji);
    }
    if (msg.payload) {
      showReactionToast({
        userNickname: msg.payload.user_nickname,
        userAvatarColor: msg.payload.user_avatar_color,
        userAvatarEmoji: msg.payload.user_avatar_emoji,
        emoji: msg.payload.emoji,
        senderToken: msg.sender_token,
      });
    }
  } else if (msg.event === 'room_renamed') {
    if (msg.payload && msg.payload.room) {
      if (state.currentRoomData && state.currentRoomData.room) {
        state.currentRoomData.room.name = msg.payload.room.name;
      }
      const label = document.getElementById('roomNameLabel');
      if (label) label.textContent = msg.payload.room.name;
      const editInput = document.getElementById('editRoomNameInput');
      if (editInput) editInput.value = msg.payload.room.name;
      if (msg.sender_token !== state.client.token) {
        FlyToast.info(`Squad renamed to "${msg.payload.room.name}"`);
      }
    }
  } else if (msg.event === 'activity_logged' || msg.event === 'batch_activities_logged' || msg.event === 'activity_deleted') {
    if (onReloadState) onReloadState();
    if (msg.event === 'activity_logged') {
      const act = msg.payload.activity;
      const metricLabel = act.activity_type === 'weight' ? `+${formatNumber(act.total_metric)} lbs` : `+${act.total_metric}`;
      if (state.diorama) {
        state.diorama.spawnCelebrationBurst(metricLabel);
      }
      if (msg.sender_token !== state.client.token) {
        FlyToast.success(`${act.user_nickname} hoisted ${metricLabel}!`);
      }
    }
  } else if (msg.event === 'wishlist_added') {
    if (onReloadState) onReloadState();
    if (msg.payload && msg.payload.item && msg.sender_token !== state.client.token) {
      FlyToast.info(`✨ New quest proposed: "${msg.payload.item.title}"`);
    }
  } else if (msg.event === 'goal_created') {
    if (onReloadState) onReloadState();
    if (msg.payload && msg.sender_token !== state.client.token) {
      FlyToast.success(`🚀 New quest activated: "${msg.payload.title}"!`);
    }
  } else if (msg.event === 'member_removed') {
    if (msg.payload && msg.payload.removed_token === state.client.token) {
      FlyToast.warning('You were removed from this squad by the creator.');
      try {
        localStorage.removeItem('tardigrade_current_room');
      } catch (_) {}
      const targetUrl = msg.payload.solo_slug ? `/r/${msg.payload.solo_slug}` : '/';
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 1000);
      return;
    }
    FlyToast.info('A crew member was removed from the squad.');
    if (onReloadState) onReloadState();
  } else if (msg.event === 'member_left') {
    if (msg.sender_token !== state.client.token) {
      FlyToast.info('A crew member left the squad.');
      if (onReloadState) onReloadState();
    }
  }
}
