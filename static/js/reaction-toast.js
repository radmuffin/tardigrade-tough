import { FlyToast } from '/_fly/fly-ui.js';

/**
 * reaction-toast.js
 * Compact, top-anchored reaction toasts with smart burst stacking and minimal footprint.
 */

const MAX_VISIBLE = 3;
const DISMISS_TIMEOUT_MS = 2800;

let activeToasts = [];
let containerEl = null;

function getContainer() {
  if (!containerEl || !document.body.contains(containerEl)) {
    containerEl = document.getElementById('reactionToastContainer');
    if (!containerEl) {
      containerEl = document.createElement('div');
      containerEl.id = 'reactionToastContainer';
      containerEl.className = 'reaction-toast-container';
      containerEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(containerEl);
    }
  }
  return containerEl;
}

function escapeHtml(str) {
  if (typeof FlyToast !== 'undefined' && FlyToast.escape) {
    return FlyToast.escape(str);
  }
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function updateStackLayout() {
  const container = getContainer();
  if (activeToasts.length > 1) {
    container.classList.add('has-multiple');
  } else {
    container.classList.remove('has-multiple');
  }

  activeToasts.forEach((t, i) => {
    t.el.style.zIndex = `${100 - i}`;
  });
}

function dismissToast(toast, immediate = false) {
  if (!toast || toast.dismissing) return;
  toast.dismissing = true;
  clearTimeout(toast.timer);

  const cleanup = () => {
    if (toast.el && toast.el.parentNode) {
      toast.el.remove();
    }
    activeToasts = activeToasts.filter(t => t !== toast);
    updateStackLayout();
  };

  if (immediate) {
    cleanup();
  } else {
    toast.el.classList.add('reaction-dismissing');
    setTimeout(cleanup, 220);
  }
}

/**
 * Display a compact, stackable reaction toast at the top of the viewport.
 */
export function showReactionToast({
  userNickname = 'Crew',
  userAvatarColor = '#10b981',
  userAvatarEmoji = '🐻',
  emoji = '💪',
  senderToken = '',
} = {}) {
  const container = getContainer();
  const key = `${senderToken || userNickname}_${emoji}`;

  // Check if active toast already exists for this sender & emoji
  const existing = activeToasts.find(t => t.key === key && !t.dismissing);
  if (existing) {
    existing.count += 1;
    const countEl = existing.el.querySelector('.reaction-toast-count');
    if (countEl) {
      countEl.textContent = `×${existing.count}`;
      countEl.style.display = 'inline-flex';
    }

    // Retrigger pulse animation
    existing.el.classList.remove('pulse');
    void existing.el.offsetWidth; // Force reflow
    existing.el.classList.add('pulse');

    // Move to top/front of container
    container.prepend(existing.el);
    activeToasts = [existing, ...activeToasts.filter(t => t !== existing)];

    // Refresh timer
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => dismissToast(existing), DISMISS_TIMEOUT_MS);

    updateStackLayout();
    return;
  }

  // If at capacity, immediately dismiss the oldest to maintain compact stack
  while (activeToasts.length >= MAX_VISIBLE) {
    const oldest = activeToasts[activeToasts.length - 1];
    dismissToast(oldest, true);
  }

  // Create new compact pill
  const pill = document.createElement('div');
  pill.className = 'reaction-toast-pill';
  pill.setAttribute('role', 'status');

  const safeNick = escapeHtml(userNickname);
  const safeColor = escapeHtml(userAvatarColor);
  const safeAvatar = userAvatarEmoji ? escapeHtml(userAvatarEmoji) : '🐻';
  const safeEmoji = escapeHtml(emoji);

  pill.innerHTML = `
    <span class="reaction-toast-avatar" style="background-color: ${safeColor};">${safeAvatar}</span>
    <span class="reaction-toast-user">${safeNick}</span>
    <span class="reaction-toast-text">sent</span>
    <span class="reaction-toast-emoji">${safeEmoji}</span>
    <span class="reaction-toast-count" style="display: none;"></span>
  `;

  container.prepend(pill);

  const newToast = {
    key,
    count: 1,
    el: pill,
    dismissing: false,
    timer: null,
  };

  newToast.timer = setTimeout(() => dismissToast(newToast), DISMISS_TIMEOUT_MS);
  activeToasts.unshift(newToast);

  updateStackLayout();
}
