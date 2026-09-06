import { FlyToast, FlyTheme } from '/_fly/fly-ui.js';
import { state, formatNumber } from '../state.js';
import { formatTimeAgo } from '../activity-feed.js';

export function setupHubModal({ onReloadState } = {}) {
  const profileModal = document.getElementById('profileModal');
  const roomModal = document.getElementById('roomModal');
  const hubBox = document.querySelector('.hub-modal-box');
  const nickInput = document.getElementById('nickInput');
  let selectedColor = '#10b981';
  let selectedEmoji = '🐻';

  // Profile View vs Edit Panes
  const profileViewMode = document.getElementById('profileViewMode');
  const profileEditMode = document.getElementById('profileEditMode');
  const startEditProfileBtn = document.getElementById('startEditProfileBtn');
  const cancelProfileEditBtn = document.getElementById('cancelProfileEditBtn');

  // Header & Edit Avatar elements
  const avatarPreviewChip = document.getElementById('avatarPreviewChip');
  const avatarPreviewEmoji = document.getElementById('avatarPreviewEmoji');
  const avatarPreviewName = document.getElementById('avatarPreviewName');
  const avatarEditChip = document.getElementById('avatarEditChip');
  const avatarEditEmoji = document.getElementById('avatarEditEmoji');
  const avatarEditName = document.getElementById('avatarEditName');

  // Personal Telemetry elements
  const profileStatTonnage = document.getElementById('profileStatTonnage');
  const profileStatSets = document.getElementById('profileStatSets');
  const profileStatCardio = document.getElementById('profileStatCardio');
  const profileStatFeats = document.getElementById('profileStatFeats');
  const profileRecentList = document.getElementById('profileRecentList');

  const toggleInitialsBtn = document.getElementById('toggleInitialsBtn');
  const initialsToggleText = document.getElementById('initialsToggleText');
  const initialsContainer = document.getElementById('initialsContainer');
  const initialsInput = document.getElementById('initialsInput');
  const resetInitialsBtn = document.getElementById('resetInitialsBtn');

  function getDefaultNicknameInitial() {
    const nick = (nickInput ? nickInput.value.trim() : '') || 'Athlete';
    const parts = nick.split(/[\s_\-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nick.substring(0, 1).toUpperCase();
  }

  function updateAvatarPreview() {
    if (avatarPreviewChip) avatarPreviewChip.style.backgroundColor = selectedColor;
    if (avatarEditChip) avatarEditChip.style.backgroundColor = selectedColor;
    const currentNick = (nickInput ? nickInput.value.trim() : '') || 'Athlete';
    if (avatarPreviewName) avatarPreviewName.textContent = currentNick;
    if (avatarEditName) avatarEditName.textContent = currentNick;

    const displayContent = selectedEmoji || getDefaultNicknameInitial();
    const isEmoji = /\p{Extended_Pictographic}/u.test(displayContent);
    const fontSize = isEmoji
      ? '1.7rem'
      : displayContent.length > 2
      ? '1.1rem'
      : displayContent.length === 2
      ? '1.3rem'
      : '1.5rem';
    const fontWeight = isEmoji ? 'normal' : '700';

    if (avatarPreviewEmoji) {
      avatarPreviewEmoji.textContent = displayContent;
      avatarPreviewEmoji.style.fontSize = fontSize;
      avatarPreviewEmoji.style.fontWeight = fontWeight;
    }
    if (avatarEditEmoji) {
      avatarEditEmoji.textContent = displayContent;
      avatarEditEmoji.style.fontSize = fontSize;
      avatarEditEmoji.style.fontWeight = fontWeight;
    }
  }

  function syncEmojiSelectionUI() {
    const isChipEmoji = Array.from(document.querySelectorAll('.emoji-chip')).some(
      chip => chip.dataset.emoji === selectedEmoji
    );

    document.querySelectorAll('.emoji-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.emoji === selectedEmoji);
    });

    if (isChipEmoji) {
      if (initialsContainer) initialsContainer.style.display = 'none';
      if (toggleInitialsBtn) {
        toggleInitialsBtn.classList.remove('active');
        if (initialsToggleText) initialsToggleText.textContent = 'Use Initials';
      }
    } else {
      if (initialsContainer) initialsContainer.style.display = 'block';
      if (initialsInput) {
        initialsInput.value = selectedEmoji || getDefaultNicknameInitial();
      }
      if (toggleInitialsBtn) {
        toggleInitialsBtn.classList.add('active');
        if (initialsToggleText) initialsToggleText.textContent = 'Initials Active';
      }
    }

    updateAvatarPreview();
  }

  function showProfileView() {
    if (profileViewMode) profileViewMode.style.display = 'block';
    if (profileEditMode) profileEditMode.style.display = 'none';
    renderProfileTelemetry();
  }

  function showProfileEdit() {
    if (profileViewMode) profileViewMode.style.display = 'none';
    if (profileEditMode) profileEditMode.style.display = 'block';
    if (state.currentRoomData && state.currentRoomData.user_profile) {
      if (nickInput) nickInput.value = state.currentRoomData.user_profile.nickname;
      selectedColor = state.currentRoomData.user_profile.avatar_color || '#10b981';
      selectedEmoji = state.currentRoomData.user_profile.avatar_emoji || '';
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === selectedColor);
      });
      syncEmojiSelectionUI();
    }
    updateAvatarPreview();
    if (nickInput) {
      nickInput.focus();
    }
  }

  function cancelProfileEdit() {
    if (state.currentRoomData && state.currentRoomData.user_profile) {
      if (nickInput) nickInput.value = state.currentRoomData.user_profile.nickname;
      selectedColor = state.currentRoomData.user_profile.avatar_color || '#10b981';
      selectedEmoji = state.currentRoomData.user_profile.avatar_emoji || '';
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === selectedColor);
      });
      syncEmojiSelectionUI();
    }
    showProfileView();
  }

  if (startEditProfileBtn) startEditProfileBtn.addEventListener('click', showProfileEdit);
  if (cancelProfileEditBtn) cancelProfileEditBtn.addEventListener('click', cancelProfileEdit);

  function renderProfileTelemetry() {
    if (!state.currentRoomData || !state.currentRoomData.user_profile) return;
    const user = state.currentRoomData.user_profile;
    const myToken = user.user_token;

    if (avatarPreviewChip) avatarPreviewChip.style.backgroundColor = user.avatar_color || '#10b981';
    if (avatarPreviewName) avatarPreviewName.textContent = user.nickname || 'Athlete';
    if (avatarPreviewEmoji) {
      const displayContent = user.avatar_emoji || ((user.nickname || 'Athlete').substring(0, 1).toUpperCase());
      avatarPreviewEmoji.textContent = displayContent;
      const isEmoji = /\p{Extended_Pictographic}/u.test(displayContent);
      avatarPreviewEmoji.style.fontSize = isEmoji ? '1.7rem' : '1.3rem';
      avatarPreviewEmoji.style.fontWeight = isEmoji ? 'normal' : '700';
    }
    const streakPreview = document.getElementById('avatarPreviewStreak');
    if (streakPreview) {
      const sDays = user.streak_days || 0;
      const sState = user.tardigrade_state || 'cryptobiosis';
      streakPreview.textContent = `${sDays > 0 ? '🔥' : '💤'} ${sDays}d streak · ${sState === 'hydrated' ? 'Hydrated' : 'Cryptobiosis'}`;
    }

    let totalSets = 0;
    let totalWeight = 0;
    let totalDist = 0;
    let totalElev = 0;

    if (user.personal_stats) {
      totalWeight = user.personal_stats.total_weight || 0;
      totalDist = user.personal_stats.total_distance || 0;
      totalElev = user.personal_stats.total_elevation || 0;
      totalSets = user.personal_stats.total_sets || 0;
    } else {
      const myEntries = (state.currentRoomData.leaderboard || []).filter(m => m.user_token === myToken);
      for (const m of myEntries) {
        totalWeight += m.total_weight || 0;
        totalDist += m.total_distance || 0;
        totalElev += m.total_elevation || 0;
        totalSets += m.total_sets || 0;
      }
    }

    if (profileStatTonnage) profileStatTonnage.textContent = `${formatNumber(totalWeight)} lbs`;
    if (profileStatSets) profileStatSets.textContent = totalSets.toString();

    if (profileStatCardio) {
      const distFormatted = Number.isInteger(totalDist) ? totalDist : (Math.round(totalDist * 10) / 10);
      if (totalDist > 0 && totalElev > 0) {
        profileStatCardio.textContent = `${distFormatted} mi · ${formatNumber(totalElev)} ft`;
      } else if (totalDist > 0) {
        profileStatCardio.textContent = `${distFormatted} mi`;
      } else if (totalElev > 0) {
        profileStatCardio.textContent = `${formatNumber(totalElev)} ft`;
      } else {
        profileStatCardio.textContent = `0 mi · 0 ft`;
      }
    }

    const prs = state.currentRoomData.personal_records || [];
    const featsCount = user.personal_stats?.total_feats || 0;
    if (profileStatFeats) {
      const myLeaderboard = (state.currentRoomData.leaderboard || []).find(m => m.user_token === myToken);
      const mvpBadge = (myLeaderboard && myLeaderboard.is_daily_mvp) ? ' · 👑 MVP' : '';
      const featsBadge = featsCount > 0 ? ` · ${featsCount} Feat${featsCount === 1 ? '' : 's'}` : '';
      profileStatFeats.textContent = `${prs.length} PR${prs.length === 1 ? '' : 's'}${featsBadge}${mvpBadge}`;
    }

    // PRs Card
    const prsCard = document.getElementById('profilePrsCard');
    const prsList = document.getElementById('profilePrsList');
    if (prsCard && prsList) {
      if (prs.length > 0) {
        prsCard.style.display = 'block';
        prsList.innerHTML = prs.map(pr => {
          let valStr = '';
          if (pr.activity_type === 'ability') {
            valStr = 'Conquered';
          } else if (pr.activity_type === 'weight') {
            valStr = pr.max_weight > 0 ? `${formatNumber(pr.max_weight)} lbs` : `${pr.max_reps} reps`;
          } else if (pr.activity_type === 'distance') {
            valStr = `${pr.max_distance} mi`;
          } else if (pr.activity_type === 'elevation') {
            valStr = `${formatNumber(pr.max_elevation)} ft`;
          }
          return `<span class="pr-pill"><span>${FlyToast.escape(pr.exercise_name)}:</span> <strong>${valStr}</strong></span>`;
        }).join('');
      } else {
        prsCard.style.display = 'none';
      }
    }

    // Recent Developments
    if (profileRecentList) {
      const myActivities = (state.currentRoomData.recent_activities || []).filter(
        act => act.user_token === myToken
      );

      if (myActivities.length === 0) {
        profileRecentList.innerHTML = `<div class="profile-recent-empty">No activity logged yet</div>`;
      } else {
        profileRecentList.innerHTML = myActivities.slice(0, 4).map(act => {
          let icon = '🔥';
          let metricStr = `+${formatNumber(act.total_metric)}`;

          if (act.activity_type === 'ability') {
            icon = '⚡';
            metricStr = 'Feat';
          } else if (act.activity_type === 'weight') {
            icon = '🏋️';
            metricStr = `+${formatNumber(act.total_metric)} lbs`;
          } else if (act.activity_type === 'distance') {
            icon = '🏃';
            metricStr = `+${act.distance_val || act.total_metric} mi`;
          } else if (act.activity_type === 'elevation') {
            icon = '🧗';
            metricStr = `+${formatNumber(act.elevation_val || act.total_metric)} ft`;
          }

          const prHtml = act.is_pr
            ? `<span class="activity-pr-badge" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 4px;">👑 PR</span>`
            : '';
          const combHtml = act.is_combined
            ? `<span class="combined-badge" style="font-size: 0.62rem; padding: 1px 4px; margin-left: 4px;">📦 Combined</span>`
            : '';

          return `
            <div class="profile-recent-item">
              <div class="profile-recent-main">
                <span class="profile-recent-icon">${icon}</span>
                <span class="profile-recent-name" title="${FlyToast.escape(act.exercise_name)}">${FlyToast.escape(act.exercise_name)}</span>
                ${prHtml}${combHtml}
              </div>
              <div class="profile-recent-right">
                <span class="profile-recent-metric">${metricStr}</span>
                <span class="profile-recent-time">${formatTimeAgo(act.created_at)}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  const tabBtnProfile = document.getElementById('tabBtnProfile');
  const tabBtnSquad = document.getElementById('tabBtnSquad');
  const hubPaneProfile = document.getElementById('hubPaneProfile');
  const hubPaneSquad = document.getElementById('hubPaneSquad');

  const roomSlugInput = document.getElementById('roomSlugInput');
  const newRoomNameInput = document.getElementById('newRoomNameInput');
  const createNewRoomBtn = document.getElementById('createNewRoomBtn');
  const qrImg = document.getElementById('roomQrImage');
  const editRoomNameInput = document.getElementById('editRoomNameInput');
  const saveRoomNameBtn = document.getElementById('saveRoomNameBtn');
  const shareRoomUrlInput = document.getElementById('shareRoomUrlInput');
  const copyRoomUrlBtn = document.getElementById('copyRoomUrlBtn');
  const nativeShareBtn = document.getElementById('nativeShareBtn');
  const currentRoomSlugLabel = document.getElementById('currentRoomSlugLabel');
  const squadMembersCard = document.getElementById('squadMembersCard');
  const squadMembersList = document.getElementById('squadMembersList');
  const squadMemberCount = document.getElementById('squadMemberCount');
  const squadRoleBadge = document.getElementById('squadRoleBadge');
  const leaveSquadBtn = document.getElementById('leaveSquadBtn');

  const userSquadCount = document.getElementById('userSquadCount');
  const userSquadsList = document.getElementById('userSquadsList');
  const currentSquadCard = document.getElementById('currentSquadCard');
  const quickSoloBtn = document.getElementById('quickSoloBtn');
  const renameSquadControls = document.getElementById('renameSquadControls');
  const soloStatusNotice = document.getElementById('soloStatusNotice');
  const shareSquadStatusBadge = document.getElementById('shareSquadStatusBadge');
  const soloSharePrompt = document.getElementById('soloSharePrompt');
  const promptSquadNameInput = document.getElementById('promptSquadNameInput');
  const promptCreateSquadBtn = document.getElementById('promptCreateSquadBtn');
  const squadShareActiveControls = document.getElementById('squadShareActiveControls');
  const squadQrLabel = document.getElementById('squadQrLabel');

  function populateSquadHubFields() {
    const isSolo = state.roomSlug.startsWith('solo-');
    const myNick = state.currentRoomData?.user_profile?.nickname || 'Athlete';
    const defaultSquadName = (myNick && myNick !== 'Athlete') ? `${myNick}'s Squad` : 'Pando Squad';

    if (roomSlugInput) roomSlugInput.value = state.roomSlug;
    if (currentRoomSlugLabel) currentRoomSlugLabel.textContent = `slug: ${state.roomSlug}`;

    const currentRoomName = state.currentRoomData?.room?.name || (isSolo ? 'Solo Quest' : 'Squad');
    const label = document.getElementById('roomNameLabel');
    if (label) label.textContent = currentRoomName;

    if (editRoomNameInput) {
      editRoomNameInput.value = isSolo ? '' : currentRoomName;
      editRoomNameInput.placeholder = defaultSquadName;
    }

    if (newRoomNameInput) {
      newRoomNameInput.placeholder = defaultSquadName;
    }

    if (soloStatusNotice) soloStatusNotice.style.display = isSolo ? 'block' : 'none';
    if (renameSquadControls) renameSquadControls.style.display = isSolo ? 'none' : 'flex';

    // User Squads List
    const userSquads = state.currentRoomData?.user_squads || [];
    if (userSquadCount) userSquadCount.textContent = userSquads.length;

    const soloItemHtml = `
      <div class="user-squad-item ${isSolo ? 'active' : ''}" data-slug="__solo__" role="button" tabindex="0">
        <div class="user-squad-name-row">
          <span class="user-squad-icon">🧘</span>
          <div style="min-width: 0;">
            <strong class="user-squad-name">Solo</strong>
            <div class="user-squad-meta">Personal Space</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${isSolo ? '<span class="member-pill pill-active">Active</span>' : '<span style="font-size: 0.75rem; color: var(--accent-green); font-weight: 700;">Switch ›</span>'}
        </div>
      </div>
    `;

    if (userSquadsList) {
      const squadCardsHtml = userSquads.map(s => {
        const isActive = s.slug === state.roomSlug;
        return `
          <div class="user-squad-item ${isActive ? 'active' : ''}" data-slug="${FlyToast.escape(s.slug)}" role="button" tabindex="0">
            <div class="user-squad-name-row">
              <span class="user-squad-icon">${s.is_creator ? '👑' : '👥'}</span>
              <div style="min-width: 0;">
                <strong class="user-squad-name">${FlyToast.escape(s.name)}</strong>
                <div class="user-squad-meta">${s.member_count} member${s.member_count === 1 ? '' : 's'} · ${s.is_creator ? 'Creator' : 'Member'}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${isActive ? '<span class="member-pill pill-active">Active</span>' : '<span style="font-size: 0.75rem; color: var(--accent-green); font-weight: 700;">Switch ›</span>'}
            </div>
          </div>
        `;
      }).join('');

      userSquadsList.innerHTML = userSquads.length === 0
        ? soloItemHtml + `<div style="text-align: center; padding: 10px; color: var(--text-muted); font-size: 0.76rem;">No squads yet. Create one below to invite friends!</div>`
        : soloItemHtml + squadCardsHtml;

      userSquadsList.querySelectorAll('.user-squad-item').forEach(item => {
        item.addEventListener('click', () => {
          const slug = item.dataset.slug;
          if (slug === '__solo__') {
            if (!isSolo) {
              try { localStorage.removeItem('tardigrade_current_room'); } catch (_) {}
              window.location.href = '/';
            }
          } else if (slug && slug !== state.roomSlug) {
            try { localStorage.setItem('tardigrade_current_room', slug); } catch (_) {}
            window.location.href = `/r/${slug}`;
          }
        });
      });
    }

    if (quickSoloBtn) {
      if (isSolo) {
        quickSoloBtn.classList.add('active');
        quickSoloBtn.style.opacity = '0.9';
        quickSoloBtn.innerHTML = '<span class="solo-badge-icon">🧘</span><span class="solo-badge-text">Solo (Active)</span>';
      } else {
        quickSoloBtn.classList.remove('active');
        quickSoloBtn.style.opacity = '1';
        quickSoloBtn.innerHTML = '<span class="solo-badge-icon">🧘</span><span class="solo-badge-text">Go Solo</span>';
      }
    }

    if (currentSquadCard) currentSquadCard.style.display = isSolo ? 'none' : 'block';

    if (isSolo) {
      if (soloSharePrompt) soloSharePrompt.style.display = 'block';
      if (squadShareActiveControls) squadShareActiveControls.style.display = 'none';
      if (shareSquadStatusBadge) shareSquadStatusBadge.textContent = 'Solo';
      if (promptSquadNameInput) {
        if (!promptSquadNameInput.value) promptSquadNameInput.value = defaultSquadName;
        promptSquadNameInput.placeholder = defaultSquadName;
      }
    } else {
      if (soloSharePrompt) soloSharePrompt.style.display = 'none';
      if (squadShareActiveControls) squadShareActiveControls.style.display = 'block';
      if (shareSquadStatusBadge) shareSquadStatusBadge.textContent = 'Active';

      const roomUrl = `${window.location.origin}/r/${state.roomSlug}`;
      if (shareRoomUrlInput) shareRoomUrlInput.value = roomUrl;
      if (qrImg) qrImg.src = `/api/qr?url=${encodeURIComponent(roomUrl)}`;
      if (squadQrLabel) squadQrLabel.textContent = '';
      if (nativeShareBtn && typeof navigator.share === 'function') {
        nativeShareBtn.style.display = 'block';
      }
    }

    // Squad Members Roster
    const members = state.currentRoomData?.members || [];
    const creatorToken = state.currentRoomData?.room?.creator_token || '';
    const isCreator = (!isSolo && creatorToken && creatorToken === state.client.token)
      || (!isSolo && members.length === 1 && members[0]?.user_token === state.client.token)
      || (!isSolo && !creatorToken);

    if (squadMemberCount) squadMemberCount.textContent = members.length;
    if (squadRoleBadge) {
      if (isSolo) {
        squadRoleBadge.textContent = 'Solo';
        squadRoleBadge.style.color = 'var(--accent-cyan)';
      } else if (isCreator) {
        squadRoleBadge.textContent = '👑 Creator';
        squadRoleBadge.style.color = 'var(--accent-amber)';
      } else {
        squadRoleBadge.textContent = 'Member';
        squadRoleBadge.style.color = 'var(--text-muted)';
      }
    }

    if (leaveSquadBtn) leaveSquadBtn.style.display = isSolo ? 'none' : 'block';
    if (squadMembersCard) squadMembersCard.style.display = isSolo ? 'none' : 'block';

    if (squadMembersList) {
      if (members.length === 0) {
        squadMembersList.innerHTML = `<div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 0.8rem;">No members yet.</div>`;
      } else {
        squadMembersList.innerHTML = members.map(m => {
          const isMe = m.user_token === state.client.token;
          const isThisCreator = m.is_creator || (creatorToken && m.user_token === creatorToken);
          const canRemove = isCreator && !isMe;
          const avatarColor = FlyToast.escape(m.avatar_color || '#10b981');
          const nick = FlyToast.escape(m.nickname || 'Athlete');

          const memberInitial = (m.nickname || 'L').substring(0, 1).toUpperCase();
          const displayAvatar = m.avatar_emoji || memberInitial;
          const isEmoji = /\p{Extended_Pictographic}/u.test(displayAvatar);
          const avatarFontSize = isEmoji ? '12px' : displayAvatar.length > 2 ? '7.5px' : '9px';
          const avatarFontWeight = isEmoji ? 'normal' : '700';

          return `
            <div class="squad-member-item" data-token="${FlyToast.escape(m.user_token)}">
              <div class="member-left">
                <span class="member-dot" style="background-color: ${avatarColor}; font-size: ${avatarFontSize}; font-weight: ${avatarFontWeight};">
                  ${FlyToast.escape(displayAvatar)}
                </span>
                <div class="member-info">
                  <div class="member-name-row">
                    <strong class="member-nick">${nick}</strong>
                    ${isMe ? '<span class="member-pill pill-me">You</span>' : ''}
                    ${isThisCreator ? '<span class="member-pill pill-creator">👑 Creator</span>' : ''}
                  </div>
                  <span class="member-metric-label">${m.total_sets || 0} sets</span>
                </div>
              </div>
              ${canRemove ? `
                <button class="btn-remove-member" data-token="${FlyToast.escape(m.user_token)}" data-nick="${nick}" type="button" title="Remove member from squad">
                  Remove
                </button>
              ` : ''}
            </div>
          `;
        }).join('');

        squadMembersList.querySelectorAll('.btn-remove-member').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const targetToken = btn.dataset.token;
            const targetNick = btn.dataset.nick || 'this member';
            if (!confirm(`Are you sure you want to remove "${targetNick}" from this squad?`)) return;
            const keepContributions = confirm(`Keep "${targetNick}"'s workout contributions in squad goals?\n\n• Click OK to KEEP contributions\n• Click Cancel to PURGE contributions`);
            try {
              const res = await state.client.post(`/room/${state.roomSlug}/members/${targetToken}/remove`, {
                keep_contributions: keepContributions
              });
              if (res && res.success) {
                FlyToast.success(`Removed "${targetNick}" from squad`);
                if (onReloadState) await onReloadState();
                populateSquadHubFields();
              } else {
                FlyToast.error(res?.error || 'Failed to remove member');
              }
            } catch (err) {
              console.error('Remove member error:', err);
              FlyToast.error('Failed to remove member');
            }
          });
        });
      }

      // Squad Owner Departure Settings
      const squadOwnerSettingsCard = document.getElementById('squadOwnerSettingsCard');
      const squadKeepDepartedToggle = document.getElementById('squadKeepDepartedToggle');
      const departedContributorsSection = document.getElementById('departedContributorsSection');
      const departedContributorsList = document.getElementById('departedContributorsList');

      if (squadOwnerSettingsCard) {
        if (isCreator && !isSolo) {
          squadOwnerSettingsCard.style.display = 'block';
          if (squadKeepDepartedToggle) {
            squadKeepDepartedToggle.checked = state.currentRoomData?.room?.keep_departed_contributions !== false;
            if (!squadKeepDepartedToggle.dataset.bound) {
              squadKeepDepartedToggle.dataset.bound = 'true';
              squadKeepDepartedToggle.addEventListener('change', async () => {
                try {
                  const res = await state.client.post(`/room/${state.roomSlug}/settings`, {
                    keep_departed_contributions: squadKeepDepartedToggle.checked,
                  });
                  if (res && res.success) {
                    if (state.currentRoomData?.room) {
                      state.currentRoomData.room.keep_departed_contributions = squadKeepDepartedToggle.checked;
                    }
                    FlyToast.success('Squad departure rule updated');
                  } else {
                    FlyToast.error(res?.error || 'Failed to update setting');
                    squadKeepDepartedToggle.checked = !squadKeepDepartedToggle.checked;
                  }
                } catch (err) {
                  FlyToast.error('Failed to update setting');
                  squadKeepDepartedToggle.checked = !squadKeepDepartedToggle.checked;
                }
              });
            }
          }

          const departed = state.currentRoomData?.departed_contributors || [];
          if (departedContributorsSection && departedContributorsList) {
            if (departed.length > 0) {
              departedContributorsSection.style.display = 'block';
              departedContributorsList.innerHTML = departed.map(d => {
                const dNick = FlyToast.escape(d.nickname || 'Departed Member');
                const dToken = FlyToast.escape(d.user_token);
                const dInitial = (d.nickname || 'L').substring(0, 1).toUpperCase();
                const dAvatar = d.avatar_emoji || dInitial;
                const dColor = FlyToast.escape(d.avatar_color || '#64748b');

                return `
                  <div class="squad-member-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    <div class="member-left" style="display: flex; align-items: center; gap: 8px;">
                      <span class="member-dot" style="background-color: ${dColor}; font-size: 11px; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                        ${FlyToast.escape(dAvatar)}
                      </span>
                      <div class="member-info">
                        <strong class="member-nick" style="font-size: 0.85rem; color: var(--text-primary);">${dNick}</strong>
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">${d.total_sets || 0} sets · ${Math.round(d.total_metric || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    <button class="btn btn-danger-outline btn-purge-contributor" data-token="${dToken}" data-nick="${dNick}" type="button" style="font-size: 0.72rem; padding: 3px 8px;" title="Purge contributions">
                      Purge
                    </button>
                  </div>
                `;
              }).join('');

              departedContributorsList.querySelectorAll('.btn-purge-contributor').forEach(purgeBtn => {
                purgeBtn.addEventListener('click', async (ev) => {
                  ev.stopPropagation();
                  const pToken = purgeBtn.dataset.token;
                  const pNick = purgeBtn.dataset.nick || 'this member';
                  if (!confirm(`Purge all past contributions by "${pNick}" from this squad? This will roll back squad goals.`)) return;
                  try {
                    const res = await state.client.post(`/room/${state.roomSlug}/members/${pToken}/purge-contributions`);
                    if (res && res.success) {
                      FlyToast.success(`Purged contributions for ${pNick}`);
                      if (onReloadState) await onReloadState();
                      populateSquadHubFields();
                    } else {
                      FlyToast.error(res?.error || 'Failed to purge contributions');
                    }
                  } catch (err) {
                    console.error('Purge error:', err);
                    FlyToast.error('Failed to purge contributions');
                  }
                });
              });
            } else {
              departedContributorsSection.style.display = 'none';
              departedContributorsList.innerHTML = '';
            }
          }
        } else {
          squadOwnerSettingsCard.style.display = 'none';
        }
      }
    }
  }

  function selectHubTab(tabName) {
    if (tabName === 'squad') {
      if (tabBtnSquad) {
        tabBtnSquad.classList.add('active');
        tabBtnSquad.setAttribute('aria-selected', 'true');
      }
      if (tabBtnProfile) {
        tabBtnProfile.classList.remove('active');
        tabBtnProfile.setAttribute('aria-selected', 'false');
      }
      if (hubPaneSquad) hubPaneSquad.style.display = 'flex';
      if (hubPaneProfile) hubPaneProfile.style.display = 'none';
      populateSquadHubFields();
      if (hubBox) hubBox.scrollTop = 0;
    } else {
      if (tabBtnProfile) {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
      }
      if (tabBtnSquad) {
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
      if (hubPaneProfile) hubPaneProfile.style.display = 'flex';
      if (hubPaneSquad) hubPaneSquad.style.display = 'none';
      showProfileView();
      if (hubBox) hubBox.scrollTop = 0;
    }
  }

  if (tabBtnProfile) tabBtnProfile.addEventListener('click', () => selectHubTab('profile'));
  if (tabBtnSquad) tabBtnSquad.addEventListener('click', () => selectHubTab('squad'));

  function openHub(tab = 'profile') {
    populateSquadHubFields();
    if (profileModal) profileModal.classList.remove('hidden');
    if (roomModal) roomModal.classList.remove('hidden');
    selectHubTab(tab);
  }

  function closeHub() {
    if (profileModal) profileModal.classList.add('hidden');
    if (roomModal) roomModal.classList.add('hidden');
  }

  window.openRoomModal = () => openHub('squad');

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', () => openHub('profile'));

  const streakBadge = document.getElementById('streakBadge');
  if (streakBadge) streakBadge.addEventListener('click', () => openHub('profile'));

  const roomBtn = document.getElementById('roomBtn');
  if (roomBtn) roomBtn.addEventListener('click', () => openHub('squad'));

  const closeProfileBtn = document.getElementById('closeProfileBtn');
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeHub);

  const closeRoomBtn = document.getElementById('closeRoomBtn');
  if (closeRoomBtn) closeRoomBtn.addEventListener('click', closeHub);

  // Dark / Light Mode inside profile
  const darkBtn = document.getElementById('themeDarkBtn');
  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      FlyTheme.apply('dark');
      FlyToast.info('Dark mode enabled');
    });
  }

  const lightBtn = document.getElementById('themeLightBtn');
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      FlyTheme.apply('light');
      FlyToast.info('Light mode enabled');
    });
  }

  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
      updateAvatarPreview();
    });
  });

  document.querySelectorAll('.emoji-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedEmoji = chip.dataset.emoji;
      syncEmojiSelectionUI();
    });
  });

  if (toggleInitialsBtn) {
    toggleInitialsBtn.addEventListener('click', () => {
      const isCurrentlyOpen = initialsContainer && initialsContainer.style.display !== 'none';
      if (isCurrentlyOpen) {
        const anyChipSelected = Array.from(document.querySelectorAll('.emoji-chip')).some(c => c.classList.contains('selected'));
        if (!anyChipSelected) selectedEmoji = '🐻';
        syncEmojiSelectionUI();
      } else {
        if (initialsContainer) initialsContainer.style.display = 'block';
        if (toggleInitialsBtn) toggleInitialsBtn.classList.add('active');
        if (initialsToggleText) initialsToggleText.textContent = 'Initials Active';
        document.querySelectorAll('.emoji-chip').forEach(c => c.classList.remove('selected'));
        if (initialsInput) {
          if (!initialsInput.value.trim()) initialsInput.value = getDefaultNicknameInitial();
          selectedEmoji = initialsInput.value.trim();
          initialsInput.focus();
          initialsInput.select();
        }
        updateAvatarPreview();
      }
    });
  }

  if (initialsInput) {
    initialsInput.addEventListener('input', () => {
      const val = initialsInput.value.trim();
      selectedEmoji = val || getDefaultNicknameInitial();
      document.querySelectorAll('.emoji-chip').forEach(c => c.classList.remove('selected'));
      if (toggleInitialsBtn) toggleInitialsBtn.classList.add('active');
      if (initialsToggleText) initialsToggleText.textContent = 'Initials Active';
      updateAvatarPreview();
    });
  }

  if (resetInitialsBtn) {
    resetInitialsBtn.addEventListener('click', () => {
      const defaultInitial = getDefaultNicknameInitial();
      if (initialsInput) initialsInput.value = defaultInitial;
      selectedEmoji = defaultInitial;
      document.querySelectorAll('.emoji-chip').forEach(c => c.classList.remove('selected'));
      if (toggleInitialsBtn) toggleInitialsBtn.classList.add('active');
      if (initialsToggleText) initialsToggleText.textContent = 'Initials Active';
      updateAvatarPreview();
    });
  }

  if (nickInput) {
    nickInput.addEventListener('input', () => {
      const isChipEmoji = Array.from(document.querySelectorAll('.emoji-chip')).some(
        chip => chip.dataset.emoji === selectedEmoji
      );
      if (!isChipEmoji && initialsContainer && initialsContainer.style.display !== 'none') {
        if (!initialsInput || !initialsInput.value.trim()) {
          selectedEmoji = getDefaultNicknameInitial();
          if (initialsInput) initialsInput.value = selectedEmoji;
        }
      }
      updateAvatarPreview();
    });
  }

  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const nick = nickInput ? nickInput.value.trim() : '';
      let emojiToSend = selectedEmoji;
      if (initialsContainer && initialsContainer.style.display !== 'none' && initialsInput) {
        emojiToSend = initialsInput.value.trim() || getDefaultNicknameInitial();
      }
      try {
        const res = await state.client.post('/users/profile', {
          nickname: nick,
          avatar_color: selectedColor,
          avatar_emoji: emojiToSend,
        });
        if (res && res.success) {
          showProfileView();
          closeHub();
          FlyToast.success('Profile updated!');
          if (onReloadState) await onReloadState();
        }
      } catch (e) {
        FlyToast.error('Failed to save profile');
      }
    });
  }

  // Rename Squad
  if (saveRoomNameBtn && editRoomNameInput) {
    saveRoomNameBtn.addEventListener('click', async () => {
      const newName = editRoomNameInput.value.trim();
      if (!newName) {
        FlyToast.error('Please enter a squad name');
        return;
      }
      if (newName.length > 50) {
        FlyToast.error('Squad name must be 50 characters or less');
        return;
      }

      try {
        const res = await state.client.post(`/room/${state.roomSlug}/name`, { name: newName });
        if (res && res.success) {
          if (state.currentRoomData && state.currentRoomData.room) {
            state.currentRoomData.room.name = res.room.name;
          }
          const label = document.getElementById('roomNameLabel');
          if (label) label.textContent = res.room.name;
          FlyToast.success(`Squad renamed to "${res.room.name}"!`);
        } else {
          FlyToast.error(res?.error || 'Failed to rename squad');
        }
      } catch (err) {
        console.error('Squad rename error:', err);
        FlyToast.error('Failed to rename squad');
      }
    });
  }

  // Copy Squad Invite URL
  if (copyRoomUrlBtn && shareRoomUrlInput) {
    copyRoomUrlBtn.addEventListener('click', async () => {
      const url = shareRoomUrlInput.value;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          shareRoomUrlInput.select();
          document.execCommand('copy');
        }
        FlyToast.success('Squad invite link copied to clipboard!');
      } catch (e) {
        shareRoomUrlInput.select();
        document.execCommand('copy');
        FlyToast.success('Squad invite link copied!');
      }
    });
  }

  // Native Web Share Sheet
  if (nativeShareBtn && typeof navigator.share === 'function') {
    nativeShareBtn.style.display = 'block';
    nativeShareBtn.addEventListener('click', async () => {
      try {
        const squadTitle = state.currentRoomData?.room?.name || 'Squad';
        await navigator.share({
          title: `${squadTitle} — Tardigrade Tough`,
          text: `Join "${squadTitle}" on Tardigrade Tough!`,
          url: shareRoomUrlInput ? shareRoomUrlInput.value : window.location.href,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share aborted or failed:', err);
        }
      }
    });
  }

  // Quick Solo Button
  if (quickSoloBtn) {
    quickSoloBtn.addEventListener('click', () => {
      if (state.roomSlug.startsWith('solo-')) {
        FlyToast.info('Already in Solo mode.');
        return;
      }
      try { localStorage.removeItem('tardigrade_current_room'); } catch (_) {}
      window.location.href = '/';
    });
  }

  // Prompt Create & Share Squad (from Solo mode)
  if (promptCreateSquadBtn) {
    promptCreateSquadBtn.addEventListener('click', async () => {
      const myNick = state.currentRoomData?.user_profile?.nickname || 'Athlete';
      const defaultSquadName = (myNick && myNick !== 'Athlete') ? `${myNick}'s Squad` : 'Pando Squad';
      const rawName = promptSquadNameInput ? promptSquadNameInput.value.trim() : '';
      const finalName = rawName || defaultSquadName;

      try {
        promptCreateSquadBtn.disabled = true;
        promptCreateSquadBtn.textContent = 'Creating...';
        const res = await state.client.post('/room/create', { name: finalName });
        if (res && res.success && res.data) {
          try { localStorage.setItem('tardigrade_current_room', res.data.slug); } catch (_) {}
          FlyToast.success(`Squad "${res.data.name}" created!`);
          window.location.href = `/r/${res.data.slug}`;
        } else {
          FlyToast.error(res?.error || 'Failed to create squad');
          promptCreateSquadBtn.disabled = false;
          promptCreateSquadBtn.textContent = 'Create & Share';
        }
      } catch (err) {
        console.error('Create squad error:', err);
        FlyToast.error('Failed to create squad');
        promptCreateSquadBtn.disabled = false;
        promptCreateSquadBtn.textContent = 'Create & Share';
      }
    });
  }

  // Create New Group / Squad
  if (createNewRoomBtn) {
    createNewRoomBtn.addEventListener('click', async () => {
      const myNick = state.currentRoomData?.user_profile?.nickname || 'Athlete';
      const defaultSquadName = (myNick && myNick !== 'Athlete') ? `${myNick}'s Squad` : 'Pando Squad';
      const rawName = newRoomNameInput ? newRoomNameInput.value.trim() : '';
      const finalName = rawName || defaultSquadName;

      try {
        createNewRoomBtn.disabled = true;
        createNewRoomBtn.textContent = 'Creating...';
        const res = await state.client.post('/room/create', { name: finalName });
        if (res && res.success && res.data) {
          try { localStorage.setItem('tardigrade_current_room', res.data.slug); } catch (_) {}
          FlyToast.success(`Created "${res.data.name}"!`);
          window.location.href = `/r/${res.data.slug}`;
        } else {
          FlyToast.error(res?.error || 'Failed to create squad');
          createNewRoomBtn.disabled = false;
          createNewRoomBtn.textContent = 'Create';
        }
      } catch (err) {
        console.error('Create room error:', err);
        FlyToast.error('Failed to create squad');
        createNewRoomBtn.disabled = false;
        createNewRoomBtn.textContent = 'Create';
      }
    });
  }

  // Join Existing
  if (switchRoomBtn && roomSlugInput) {
    switchRoomBtn.addEventListener('click', () => {
      const targetSlug = roomSlugInput.value.trim().toLowerCase();
      if (targetSlug && targetSlug !== state.roomSlug) {
        try { localStorage.setItem('tardigrade_current_room', targetSlug); } catch (e) {}
        window.location.href = `/r/${targetSlug}`;
      }
    });
  }

  // Leave Squad Button
  if (leaveSquadBtn) {
    leaveSquadBtn.addEventListener('click', async () => {
      const squadName = state.currentRoomData?.room?.name || 'this squad';
      if (!confirm(`Leave "${squadName}"?`)) return;
      try {
        const res = await state.client.post(`/room/${state.roomSlug}/leave`);
        if (res && res.success) {
          try { localStorage.removeItem('tardigrade_current_room'); } catch (_) {}
          FlyToast.info(`Left "${squadName}".`);
          const soloSlug = res.data?.solo_slug;
          if (soloSlug) {
            window.location.href = `/r/${soloSlug}`;
          } else {
            window.location.href = '/';
          }
        } else {
          FlyToast.error(res?.error || 'Failed to leave squad');
        }
      } catch (err) {
        console.error('Leave squad error:', err);
        FlyToast.error('Failed to leave squad');
      }
    });
  }

  // Manage Squad button from Leaderboard banner
  const lbManageSquadBtn = document.getElementById('lbManageSquadBtn');
  if (lbManageSquadBtn) {
    lbManageSquadBtn.addEventListener('click', () => openHub('squad'));
  }

  return { openHub, closeHub, selectHubTab, populateSquadHubFields };
}
