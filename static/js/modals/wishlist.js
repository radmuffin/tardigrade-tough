import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from '../state.js';

export function setupWishlistModal({ onReloadState } = {}) {
  const wishlistModal = document.getElementById('wishlistModal');
  const wishlistForm = document.getElementById('wishlistForm');
  const wishlistCatSelect = document.getElementById('wishlistCategorySelect');
  const wishlistUnitSelect = document.getElementById('wishlistUnitSelect');
  const customCatRow = document.getElementById('wishlistCustomCategoryRow');
  const customCatInput = document.getElementById('wishlistCustomCategoryInput');
  const customUnitRow = document.getElementById('wishlistCustomUnitRow');
  const customUnitInput = document.getElementById('wishlistCustomUnitInput');

  if (!wishlistModal) return {};

  function openWishlistModal() {
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

  function closeWishlistModal() {
    wishlistModal.classList.add('hidden');
  }

  wishlistModal.addEventListener('click', (e) => {
    if (e.target === wishlistModal) closeWishlistModal();
  });

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

  return { openWishlistModal, closeWishlistModal };
}
