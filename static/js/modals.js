import { FlyToast, FlyTheme } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

export function setupSheetImporter({ onReloadState } = {}) {
  const importModal = document.getElementById('importModal');
  const openBtn = document.getElementById('openImportModalBtn');
  const closeBtn = document.getElementById('closeImportBtn');
  const pasteArea = document.getElementById('importPasteArea');
  const userNickInput = document.getElementById('importUserNick');
  const userColorSelect = document.getElementById('importUserColor');
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

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/[\t,;]+/).map(p => p.trim()).filter(Boolean);

      let weight = 0;
      let reps = 1;
      let sets = 1;
      let calculatedTotal = 0;

      if (parts.length >= 2) {
        weight = parseFloat(parts[0]) || 0;
        reps = parseInt(parts[1], 10) || 1;
        calculatedTotal = weight * reps;
      } else if (parts.length === 1) {
        const spaceParts = trimmed.split(/\s+/);
        if (spaceParts.length >= 2) {
          weight = parseFloat(spaceParts[0]) || 0;
          reps = parseInt(spaceParts[1], 10) || 1;
          calculatedTotal = weight * reps;
        } else {
          calculatedTotal = parseFloat(parts[0]) || 0;
          weight = calculatedTotal;
          reps = 1;
        }
      }

      if (calculatedTotal > 0) {
        totalTonnage += calculatedTotal;
        parsedActivities.push({
          room_slug: state.roomSlug,
          activity_type: 'weight',
          exercise_name: 'Sheet Lift',
          sets,
          reps,
          weight_per_rep: weight,
          total_metric: calculatedTotal,
          notes: `Sheet Row #${idx + 1}`,
        });
      }
    });

    if (parsedActivities.length > 0) {
      if (summaryBox) summaryBox.style.display = 'flex';
      if (summaryText) summaryText.textContent = `Parsed: ${parsedActivities.length} sets`;
      if (tonnageText) tonnageText.textContent = `+${formatNumber(totalTonnage)} lbs`;
      executeBtn.disabled = false;
      executeBtn.textContent = `Import ${parsedActivities.length} Sets (${formatNumber(totalTonnage)} lbs)`;
    } else {
      if (summaryBox) summaryBox.style.display = 'none';
      executeBtn.disabled = true;
    }
  }

  pasteArea.addEventListener('input', parsePastedData);

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

