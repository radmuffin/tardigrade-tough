import { FlyToast, FlyTheme } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';
import { formatTimeAgo } from './activity-feed.js';

export function setupSheetImporter({ onReloadState } = {}) {
  const importModal = document.getElementById('importModal');
  const openBtn = document.getElementById('openImportModalBtn');
  const closeBtn = document.getElementById('closeImportBtn');
  const pasteArea = document.getElementById('importPasteArea');
  const userNickInput = document.getElementById('importUserNick');
  const userColorSelect = document.getElementById('importUserColor');
  const categorySelect = document.getElementById('importCategory');
  const exerciseNameInput = document.getElementById('importExerciseName');
  const excludePrCheckbox = document.getElementById('importExcludePr');
  const summaryBox = document.getElementById('importSummaryBox');
  const summaryText = document.getElementById('importSummaryText');
  const tonnageText = document.getElementById('importTonnageText');
  const executeBtn = document.getElementById('executeImportBtn');

  if (!importModal || !closeBtn || !pasteArea || !executeBtn) return;

  let parsedActivities = [];

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      importModal.classList.remove('hidden');
      parsePastedData();
    });
  }

  closeBtn.addEventListener('click', () => {
    importModal.classList.add('hidden');
  });

  function parsePastedData() {
    const raw = pasteArea.value.trim();
    if (!raw) {
      if (summaryBox) summaryBox.style.display = 'none';
      executeBtn.disabled = true;
      parsedActivities = [];
      return;
    }

    const lines = raw.split(/\r?\n/);
    parsedActivities = [];
    let totalTonnage = 0;
    const cat = categorySelect?.value || 'weight';
    const defaultEx = exerciseNameInput?.value.trim() || 'Sheet Lift';
    const isCombined = excludePrCheckbox?.checked || false;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parts = trimmed.split(/[\t,;]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 1) {
        const spaceParts = trimmed.split(/\s+/);
        if (spaceParts.length > 1) {
          parts = spaceParts;
        }
      }

      let exercise = defaultEx;
      let weight = 0;
      let reps = 1;
      let sets = 1;
      let calculatedTotal = 0;
      let notes = `Sheet Row #${idx + 1}`;

      if (parts.length >= 2 && isNaN(Number(parts[0]))) {
        exercise = parts[0];
        const num1 = parseFloat(parts[1]) || 0;
        const num2 = parts.length >= 3 ? (parseFloat(parts[2]) || 1) : 1;
        weight = num1;
        reps = Math.round(num2);
        calculatedTotal = weight * reps;
        if (parts.length >= 4) {
          notes = parts.slice(3).join(' ');
        }
      } else if (parts.length >= 2) {
        weight = parseFloat(parts[0]) || 0;
        reps = parseInt(parts[1], 10) || 1;
        calculatedTotal = weight * reps;
        if (parts.length >= 3) {
          notes = parts.slice(2).join(' ');
        }
      } else if (parts.length === 1) {
        calculatedTotal = parseFloat(parts[0]) || 0;
        weight = calculatedTotal;
        reps = 1;
      }

      if (calculatedTotal > 0) {
        totalTonnage += calculatedTotal;
        const weightPerRep = isCombined ? 0.0 : weight;
        parsedActivities.push({
          room_slug: state.roomSlug,
          activity_type: cat,
          exercise_name: exercise,
          sets,
          reps,
          weight_per_rep: cat === 'weight' ? weightPerRep : 0,
          distance_val: cat === 'distance' ? (isCombined ? 0 : calculatedTotal) : 0,
          elevation_val: cat === 'elevation' ? (isCombined ? 0 : calculatedTotal) : 0,
          total_metric: calculatedTotal,
          notes,
          is_combined: isCombined,
          is_pr: isCombined ? false : null,
        });
      }
    });

    const unitLabel = cat === 'distance' ? 'mi' : cat === 'elevation' ? 'ft' : 'lbs';
    if (parsedActivities.length > 0) {
      if (summaryBox) summaryBox.style.display = 'flex';
      if (summaryText) summaryText.textContent = `Parsed: ${parsedActivities.length} sets${isCombined ? ' (Combined)' : ''}`;
      if (tonnageText) tonnageText.textContent = `+${formatNumber(totalTonnage)} ${unitLabel}`;
      executeBtn.disabled = false;
      executeBtn.textContent = `Import ${parsedActivities.length} Sets (${formatNumber(totalTonnage)} ${unitLabel})`;
    } else {
      if (summaryBox) summaryBox.style.display = 'none';
      executeBtn.disabled = true;
    }
  }

  pasteArea.addEventListener('input', parsePastedData);
  if (categorySelect) categorySelect.addEventListener('change', parsePastedData);
  if (exerciseNameInput) exerciseNameInput.addEventListener('input', parsePastedData);
  if (excludePrCheckbox) excludePrCheckbox.addEventListener('change', parsePastedData);

  executeBtn.addEventListener('click', async () => {
    if (parsedActivities.length === 0) return;

    const nickname = (userNickInput ? userNickInput.value.trim() : '') || 'GymMate';
    const avatarColor = userColorSelect ? userColorSelect.value : '#10b981';

    try {
      executeBtn.disabled = true;
      executeBtn.textContent = 'Importing...';

      const res = await state.client.post('/activities/batch', {
        room_slug: state.roomSlug,
        user_nickname: nickname,
        user_avatar_color: avatarColor,
        activities: parsedActivities,
      });

      if (res && res.success) {
        importModal.classList.add('hidden');
        pasteArea.value = '';
        FlyToast.success(`Successfully imported ${parsedActivities.length} sets for ${nickname}!`);
        if (onReloadState) await onReloadState();
        if (state.diorama) {
          state.diorama.spawnCelebrationBurst(`+${parsedActivities.length} sets!`);
        }
      }
    } catch (err) {
      FlyToast.error('Import failed: ' + err.message);
    } finally {
      executeBtn.disabled = false;
      parsePastedData();
    }
  });
}

