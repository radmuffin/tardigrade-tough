import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';
import { setupSheetImporter } from './modals/sheet-importer.js';
import { setupActivityEditModal, openActivityEditModal } from './modals/activity-edit.js';
import { setupShareModal } from './modals/share-modal.js';
import { setupAboutModal } from './modals/about-modal.js';
import { setupCustomQuestModal } from './modals/custom-quest.js';
import { setupWishlistModal } from './modals/wishlist.js';
import { setupHubModal } from './modals/hub.js';

export { setupSheetImporter, setupActivityEditModal, openActivityEditModal };

export function setupModals({ onReloadState, onSwitchView } = {}) {
  const { openShareModal, closeShareModal } = setupShareModal();
  const { openAboutModal, closeAboutModal } = setupAboutModal();
  const { openCreateQuestModal, closeCreateQuestModal } = setupCustomQuestModal({ onReloadState, onSwitchView });
  const { openWishlistModal, closeWishlistModal } = setupWishlistModal({ onReloadState });
  const { openHub, closeHub, selectHubTab, populateSquadHubFields } = setupHubModal({ onReloadState });

  // Expose global modal openers
  window.openShareModal = openShareModal;
  window.openAboutModal = openAboutModal;
  window.openCreateQuestModal = openCreateQuestModal;
  window.openWishlistModal = openWishlistModal;
  window.openRoomModal = () => openHub('squad');

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
      openAboutModal(false);
      return;
    }

    if (e.target.closest('#footerShareBtn')) {
      e.preventDefault();
      openShareModal();
      return;
    }

    const actBtn = e.target.closest('.activate-quest-btn');
    if (actBtn) {
      e.preventDefault();
      const title = actBtn.dataset.title;
      const category = actBtn.dataset.cat;
      const targetVal = parseFloat(actBtn.dataset.val);
      const unit = actBtn.dataset.unit;

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
        description: title,
      }).then(async (res) => {
        if (res && res.success) {
          FlyToast.success(`Activated "${title}"!`);
          if (onReloadState) await onReloadState();
          if (onSwitchView) onSwitchView('quests');
        } else {
          FlyToast.error(res?.error || 'Failed to activate quest');
        }
      }).catch((err) => {
        console.error('Activate quest error:', err);
        FlyToast.error('Failed to activate quest');
      }).finally(() => {
        actBtn.disabled = false;
      });
    }
  });

  return {
    openHub,
    closeHub,
    selectHubTab,
    populateSquadHubFields,
    openShareModal,
    closeShareModal,
    openAboutModal,
    closeAboutModal,
    openCreateQuestModal,
    closeCreateQuestModal,
    openWishlistModal,
    closeWishlistModal,
  };
}
