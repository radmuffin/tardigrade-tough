import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

export function renderTrophyRoom() {
  if (!state.currentRoomData) return;
  const completed = state.currentRoomData.completed_goals || [];
  const trophyContainer = document.getElementById('viewTrophy');
  if (!trophyContainer) return;

  if (completed.length > 0) {
    const trophy = completed[0];
    const titleEl = trophyContainer.querySelector('.goal-hero-title');
    const descEl = trophyContainer.querySelector('.goal-hero-desc');
    const subEl = trophyContainer.querySelector('.goal-progress-sub');

    if (titleEl) {
      titleEl.textContent = `${trophy.theme_key === 'whale' ? '🐋 ' : '🏆 '}${trophy.title}`;
    }
    if (descEl) {
      descEl.textContent = trophy.description;
    }
    if (subEl) {
      subEl.innerHTML = `
        <span>${formatNumber(trophy.current_value)} ${trophy.unit} Lifted</span>
        <span>Target: ${formatNumber(trophy.target_value)} ${trophy.unit}</span>
      `;
    }
    if (state.trophyDiorama) {
      state.trophyDiorama.setTheme(trophy.theme_key, 1.0);
    }
  }
}

export function renderWishlists() {
  const container = document.getElementById('wishlistCardsContainer');
  if (!container || !state.currentRoomData) return;
  const list = state.currentRoomData.wishlists || [];

  const countLabel = document.getElementById('questsWishlistCountLabel');
  if (countLabel) {
    countLabel.textContent = `Squad Wishlist (${list.length})`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="wishlist-empty-box">
        No quest proposals yet! Tap <strong>+ Propose Goal</strong> to suggest the crew's next colossal benchmark.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const cat = item.category || 'weight';
    const catEmoji = cat === 'weight' ? '🏋️' : cat === 'distance' ? '🏃' : (cat === 'elevation' ? '🧗' : '🎯');
    const safeTitle = FlyToast.escape(item.title);
    const safeNotes = item.notes ? FlyToast.escape(item.notes) : '';
    const safeUnit = FlyToast.escape(item.unit);

    const proposerDisplay = item.user_nickname
      ? `${item.user_nickname} (\`${item.user_token}\`)`
      : (item.user_token ? `\`${item.user_token}\`` : '');

    const ghTitle = encodeURIComponent(`[Quest Proposal] ${item.title} (${cat})`);
    const ghBody = encodeURIComponent(
      `### 🌲 New Quest Proposal from Tardigrade Tough\n\n` +
      `- **Quest Title**: ${item.title}\n` +
      `- **Category**: \`${cat}\` (${item.unit})\n` +
      `- **Target Metric**: ${formatNumber(item.target_value)} ${item.unit}\n` +
      `- **Squad Room**: \`${item.room_slug || state.roomSlug}\`\n` +
      (proposerDisplay ? `- **Proposed by**: ${proposerDisplay}\n\n` : `\n`) +
      `#### 📝 Notes & Lore\n` +
      `> ${item.notes || 'No extra notes provided.'}\n\n` +
      `---\n` +
      `*Submitted via Tardigrade Tough app.*`
    );
    const ghIssueUrl = `https://github.com/radmuffin/tardigrade-tough/issues/new?title=${ghTitle}&body=${ghBody}&labels=quest-proposal`;

    return `
      <div class="wishlist-card">
        <div class="wishlist-header-row">
          <span class="wishlist-card-title">${safeTitle}</span>
          <span class="wishlist-cat-badge ${FlyToast.escape(cat)}">${catEmoji} ${FlyToast.escape(cat)}</span>
        </div>
        <div class="wishlist-meta-row">
          <span>Target: <span class="wishlist-target-num">${formatNumber(item.target_value)} ${safeUnit}</span></span>
          ${item.user_nickname ? `<span class="wishlist-proposer" title="UUID: ${FlyToast.escape(item.user_token || '')}">by <strong>${FlyToast.escape(item.user_nickname)}</strong></span>` : ''}
        </div>
        ${safeNotes ? `<div class="wishlist-notes-text">“${safeNotes}”</div>` : ''}
        <div class="wishlist-actions-row">
          <a href="${ghIssueUrl}" target="_blank" rel="noopener noreferrer" class="wishlist-action-btn gh-issue-link" title="Open formatted GitHub Issue in new tab">
            <span>🐙</span> GitHub Issue
          </a>
          <button type="button" class="wishlist-action-btn activate-quest-btn" data-title="${safeTitle}" data-cat="${cat}" data-val="${item.target_value}" data-unit="${safeUnit}" data-notes="${safeNotes}" title="Promote this proposal to an active live quest">
            <span>🚀</span> Activate Quest
          </button>
        </div>
      </div>
    `;
  }).join('');
}