export function setupActivityEditModal({ onReloadState } = {}) {
  const modal = document.getElementById('activityEditModal');
  const closeBtn = document.getElementById('closeActivityEditModalBtn');
  const form = document.getElementById('activityEditForm');
  const idInput = document.getElementById('activityEditId');
  const exInput = document.getElementById('activityEditExercise');
  const setsInput = document.getElementById('activityEditSets');
  const repsInput = document.getElementById('activityEditReps');
  const wtInput = document.getElementById('activityEditWeight');
  const notesInput = document.getElementById('activityEditNotes');
  const combinedCheckbox = document.getElementById('activityEditCombined');
  const isPrCheckbox = document.getElementById('activityEditIsPr');
  const togglePrBtn = document.getElementById('togglePrQuickBtn');
  const saveBtn = document.getElementById('saveActivityEditBtn');

  if (!modal || !form) return;

  window.openActivityEditModal = openActivityEditModal;

  function closeModal() {
    modal.classList.add('hidden');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (combinedCheckbox) {
    combinedCheckbox.addEventListener('change', () => {
      if (combinedCheckbox.checked && isPrCheckbox) {
        isPrCheckbox.checked = false;
      }
    });
  }

  if (isPrCheckbox) {
    isPrCheckbox.addEventListener('change', () => {
      if (isPrCheckbox.checked && combinedCheckbox) {
        combinedCheckbox.checked = false;
      }
    });
  }

  if (togglePrBtn) {
    togglePrBtn.addEventListener('click', async () => {
      const actId = idInput?.value;
      if (!actId) return;
      try {
        togglePrBtn.disabled = true;
        togglePrBtn.textContent = 'Updating...';
        const res = await state.client.post(`/activities/${actId}/toggle-pr`, {});
        if (res && res.success) {
          FlyToast.success('PR status updated!');
          closeModal();
          if (onReloadState) await onReloadState();
        } else {
          FlyToast.error(res?.error || 'Failed to update PR status');
        }
      } catch (err) {
        FlyToast.error('Network error toggling PR');
      } finally {
        togglePrBtn.disabled = false;
        togglePrBtn.textContent = 'Toggle PR';
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const actId = idInput?.value;
    if (!actId) return;

    const payload = {
      exercise_name: exInput?.value.trim() || 'Exercise',
      sets: parseInt(setsInput?.value, 10) || 1,
      reps: parseInt(repsInput?.value, 10) || 1,
      weight_per_rep: parseFloat(wtInput?.value) || 0,
      notes: notesInput?.value.trim() || '',
      is_combined: combinedCheckbox ? combinedCheckbox.checked : false,
      is_pr: isPrCheckbox ? isPrCheckbox.checked : false,
    };

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }
      const res = await state.client.post(`/activities/${actId}/update`, payload);
      if (res && res.success) {
        FlyToast.success('Activity updated!');
        closeModal();
        if (onReloadState) await onReloadState();
      } else {
        FlyToast.error(res?.error || 'Failed to update activity');
      }
    } catch (err) {
      FlyToast.error('Network error updating activity');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  });
}

export function openActivityEditModal(act) {
  const modal = document.getElementById('activityEditModal');
  if (!modal || !act) return;

  const idInput = document.getElementById('activityEditId');
  const exInput = document.getElementById('activityEditExercise');
  const setsInput = document.getElementById('activityEditSets');
  const repsInput = document.getElementById('activityEditReps');
  const wtInput = document.getElementById('activityEditWeight');
  const metricLabel = document.getElementById('activityEditMetricLabel');
  const notesInput = document.getElementById('activityEditNotes');
  const combinedCheckbox = document.getElementById('activityEditCombined');
  const isPrCheckbox = document.getElementById('activityEditIsPr');
  const togglePrBtn = document.getElementById('togglePrQuickBtn');

  if (idInput) idInput.value = act.id;
  if (exInput) exInput.value = act.exercise_name || '';
  if (setsInput) setsInput.value = act.sets || 1;
  if (repsInput) repsInput.value = act.reps || 1;
  if (wtInput) wtInput.value = act.weight_per_rep || 0;
  if (notesInput) notesInput.value = act.notes || '';
  if (combinedCheckbox) combinedCheckbox.checked = !!act.is_combined;
  if (isPrCheckbox) isPrCheckbox.checked = !!act.is_pr;

  if (metricLabel) {
    if (act.activity_type === 'distance') metricLabel.textContent = 'Miles';
    else if (act.activity_type === 'elevation') metricLabel.textContent = 'Elevation';
    else metricLabel.textContent = 'Weight (ea)';
  }

  if (togglePrBtn) {
    togglePrBtn.textContent = act.is_pr ? 'Exclude from PR' : 'Mark as PR';
  }

  modal.classList.remove('hidden');
}

export function setupModals({ onReloadState, onSwitchView } = {}) {
  const profileModal = document.getElementById('profileModal');
  const roomModal = document.getElementById('roomModal');
  const aboutModal = document.getElementById('aboutModal');
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
    if (avatarPreviewChip) {
      avatarPreviewChip.style.backgroundColor = selectedColor;
    }
    if (avatarEditChip) {
      avatarEditChip.style.backgroundColor = selectedColor;
    }
    const currentNick = (nickInput ? nickInput.value.trim() : '') || 'Athlete';
    if (avatarPreviewName) {
      avatarPreviewName.textContent = currentNick;
    }
    if (avatarEditName) {
      avatarEditName.textContent = currentNick;
    }
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

  if (startEditProfileBtn) {
    startEditProfileBtn.addEventListener('click', showProfileEdit);
  }
  if (cancelProfileEditBtn) {
    cancelProfileEditBtn.addEventListener('click', cancelProfileEdit);
  }

  function renderProfileTelemetry() {
    if (!state.currentRoomData || !state.currentRoomData.user_profile) return;
    const user = state.currentRoomData.user_profile;
    const myToken = user.user_token;

    // Header avatar & streak preview
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

    // Stats Grid Calculation
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

    // Populate PRs Card
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

    // Populate Recent Developments (Personal Activity Feed)
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

  // Multi-squad & dual sharing elements
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
  const shareAppUrlInput = document.getElementById('shareAppUrlInput');
  const copyAppUrlBtn = document.getElementById('copyAppUrlBtn');
  const nativeShareAppBtn = document.getElementById('nativeShareAppBtn');
  const appQrImage = document.getElementById('appQrImage');

  function populateSquadHubFields() {
    const isSolo = state.roomSlug.startsWith('solo-');
    const myNick = state.currentRoomData?.user_profile?.nickname || 'Athlete';
    const defaultSquadName = (myNick && myNick !== 'Athlete') ? `${myNick}'s Squad` : 'Pando Squad';

    if (roomSlugInput) roomSlugInput.value = state.roomSlug;
    if (currentRoomSlugLabel) {
      currentRoomSlugLabel.textContent = `slug: ${state.roomSlug}`;
    }

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

    // Toggle Solo vs Squad Mode in Details Card
    if (soloStatusNotice) soloStatusNotice.style.display = isSolo ? 'block' : 'none';
    if (renameSquadControls) renameSquadControls.style.display = isSolo ? 'none' : 'flex';

    // Populate Your Squads List
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

      if (userSquads.length === 0) {
        userSquadsList.innerHTML = soloItemHtml + `
          <div style="text-align: center; padding: 10px; color: var(--text-muted); font-size: 0.76rem;">
            No squads yet. Create one below to invite friends!
          </div>
        `;
      } else {
        userSquadsList.innerHTML = soloItemHtml + squadCardsHtml;
      }

      userSquadsList.querySelectorAll('.user-squad-item').forEach(item => {
        item.addEventListener('click', () => {
          const slug = item.dataset.slug;
          if (slug === '__solo__') {
            if (!isSolo) {
              try {
                localStorage.removeItem('tardigrade_current_room');
              } catch (_) {}
              window.location.href = '/';
            }
          } else if (slug && slug !== state.roomSlug) {
            try {
              localStorage.setItem('tardigrade_current_room', slug);
            } catch (_) {}
            window.location.href = `/r/${slug}`;
          }
        });
      });
    }

    // Quick Solo Button Status
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

    // Current Squad Rename Card (hide when in private Solo mode)
    if (currentSquadCard) {
      currentSquadCard.style.display = isSolo ? 'none' : 'block';
    }

    // Section 2D: Share Your Squad (or Solo Prompt)
    if (isSolo) {
      if (soloSharePrompt) soloSharePrompt.style.display = 'block';
      if (squadShareActiveControls) squadShareActiveControls.style.display = 'none';
      if (shareSquadStatusBadge) shareSquadStatusBadge.textContent = 'Solo';
      if (promptSquadNameInput) {
        if (!promptSquadNameInput.value) {
          promptSquadNameInput.value = defaultSquadName;
        }
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

    // Section 2E: Share Tardigrade Tough (App)
    const appUrl = `${window.location.origin}/`;
    if (shareAppUrlInput) shareAppUrlInput.value = appUrl;
    if (appQrImage) appQrImage.src = `/api/qr?url=${encodeURIComponent(appUrl)}`;
    if (nativeShareAppBtn && typeof navigator.share === 'function') {
      nativeShareAppBtn.style.display = 'block';
    }

    // Populate Squad Members Roster
    const members = state.currentRoomData?.members || [];
    const creatorToken = state.currentRoomData?.room?.creator_token || '';
    const isCreator = (!isSolo && creatorToken && creatorToken === state.client.token)
      || (!isSolo && members.length === 1 && members[0]?.user_token === state.client.token)
      || (!isSolo && !creatorToken);

    if (squadMemberCount) {
      squadMemberCount.textContent = members.length;
    }

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

    if (leaveSquadBtn) {
      leaveSquadBtn.style.display = isSolo ? 'none' : 'block';
    }

    if (squadMembersCard) {
      squadMembersCard.style.display = isSolo ? 'none' : 'block';
    }

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

        // Attach remove handlers
        squadMembersList.querySelectorAll('.btn-remove-member').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const targetToken = btn.dataset.token;
            const targetNick = btn.dataset.nick || 'this member';
            if (!confirm(`Are you sure you want to remove "${targetNick}" from this squad?`)) {
              return;
            }
            try {
              const res = await state.client.post(`/room/${state.roomSlug}/members/${targetToken}/remove`);
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
        // Toggle closed: revert to Bear emoji if no chip was selected
        const anyChipSelected = Array.from(document.querySelectorAll('.emoji-chip')).some(c => c.classList.contains('selected'));
        if (!anyChipSelected) {
          selectedEmoji = '🐻';
        }
        syncEmojiSelectionUI();
      } else {
        // Reveal initials input mode
        if (initialsContainer) initialsContainer.style.display = 'block';
        if (toggleInitialsBtn) toggleInitialsBtn.classList.add('active');
        if (initialsToggleText) initialsToggleText.textContent = 'Initials Active';
        document.querySelectorAll('.emoji-chip').forEach(c => c.classList.remove('selected'));
        if (initialsInput) {
          if (!initialsInput.value.trim()) {
            initialsInput.value = getDefaultNicknameInitial();
          }
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
      try {
        localStorage.removeItem('tardigrade_current_room');
      } catch (_) {}
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
          try {
            localStorage.setItem('tardigrade_current_room', res.data.slug);
          } catch (_) {}
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
          try {
            localStorage.setItem('tardigrade_current_room', res.data.slug);
          } catch (_) {}
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

  // Copy Main App URL
  if (copyAppUrlBtn && shareAppUrlInput) {
    copyAppUrlBtn.addEventListener('click', async () => {
      const url = shareAppUrlInput.value || `${window.location.origin}/`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          shareAppUrlInput.select();
          document.execCommand('copy');
        }
        FlyToast.success('Tardigrade Tough app link copied!');
      } catch (_) {
        shareAppUrlInput.select();
        document.execCommand('copy');
        FlyToast.success('Tardigrade Tough app link copied!');
      }
    });
  }

  // Native Share Main App
  if (nativeShareAppBtn && typeof navigator.share === 'function') {
    nativeShareAppBtn.style.display = 'block';
    nativeShareAppBtn.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: 'Tardigrade Tough — Gym & Beast Progress Tracker',
          text: 'Collaborative gym progress tracker on Tardigrade Tough',
          url: shareAppUrlInput ? shareAppUrlInput.value : `${window.location.origin}/`,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share app aborted or failed:', err);
        }
      }
    });
  }

  // Join Existing
  const switchRoomBtn = document.getElementById('switchRoomBtn');
  if (switchRoomBtn && roomSlugInput) {
    switchRoomBtn.addEventListener('click', () => {
      const targetSlug = roomSlugInput.value.trim().toLowerCase();
      if (targetSlug && targetSlug !== state.roomSlug) {
        try {
          localStorage.setItem('tardigrade_current_room', targetSlug);
        } catch (e) {}
        window.location.href = `/r/${targetSlug}`;
      }
    });
  }

  // Leave Squad Button
  if (leaveSquadBtn) {
    leaveSquadBtn.addEventListener('click', async () => {
      const squadName = state.currentRoomData?.room?.name || 'this squad';
      if (!confirm(`Leave "${squadName}"?`)) {
        return;
      }
      try {
        const res = await state.client.post(`/room/${state.roomSlug}/leave`);
        if (res && res.success) {
          try {
            localStorage.removeItem('tardigrade_current_room');
          } catch (_) {}
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

  // Wishlist Modal Handling
  const wishlistModal = document.getElementById('wishlistModal');
  const wishlistForm = document.getElementById('wishlistForm');
  const wishlistCatSelect = document.getElementById('wishlistCategorySelect');
  const wishlistUnitSelect = document.getElementById('wishlistUnitSelect');
  const customCatRow = document.getElementById('wishlistCustomCategoryRow');
  const customCatInput = document.getElementById('wishlistCustomCategoryInput');
  const customUnitRow = document.getElementById('wishlistCustomUnitRow');
  const customUnitInput = document.getElementById('wishlistCustomUnitInput');

  function openWishlistModal() {
    if (wishlistModal) {
      wishlistModal.classList.remove('hidden');
      const titleInput = document.getElementById('wishlistTitleInput');
      if (titleInput) {
        titleInput.value = '';
        setTimeout(() => titleInput.focus(), 80);
      }
      const targetInput = document.getElementById('wishlistTargetInput');
      if (targetInput) targetInput.value = '';
      const notesInput = document.getElementById('wishlistNotesInput');
      if (notesInput) notesInput.value = '';
      if (customCatInput) customCatInput.value = '';
      if (customUnitInput) customUnitInput.value = '';
      if (customCatRow) customCatRow.style.display = 'none';
      if (customUnitRow) customUnitRow.style.display = 'none';
      if (wishlistCatSelect) wishlistCatSelect.value = 'weight';
      if (wishlistUnitSelect) wishlistUnitSelect.value = 'lbs';
    }
  }

  function closeWishlistModal() {
    if (wishlistModal) wishlistModal.classList.add('hidden');
  }

  if (wishlistCatSelect && wishlistUnitSelect) {
    wishlistCatSelect.addEventListener('change', () => {
      const cat = wishlistCatSelect.value;
      if (cat === 'custom') {
        if (customCatRow) customCatRow.style.display = 'block';
        if (customCatInput) setTimeout(() => customCatInput.focus(), 50);
        wishlistUnitSelect.value = 'custom_unit';
        if (customUnitRow) customUnitRow.style.display = 'block';
      } else {
        if (customCatRow) customCatRow.style.display = 'none';
        if (customUnitRow) customUnitRow.style.display = 'none';
        if (cat === 'weight') wishlistUnitSelect.value = 'lbs';
        else if (cat === 'distance') wishlistUnitSelect.value = 'mi';
        else if (cat === 'elevation') wishlistUnitSelect.value = 'ft';
        else if (cat === 'ability') {
          wishlistUnitSelect.value = 'feat';
          const targetIn = document.getElementById('wishlistTargetInput');
          if (targetIn && (!targetIn.value || targetIn.value === '0')) targetIn.value = '1';
        }
      }
    });

    wishlistUnitSelect.addEventListener('change', () => {
      if (wishlistUnitSelect.value === 'custom_unit') {
        if (customUnitRow) customUnitRow.style.display = 'block';
        if (customUnitInput) setTimeout(() => customUnitInput.focus(), 50);
      } else {
        if (customUnitRow) customUnitRow.style.display = 'none';
      }
    });
  }

  if (wishlistForm) {
    wishlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('wishlistTitleInput')?.value?.trim();
      let category = wishlistCatSelect?.value || 'weight';
      let unit = wishlistUnitSelect?.value || 'lbs';
      let targetVal = parseFloat(document.getElementById('wishlistTargetInput')?.value);
      const notes = document.getElementById('wishlistNotesInput')?.value?.trim() || '';

      if (category === 'ability' && (isNaN(targetVal) || targetVal <= 0)) {
        targetVal = 1;
      }

      if (category === 'custom') {
        const customCatVal = customCatInput?.value?.trim();
        if (!customCatVal) {
          FlyToast.error('Please enter a custom category name');
          return;
        }
        category = customCatVal.toLowerCase();
      }

      if (unit === 'custom_unit') {
        const customUnitVal = customUnitInput?.value?.trim();
        if (!customUnitVal) {
          FlyToast.error('Please enter a custom unit');
          return;
        }
        unit = customUnitVal;
      }

      if (!title) {
        FlyToast.error('Please enter a quest title');
        return;
      }
      if (isNaN(targetVal) || targetVal <= 0) {
        FlyToast.error('Target value must be greater than 0');
        return;
      }

      try {
        const res = await state.client.post('/goals/wishlist', {
          room_slug: state.roomSlug,
          title,
          category,
          target_value: targetVal,
          unit,
          notes,
          user_nickname: state.userProfile?.nickname || '',
        });

        if (res && res.success) {
          FlyToast.success(`✨ Proposed "${title}"!`);
          closeWishlistModal();
          if (onReloadState) await onReloadState();
        } else {
          FlyToast.error(res?.error || 'Failed to submit proposal');
        }
      } catch (err) {
        console.error('Wishlist error:', err);
        FlyToast.error('Failed to submit proposal');
      }
    });
  }

  // Document-level delegation for modal buttons & footer triggers
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openWishlistBtn') || e.target.closest('#openWishlistFromQuestsBtn')) {
      e.preventDefault();
      openWishlistModal();
      return;
    }
    if (e.target.closest('#closeWishlistBtn')) {
      e.preventDefault();
      closeWishlistModal();
      return;
    }
    if (e.target.closest('#footerAboutBtn')) {
      e.preventDefault();
      if (aboutModal) aboutModal.classList.remove('hidden');
      return;
    }
    if (e.target.closest('#footerContactBtn')) {
      e.preventDefault();
      if (aboutModal) {
        aboutModal.classList.remove('hidden');
        const contactSec = document.getElementById('aboutStorySection') || document.getElementById('aboutContactSection');
        if (contactSec) {
          setTimeout(() => {
            contactSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 80);
        }
      }
      return;
    }
    if (e.target.closest('#closeAboutBtn')) {
      e.preventDefault();
      if (aboutModal) aboutModal.classList.add('hidden');
      return;
    }
    if (e.target.closest('#footerShareBtn')) {
      e.preventDefault();
      openHub('squad');
      return;
    }
    if (e.target.closest('#closeRoomBtn')) {
      e.preventDefault();
      closeHub();
      return;
    }
    const actBtn = e.target.closest('.activate-quest-btn');
    if (actBtn) {
      e.preventDefault();
      const title = actBtn.dataset.title;
      const category = actBtn.dataset.cat;
      const targetVal = parseFloat(actBtn.dataset.val);
      const unit = actBtn.dataset.unit;
      const notes = actBtn.dataset.notes || '';

      const confirmMsg = `Activate "${title}" (${formatNumber(targetVal)} ${unit})?`;
      if (!window.confirm(confirmMsg)) return;

      actBtn.disabled = true;
      const themeKey = category === 'weight' ? 'pando' : category === 'distance' ? 'caribou' : (category === 'elevation' ? 'everest' : (category === 'ability' ? 'feat' : 'custom'));
      state.client.post('/goals', {
        room_slug: state.roomSlug,
        title,
        category,
        target_value: targetVal,
        unit,
        theme_key: themeKey,
        description: notes || title,
      }).then(res => {
        if (res && res.success) {
          FlyToast.success(`🚀 "${title}" activated!`);
          if (onReloadState) {
            onReloadState().then(() => {
              if (onSwitchView) onSwitchView('quests');
              else if (window.switchView) window.switchView('quests');
            });
          }
        } else {
          FlyToast.error(res?.error || 'Failed to activate quest');
          actBtn.disabled = false;
        }
      }).catch(err => {
        console.error('Failed to activate quest:', err);
        FlyToast.error('Failed to activate quest');
        actBtn.disabled = false;
      });
      return;
    }
  });

  // Create Quest Modal
  const createQuestModal = document.getElementById('createQuestModal');
  const openNewQuestBtn = document.getElementById('openNewQuestBtn');
  const closeCreateQuestBtn = document.getElementById('closeCreateQuestBtn');
  const cancelCreateQuestBtn = document.getElementById('cancelCreateQuestBtn');
  const submitCreateQuestBtn = document.getElementById('submitCreateQuestBtn');
  const questTitleInput = document.getElementById('questTitleInput');
  const questCategorySelect = document.getElementById('questCategorySelect');
  const questUnitSelect = document.getElementById('questUnitSelect');
  const questTargetInput = document.getElementById('questTargetInput');
  const questTargetGroup = document.getElementById('questTargetGroup');
  const questThemePicker = document.getElementById('questThemePicker');

  let selectedQuestTheme = 'volcano';

  if (questThemePicker) {
    questThemePicker.querySelectorAll('.quest-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        questThemePicker.querySelectorAll('.quest-theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedQuestTheme = btn.dataset.theme || 'volcano';
      });
    });
  }

  if (questCategorySelect && questUnitSelect) {
    questCategorySelect.addEventListener('change', () => {
      const cat = questCategorySelect.value;
      if (cat === 'weight') {
        questUnitSelect.value = 'lbs';
        if (questTargetGroup) questTargetGroup.style.display = 'block';
      } else if (cat === 'distance') {
        questUnitSelect.value = 'mi';
        if (questTargetGroup) questTargetGroup.style.display = 'block';
      } else if (cat === 'elevation') {
        questUnitSelect.value = 'ft';
        if (questTargetGroup) questTargetGroup.style.display = 'block';
      } else if (cat === 'ability') {
        questUnitSelect.value = 'feat';
        if (questTargetInput) questTargetInput.value = '1';
        if (questTargetGroup) questTargetGroup.style.display = 'none';
        selectedQuestTheme = 'feat';
        if (questThemePicker) {
          questThemePicker.querySelectorAll('.quest-theme-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === 'feat');
          });
        }
      }
    });
  }

  function openCreateQuestModal() {
    if (!createQuestModal) return;
    createQuestModal.classList.remove('hidden');
    if (questTitleInput) {
      questTitleInput.value = '';
      setTimeout(() => questTitleInput.focus(), 80);
    }
    if (questTargetInput) questTargetInput.value = '';
    if (questTargetGroup) questTargetGroup.style.display = 'block';
    if (questCategorySelect) questCategorySelect.value = 'weight';
    if (questUnitSelect) questUnitSelect.value = 'lbs';
    selectedQuestTheme = 'volcano';
    if (questThemePicker) {
      questThemePicker.querySelectorAll('.quest-theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === 'volcano');
      });
    }
  }

  function closeCreateQuestModal() {
    if (createQuestModal) createQuestModal.classList.add('hidden');
  }

  if (openNewQuestBtn) {
    openNewQuestBtn.addEventListener('click', openCreateQuestModal);
  }
  if (closeCreateQuestBtn) {
    closeCreateQuestBtn.addEventListener('click', closeCreateQuestModal);
  }
  if (cancelCreateQuestBtn) {
    cancelCreateQuestBtn.addEventListener('click', closeCreateQuestModal);
  }

  if (submitCreateQuestBtn) {
    submitCreateQuestBtn.addEventListener('click', async () => {
      const title = questTitleInput ? questTitleInput.value.trim() : '';
      const category = questCategorySelect ? questCategorySelect.value : 'weight';
      const unit = questUnitSelect ? questUnitSelect.value : 'lbs';
      let targetVal = questTargetInput ? parseFloat(questTargetInput.value) : 0;

      if (category === 'ability') {
        targetVal = 1;
        if (!selectedQuestTheme || selectedQuestTheme === 'volcano') selectedQuestTheme = 'feat';
      }

      if (!title) {
        FlyToast.error('Please enter a quest title');
        return;
      }
      if (isNaN(targetVal) || targetVal <= 0) {
        FlyToast.error('Target value must be greater than 0');
        return;
      }

      submitCreateQuestBtn.disabled = true;
      submitCreateQuestBtn.textContent = 'Creating...';
      try {
        const res = await state.client.post('/goals', {
          room_slug: state.roomSlug,
          title,
          category,
          target_value: targetVal,
          unit,
          theme_key: selectedQuestTheme,
          description: title,
        });
        if (res && res.success) {
          FlyToast.success(`✨ Quest "${title}" created!`);
          closeCreateQuestModal();
          if (onReloadState) await onReloadState();
          if (onSwitchView) onSwitchView('quests');
          else if (window.switchView) window.switchView('quests');
        } else {
          FlyToast.error(res?.error || 'Failed to create quest');
        }
      } catch (err) {
        console.error('Create quest error:', err);
        FlyToast.error('Failed to create quest');
      } finally {
        submitCreateQuestBtn.disabled = false;
        submitCreateQuestBtn.textContent = 'Create';
      }
    });
  }

  // Close modals when clicking backdrop outside modal-box
  [profileModal, roomModal, aboutModal, wishlistModal, createQuestModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeHub();
        if (aboutModal) aboutModal.classList.add('hidden');
        if (wishlistModal) wishlistModal.classList.add('hidden');
        if (createQuestModal) createQuestModal.classList.add('hidden');
      }
    });
  });
}
