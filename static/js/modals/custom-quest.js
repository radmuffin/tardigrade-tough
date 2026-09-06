import { FlyToast } from '/_fly/fly-ui.js';
import { state } from '../state.js';

export function setupCustomQuestModal({ onReloadState, onSwitchView } = {}) {
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

  if (!createQuestModal) return;

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
    createQuestModal.classList.add('hidden');
  }

  if (openNewQuestBtn) openNewQuestBtn.addEventListener('click', openCreateQuestModal);
  if (closeCreateQuestBtn) closeCreateQuestBtn.addEventListener('click', closeCreateQuestModal);
  if (cancelCreateQuestBtn) cancelCreateQuestBtn.addEventListener('click', closeCreateQuestModal);

  createQuestModal.addEventListener('click', (e) => {
    if (e.target === createQuestModal) closeCreateQuestModal();
  });

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

  return { openCreateQuestModal, closeCreateQuestModal };
}
