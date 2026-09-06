import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from '../state.js';

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
  const importPrivateCheckbox = document.getElementById('importPrivate');
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
    parsedActivities = [];
    const raw = pasteArea.value.trim();
    if (!raw) {
      if (summaryBox) summaryBox.style.display = 'none';
      executeBtn.disabled = true;
      return;
    }

    const cat = categorySelect ? categorySelect.value : 'weight';
    const defaultEx = (exerciseNameInput ? exerciseNameInput.value.trim() : '') || (cat === 'distance' ? 'Run / Walk' : cat === 'elevation' ? 'Climb / Hike' : 'Sheet Lift');
    const isCombined = excludePrCheckbox ? excludePrCheckbox.checked : false;
    const isPrivate = importPrivateCheckbox ? importPrivateCheckbox.checked : false;

    const lines = raw.split(/\r?\n/);
    let totalTonnage = 0;

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
          is_private: isPrivate,
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
  if (importPrivateCheckbox) importPrivateCheckbox.addEventListener('change', parsePastedData);

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