export function setupModals({ onReloadState, onSwitchView } = {}) {
  const profileModal = document.getElementById('profileModal');
  const roomModal = document.getElementById('roomModal');
  const aboutModal = document.getElementById('aboutModal');
  const nickInput = document.getElementById('nickInput');
  let selectedColor = '#10b981';

  const tabBtnProfile = document.getElementById('tabBtnProfile');
  const tabBtnSquad = document.getElementById('tabBtnSquad');
  const hubPaneProfile = document.getElementById('hubPaneProfile');
  const hubPaneSquad = document.getElementById('hubPaneSquad');

  const roomSlugInput = document.getElementById('roomSlugInput');
  const newRoomNameInput = document.getElementById('newRoomNameInput');
  const qrImg = document.getElementById('roomQrImage');
  const editRoomNameInput = document.getElementById('editRoomNameInput');
  const saveRoomNameBtn = document.getElementById('saveRoomNameBtn');
  const shareRoomUrlInput = document.getElementById('shareRoomUrlInput');
  const copyRoomUrlBtn = document.getElementById('copyRoomUrlBtn');
  const nativeShareBtn = document.getElementById('nativeShareBtn');
  const currentRoomSlugLabel = document.getElementById('currentRoomSlugLabel');
  const squadMembersList = document.getElementById('squadMembersList');
  const squadMemberCount = document.getElementById('squadMemberCount');
  const squadRoleBadge = document.getElementById('squadRoleBadge');
  const leaveSquadBtn = document.getElementById('leaveSquadBtn');

  function populateSquadHubFields() {
    if (roomSlugInput) roomSlugInput.value = state.roomSlug;
    if (currentRoomSlugLabel) {
      currentRoomSlugLabel.textContent = `slug: ${state.roomSlug}`;
    }
    if (state.currentRoomData && state.currentRoomData.room) {
      if (editRoomNameInput) editRoomNameInput.value = state.currentRoomData.room.name;
      const label = document.getElementById('roomNameLabel');
      if (label) label.textContent = state.currentRoomData.room.name;
    }
    const roomUrl = `${window.location.origin}/r/${state.roomSlug}`;
    if (shareRoomUrlInput) {
      shareRoomUrlInput.value = roomUrl;
    }
    if (qrImg) {
      qrImg.src = `/api/qr?url=${encodeURIComponent(roomUrl)}`;
    }
    if (nativeShareBtn && typeof navigator.share === 'function') {
      nativeShareBtn.style.display = 'block';
    }

    // Populate Squad Members Roster
    const members = state.currentRoomData?.members || [];
    const creatorToken = state.currentRoomData?.room?.creator_token || '';
    const isSolo = state.roomSlug.startsWith('solo-');
    const isCreator = (!isSolo && creatorToken && creatorToken === state.client.token)
      || (!isSolo && members.length === 1 && members[0]?.user_token === state.client.token)
      || (!isSolo && !creatorToken);

    if (squadMemberCount) {
      squadMemberCount.textContent = members.length;
    }

    if (squadRoleBadge) {
      if (isSolo) {
        squadRoleBadge.textContent = 'Solo Quest';
        squadRoleBadge.style.color = 'var(--accent-cyan)';
      } else if (isCreator) {
        squadRoleBadge.textContent = '👑 You are Squad Creator';
        squadRoleBadge.style.color = 'var(--accent-amber)';
      } else {
        squadRoleBadge.textContent = 'Crew Member';
        squadRoleBadge.style.color = 'var(--text-muted)';
      }
    }

    if (leaveSquadBtn) {
      if (isSolo) {
        leaveSquadBtn.style.display = 'none';
      } else {
        leaveSquadBtn.style.display = 'block';
      }
    }

    if (squadMembersList) {
      if (members.length === 0) {
        squadMembersList.innerHTML = `<div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 0.8rem;">No members recorded yet.</div>`;
      } else {
        squadMembersList.innerHTML = members.map(m => {
          const isMe = m.user_token === state.client.token;
          const isThisCreator = m.is_creator || (creatorToken && m.user_token === creatorToken);
          const canRemove = isCreator && !isMe;
          const avatarColor = FlyToast.escape(m.avatar_color || '#10b981');
          const nick = FlyToast.escape(m.nickname || 'Athlete');

          return `
            <div class="squad-member-item" data-token="${FlyToast.escape(m.user_token)}">
              <div class="member-left">
                <span class="member-dot" style="background-color: ${avatarColor};"></span>
                <div class="member-info">
                  <div class="member-name-row">
                    <strong class="member-nick">${nick}</strong>
                    ${isMe ? '<span class="member-pill pill-me">You</span>' : ''}
                    ${isThisCreator ? '<span class="member-pill pill-creator">👑 Creator</span>' : ''}
                  </div>
                  <span class="member-metric-label">${m.total_sets || 0} sets logged</span>
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
      populateSquadHubFields();
      if (hubPaneSquad) {
        hubPaneSquad.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (tabBtnProfile) {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
      }
      if (tabBtnSquad) {
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
      if (hubPaneProfile) {
        hubPaneProfile.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  if (tabBtnProfile) tabBtnProfile.addEventListener('click', () => selectHubTab('profile'));
  if (tabBtnSquad) tabBtnSquad.addEventListener('click', () => selectHubTab('squad'));

  // Sync active nav pill when user scrolls within consolidated hub
  const hubBox = profileModal ? profileModal.querySelector('.hub-modal-box') : null;
  if (hubBox && hubPaneSquad && tabBtnProfile && tabBtnSquad) {
    hubBox.addEventListener('scroll', () => {
      const squadTop = hubPaneSquad.offsetTop - hubBox.scrollTop;
      if (squadTop <= 110) {
        tabBtnSquad.classList.add('active');
        tabBtnSquad.setAttribute('aria-selected', 'true');
        tabBtnProfile.classList.remove('active');
        tabBtnProfile.setAttribute('aria-selected', 'false');
      } else {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
    }, { passive: true });
  }

  function openHub(tab = 'profile') {
    if (state.currentRoomData && state.currentRoomData.user_profile) {
      if (nickInput) nickInput.value = state.currentRoomData.user_profile.nickname;
      selectedColor = state.currentRoomData.user_profile.avatar_color;
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === selectedColor);
      });
    }
    populateSquadHubFields();
    if (profileModal) profileModal.classList.remove('hidden');
    if (roomModal) roomModal.classList.remove('hidden');

    if (tab === 'squad') {
      selectHubTab('squad');
    } else {
      if (tabBtnProfile) {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
      }
      if (tabBtnSquad) {
        tabBtnSquad.classList.remove('active');
        tabBtnSquad.setAttribute('aria-selected', 'false');
      }
      if (hubBox) hubBox.scrollTop = 0;
    }
  }

  function closeHub() {
    if (profileModal) profileModal.classList.add('hidden');
    if (roomModal) roomModal.classList.add('hidden');
  }

  window.openRoomModal = () => openHub('squad');

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', () => openHub('profile'));

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
    });
  });

  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const nick = nickInput ? nickInput.value.trim() : '';
      try {
        const res = await state.client.post('/users/profile', {
          nickname: nick,
          avatar_color: selectedColor,
        });
        if (res && res.success) {
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
        const squadTitle = state.currentRoomData?.room?.name || 'Tardigrade Tough Squad';
        await navigator.share({
          title: `${squadTitle} — Tardigrade Tough`,
          text: `Join our squad "${squadTitle}" on Tardigrade Tough and conquer colossal nature together!`,
          url: shareRoomUrlInput ? shareRoomUrlInput.value : window.location.href,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share aborted or failed:', err);
        }
      }
    });
  }

  // Create New Group or Solo Quest
  if (createNewRoomBtn) {
    createNewRoomBtn.addEventListener('click', () => {
      const name = newRoomNameInput ? newRoomNameInput.value.trim() : '';
      if (!name) {
        FlyToast.error('Please enter a group or solo name');
        return;
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `squad-${Date.now().toString(36)}`;
      try {
        localStorage.setItem('tardigrade_current_room', slug);
      } catch (e) {}
      window.location.href = `/r/${slug}`;
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
      if (!confirm(`Are you sure you want to leave "${squadName}"? You will return to your own private solo quest.`)) {
        return;
      }
      try {
        const res = await state.client.post(`/room/${state.roomSlug}/leave`);
        if (res && res.success) {
          try {
            localStorage.removeItem('tardigrade_current_room');
          } catch (_) {}
          FlyToast.info(`Left "${squadName}". Returned to Solo Quest.`);
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
      const targetVal = parseFloat(document.getElementById('wishlistTargetInput')?.value);
      const notes = document.getElementById('wishlistNotesInput')?.value?.trim() || '';

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
          FlyToast.success(`✨ Proposed "${title}"! View it on the Squad Wishlist in Trophy Room.`);
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

      const confirmMsg = `Promote "${title}" (${formatNumber(targetVal)} ${unit}) to an active mega-quest for this squad?`;
      if (!window.confirm(confirmMsg)) return;

      actBtn.disabled = true;
      const themeKey = category === 'weight' ? 'pando' : category === 'distance' ? 'caribou' : (category === 'elevation' ? 'everest' : 'custom');
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
          FlyToast.success(`🚀 "${title}" is now an active mega-quest!`);
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

  // Close modals when clicking backdrop outside modal-box
  [profileModal, roomModal, aboutModal, wishlistModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeHub();
        if (aboutModal) aboutModal.classList.add('hidden');
        if (wishlistModal) wishlistModal.classList.add('hidden');
      }
    });
  });
}
