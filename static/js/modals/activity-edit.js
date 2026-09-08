import { FlyToast } from '/_fly/fly-ui.js';
import { state } from '../state.js';

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
  const privateCheckbox = document.getElementById('activityEditIsPrivate');
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

    const actType = modal.dataset.actType || 'weight';
    const numVal = parseFloat(wtInput?.value) || 0;

    const payload = {
      exercise_name: exInput?.value.trim() || 'Exercise',
      sets: parseInt(setsInput?.value, 10) || 1,
      reps: parseInt(repsInput?.value, 10) || 1,
      notes: notesInput?.value.trim() || '',
      is_combined: combinedCheckbox ? combinedCheckbox.checked : false,
      is_pr: isPrCheckbox ? isPrCheckbox.checked : false,
      is_private: privateCheckbox ? privateCheckbox.checked : false,
    };

    if (actType === 'distance') {
      payload.distance_val = numVal;
      payload.total_metric = numVal;
      payload.weight_per_rep = 0;
    } else if (actType === 'elevation') {
      payload.elevation_val = numVal;
      payload.total_metric = numVal;
      payload.weight_per_rep = 0;
    } else {
      payload.weight_per_rep = numVal;
      payload.total_metric = payload.sets * payload.reps * numVal;
    }

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
  const privateCheckbox = document.getElementById('activityEditIsPrivate');
  const togglePrBtn = document.getElementById('togglePrQuickBtn');

  modal.dataset.actType = act.activity_type || 'weight';

  if (idInput) idInput.value = act.id;
  if (exInput) exInput.value = act.exercise_name || '';
  if (setsInput) setsInput.value = act.sets || 1;
  if (repsInput) repsInput.value = act.reps || 1;
  if (notesInput) notesInput.value = act.notes || '';
  if (combinedCheckbox) combinedCheckbox.checked = !!act.is_combined;
  if (isPrCheckbox) isPrCheckbox.checked = !!act.is_pr;
  if (privateCheckbox) privateCheckbox.checked = !!act.is_private;

  if (metricLabel && wtInput) {
    if (act.activity_type === 'distance') {
      metricLabel.textContent = 'Distance (mi)';
      wtInput.value = act.distance_val > 0 ? act.distance_val : (act.total_metric || 0);
    } else if (act.activity_type === 'elevation') {
      metricLabel.textContent = 'Elevation (ft)';
      wtInput.value = act.elevation_val > 0 ? act.elevation_val : (act.total_metric || 0);
    } else {
      metricLabel.textContent = 'Weight (ea)';
      wtInput.value = act.weight_per_rep || 0;
    }
  }

  if (togglePrBtn) {
    togglePrBtn.textContent = act.is_pr ? 'Exclude from PR' : 'Mark as PR';
  }

  modal.classList.remove('hidden');
}
