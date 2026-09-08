import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber, isToday } from './state.js';
import { formatTimeAgo, deleteActivity } from './activity-feed.js';

export function getCustomExercises() {
  try {
    const stored = localStorage.getItem('tardigrade_custom_exercises');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomExercise(name) {
  if (!name || typeof name !== 'string') return;
  const clean = name.trim();
  if (!clean) return;
  const list = getCustomExercises();
  if (!list.some(e => e.toLowerCase() === clean.toLowerCase())) {
    list.push(clean);
    try {
      localStorage.setItem('tardigrade_custom_exercises', JSON.stringify(list));
    } catch (e) {}
  }
}

export function getCustomExerciseOptionsHtml() {
  const customList = getCustomExercises();
  if (customList.length === 0) return '';
  return customList.map(ex => `<option value="${FlyToast.escape(ex)}">✨ ${FlyToast.escape(ex)}</option>`).join('');
}

export function updateStepperForGoal(goal) {
  const exSelect = document.getElementById('stepperExercise');
  const exLabel = document.getElementById('stepperExerciseLabel');
  const metricLabel = document.getElementById('stepperMetricLabel');
  const countLabel = document.getElementById('stepperCountLabel');
  const routeLabel = document.getElementById('computedImpactRoute');
  const metricPresets = document.getElementById('stepperMetricPresets');
  const wtInput = document.getElementById('stepperWeight');
  const customOpts = getCustomExerciseOptionsHtml();
  const tabAbility = document.getElementById('modeAbilityBtn');
  const panelAbility = document.getElementById('panelAbilityCheckoff');

  if (goal && goal.category === 'ability') {
    if (tabAbility) tabAbility.style.display = 'inline-block';
    const featEmoji = document.getElementById('abilityFeatEmoji');
    const featTitle = document.getElementById('abilityFeatTitle');
    const featStatus = document.getElementById('abilityFeatStatus');
    const checkoffBtn = document.getElementById('abilityCheckoffBtn');

    if (featTitle) featTitle.textContent = goal.title;
    if (featEmoji) featEmoji.textContent = goal.theme_key === 'volcano' ? '🌋' : goal.theme_key === 'canopy' ? '🌴' : goal.theme_key === 'everest' ? '🐐' : '⚡';
    if (featStatus) featStatus.textContent = goal.status === 'completed' ? '✓ Accomplished 🏆' : 'One-Off Feat';
    if (checkoffBtn) {
      checkoffBtn.dataset.goalId = goal.id;
      if (goal.status === 'completed') {
        checkoffBtn.disabled = true;
        checkoffBtn.innerHTML = '<span>✓</span> Accomplished! 🏆';
        checkoffBtn.className = 'btn btn-secondary';
      } else {
        checkoffBtn.disabled = false;
        checkoffBtn.innerHTML = '<span>✓</span> Mark Accomplished';
        checkoffBtn.className = 'btn btn-primary';
      }
    }
    if (window.setLoggingMode) {
      window.setLoggingMode('ability');
    }
    return;
  } else {
    if (tabAbility) tabAbility.style.display = 'none';
    if (panelAbility && panelAbility.style.display === 'block' && window.setLoggingMode) {
      window.setLoggingMode('stepper');
    }
  }

  const curEx = exSelect ? exSelect.value : '';

  if (!goal || goal.category === 'weight') {
    if (exLabel) exLabel.textContent = 'Exercise';
    if (metricLabel) metricLabel.textContent = `Weight (${goal?.unit || 'lbs'})`;
    if (countLabel) countLabel.textContent = 'Reps';
    if (routeLabel) routeLabel.textContent = '';
    if (exSelect) {
      exSelect.innerHTML = `
        <option value="" disabled ${!curEx ? 'selected' : ''}>Select Exercise</option>
        <option value="Back Squat">🏋️ Back Squat</option>
        <option value="Deadlift">⛓️ Deadlift</option>
        <option value="Bench Press">🛡️ Bench Press</option>
        <option value="Leg Press">🦵 Leg Press</option>
        <option value="Overhead Press">🚀 Overhead Press</option>
        <option value="Barbell Row">🚣 Barbell Row</option>
        <option value="Dumbbell Lunge">👟 Dumbbell Lunge</option>
        <option value="Bicep Curl">💪 Bicep Curl</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
      if (curEx && curEx !== '__add_custom__' && Array.from(exSelect.options).some(o => o.value === curEx)) {
        exSelect.value = curEx;
      }
    }
    if (metricPresets) {
      metricPresets.className = 'quick-presets preset-grid-plates';
      metricPresets.innerHTML = `
        <button class="preset-chip preset-minus" data-delta="-45">-45</button>
        <button class="preset-chip preset-minus" data-delta="-25">-25</button>
        <button class="preset-chip preset-minus" data-delta="-5">-5</button>
        <button class="preset-chip preset-minus" data-delta="-0.5">-0.5</button>
        <button class="preset-chip preset-plus" data-delta="+0.5">+0.5</button>
        <button class="preset-chip preset-plus" data-delta="+5">+5</button>
        <button class="preset-chip preset-plus" data-delta="+25">+25</button>
        <button class="preset-chip preset-plus" data-delta="+45">+45</button>
      `;
      attachMetricPresetListeners();
    }
  } else if (goal.category === 'elevation') {
    if (exLabel) exLabel.textContent = 'Exercise';
    if (metricLabel) metricLabel.textContent = `Elevation (${goal.unit || 'ft'})`;
    if (countLabel) countLabel.textContent = 'Sets';
    if (routeLabel) routeLabel.textContent = '';
    if (exSelect) {
      exSelect.innerHTML = `
        <option value="" disabled ${!curEx ? 'selected' : ''}>Select Exercise</option>
        <option value="Stair Climber">🧗 Stair Climber</option>
        <option value="Incline Treadmill">🏔️ Incline Treadmill</option>
        <option value="Mountain Hike">🥾 Mountain Hike</option>
        <option value="Box Step-ups">📦 Box Step-ups</option>
        <option value="Hill Sprints">🏃 Hill Sprints</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
      if (curEx && curEx !== '__add_custom__' && Array.from(exSelect.options).some(o => o.value === curEx)) {
        exSelect.value = curEx;
      }
    }
    if (metricPresets) {
      metricPresets.className = 'quick-presets preset-grid-plates';
      metricPresets.innerHTML = `
        <button class="preset-chip preset-minus" data-delta="-100">-100</button>
        <button class="preset-chip preset-minus" data-delta="-25">-25</button>
        <button class="preset-chip preset-minus" data-delta="-10">-10</button>
        <button class="preset-chip preset-plus" data-delta="+10">+10</button>
        <button class="preset-chip preset-plus" data-delta="+25">+25</button>
        <button class="preset-chip preset-plus" data-delta="+100">+100</button>
      `;
      attachMetricPresetListeners();
    }
  } else if (goal.category === 'distance') {
    if (exLabel) exLabel.textContent = 'Exercise';
    if (metricLabel) metricLabel.textContent = `Distance (${goal.unit || 'mi'})`;
    if (countLabel) countLabel.textContent = 'Sets';
    if (routeLabel) routeLabel.textContent = '';
    if (exSelect) {
      exSelect.innerHTML = `
        <option value="" disabled ${!curEx ? 'selected' : ''}>Select Exercise</option>
        <option value="Outdoor Run">🏃 Outdoor Run</option>
        <option value="Trail Walk">🚶 Trail Walk</option>
        <option value="Road Cycling">🚴 Road Cycling</option>
        <option value="Rowing Machine">🚣 Rowing Machine</option>
        <option value="Treadmill Run">⚡ Treadmill Run</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
      if (curEx && curEx !== '__add_custom__' && Array.from(exSelect.options).some(o => o.value === curEx)) {
        exSelect.value = curEx;
      }
    }
    if (metricPresets) {
      metricPresets.className = 'quick-presets preset-grid-plates';
      metricPresets.innerHTML = `
        <button class="preset-chip preset-minus" data-delta="-2">-2</button>
        <button class="preset-chip preset-minus" data-delta="-1">-1</button>
        <button class="preset-chip preset-minus" data-delta="-0.5">-0.5</button>
        <button class="preset-chip preset-plus" data-delta="+0.5">+0.5</button>
        <button class="preset-chip preset-plus" data-delta="+1">+1</button>
        <button class="preset-chip preset-plus" data-delta="+2">+2</button>
      `;
      attachMetricPresetListeners();
    }
  } else {
    // Custom Quest Category
    if (exLabel) exLabel.textContent = 'Exercise';
    if (metricLabel) metricLabel.textContent = goal.unit || 'Amount';
    if (countLabel) countLabel.textContent = 'Sets';
    if (routeLabel) routeLabel.textContent = '';
    if (exSelect) {
      exSelect.innerHTML = `
        <option value="" disabled ${!curEx ? 'selected' : ''}>Select Exercise</option>
        <option value="${FlyToast.escape(goal.title)}">${FlyToast.escape(goal.title)}</option>
        <option value="Custom Movement">Custom Movement</option>
        <option value="Rep Count">Rep Count</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
      if (curEx && curEx !== '__add_custom__' && Array.from(exSelect.options).some(o => o.value === curEx)) {
        exSelect.value = curEx;
      }
    }
    if (metricPresets) {
      metricPresets.className = 'quick-presets preset-grid-plates';
      metricPresets.innerHTML = `
        <button class="preset-chip preset-minus" data-delta="-50">-50</button>
        <button class="preset-chip preset-minus" data-delta="-25">-25</button>
        <button class="preset-chip preset-minus" data-delta="-10">-10</button>
        <button class="preset-chip preset-plus" data-delta="+10">+10</button>
        <button class="preset-chip preset-plus" data-delta="+25">+25</button>
        <button class="preset-chip preset-plus" data-delta="+50">+50</button>
      `;
      attachMetricPresetListeners();
    }
  }
  updateImpact();
}

window.updateStepperForGoal = updateStepperForGoal;

export function updateImpact() {
  const wtInput = document.getElementById('stepperWeight');
  const repsInput = document.getElementById('stepperReps');
  const impactVal = document.getElementById('computedImpactVal');
  if (!wtInput || !repsInput || !impactVal) return;

  const activeGoals = state.currentRoomData?.active_goals || [];
  const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight', unit: 'lbs' };
  const wt = parseFloat(wtInput.value) || 0;
  const reps = parseInt(repsInput.value, 10) || 0;
  const total = wt * reps;

  if (currentGoal.category === 'distance') {
    const formatted = (Math.round(total * 100) / 100).toLocaleString('en-US');
    impactVal.textContent = `${formatted} ${currentGoal.unit || 'mi'}`;
  } else {
    impactVal.textContent = `${formatNumber(total)} ${currentGoal.unit || 'lbs'}`;
  }
}

function attachMetricPresetListeners() {
  const wtInput = document.getElementById('stepperWeight');
  if (!wtInput) return;
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.onclick = () => {
      const delta = parseFloat(chip.dataset.delta);
      if (!isNaN(delta)) {
        const cur = parseFloat(wtInput.value) || 0;
        const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
        wtInput.value = next === 0 && delta < 0 ? '0' : String(next);
        updateImpact();
      }
    };
  });
}

export function setupLoggingTabs() {
  const tabAbility = document.getElementById('modeAbilityBtn');
  const tabStepper = document.getElementById('modeStepperBtn');
  const tabWorkout = document.getElementById('modeWorkoutBtn');
  const tabFastAdd = document.getElementById('modeFastAddBtn');

  const panelAbility = document.getElementById('panelAbilityCheckoff');
  const panelStepper = document.getElementById('panelStepper');
  const panelWorkout = document.getElementById('panelWorkout');
  const panelFastAdd = document.getElementById('panelFastAdd');

  const allTabs = [tabAbility, tabStepper, tabWorkout, tabFastAdd].filter(Boolean);
  const allPanels = [panelAbility, panelStepper, panelWorkout, panelFastAdd].filter(Boolean);

  function setMode(mode) {
    allTabs.forEach(t => t.classList.remove('active'));
    allPanels.forEach(p => {
      if (p) p.style.display = 'none';
    });

    if (mode === 'ability') {
      if (tabAbility) tabAbility.classList.add('active');
      if (panelAbility) panelAbility.style.display = 'block';
    } else if (mode === 'stepper') {
      if (tabStepper) tabStepper.classList.add('active');
      if (panelStepper) panelStepper.style.display = 'block';
    } else if (mode === 'workout') {
      if (tabWorkout) tabWorkout.classList.add('active');
      if (panelWorkout) panelWorkout.style.display = 'block';
    } else if (mode === 'fastadd') {
      if (tabFastAdd) tabFastAdd.classList.add('active');
      if (panelFastAdd) panelFastAdd.style.display = 'block';
    }
  }

  window.setLoggingMode = setMode;

  if (tabAbility) tabAbility.addEventListener('click', () => setMode('ability'));
  if (tabStepper) tabStepper.addEventListener('click', () => setMode('stepper'));
  if (tabWorkout) tabWorkout.addEventListener('click', () => setMode('workout'));
  if (tabFastAdd) tabFastAdd.addEventListener('click', () => setMode('fastadd'));
}

export function setupPrivacyToggles() {
  ['stepperPrivate', 'workoutBatchPrivate', 'fastAddPrivate', 'abilityFeatPrivate'].forEach(id => {
    const chk = document.getElementById(id);
    if (!chk) return;
    const updateActive = () => {
      const label = chk.closest('.submit-privacy-toggle');
      if (label) {
        label.classList.toggle('is-active', chk.checked);
      }
    };
    chk.addEventListener('change', updateActive);
    updateActive();
  });
}

export function setupSteppers({ onReloadState } = {}) {
  setupPrivacyToggles();
  const wtInput = document.getElementById('stepperWeight');
  const repsInput = document.getElementById('stepperReps');
  const wtMinusBtn = document.getElementById('wtMinusBtn');
  const wtPlusBtn = document.getElementById('wtPlusBtn');
  const repsMinusBtn = document.getElementById('repsMinusBtn');
  const repsPlusBtn = document.getElementById('repsPlusBtn');
  const logSetBtn = document.getElementById('logSetBtn');
  const repeatSetBtn = document.getElementById('repeatSetBtn');

  if (wtMinusBtn && wtInput) {
    wtMinusBtn.addEventListener('click', () => {
      const activeGoals = state.currentRoomData?.active_goals || [];
      const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight' };
      const step = currentGoal.category === 'distance' ? 1 : 10;
      const cur = parseFloat(wtInput.value);
      if (isNaN(cur) || cur <= 0) {
        wtInput.value = '0';
      } else {
        wtInput.value = String(Math.max(0, cur - step));
      }
      updateImpact();
    });
  }

  if (wtPlusBtn && wtInput) {
    wtPlusBtn.addEventListener('click', () => {
      const activeGoals = state.currentRoomData?.active_goals || [];
      const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight' };
      const step = currentGoal.category === 'distance' ? 1 : 10;
      const cur = parseFloat(wtInput.value);
      if (isNaN(cur) || cur < 0) {
        wtInput.value = String(step);
      } else {
        wtInput.value = String(cur + step);
      }
      updateImpact();
    });
  }

  attachMetricPresetListeners();

  if (repsMinusBtn && repsInput) {
    repsMinusBtn.addEventListener('click', () => {
      const cur = parseInt(repsInput.value, 10);
      if (isNaN(cur) || cur <= 1) {
        repsInput.value = '1';
      } else {
        repsInput.value = String(cur - 1);
      }
      updateImpact();
    });
  }

  if (repsPlusBtn && repsInput) {
    repsPlusBtn.addEventListener('click', () => {
      const cur = parseInt(repsInput.value, 10);
      if (isNaN(cur) || cur < 1) {
        repsInput.value = '1';
      } else {
        repsInput.value = String(cur + 1);
      }
      updateImpact();
    });
  }

  document.querySelectorAll('.preset-chip-rep').forEach(chip => {
    chip.addEventListener('click', () => {
      if (repsInput) {
        repsInput.value = parseInt(chip.dataset.val, 10);
        updateImpact();
      }
    });
  });

  if (wtInput) wtInput.addEventListener('input', updateImpact);
  if (repsInput) repsInput.addEventListener('input', updateImpact);

  // Custom Exercise Dropdown & Input Controls
  const customExRow = document.getElementById('customExerciseRow');
  const customExInput = document.getElementById('customExerciseInput');
  const addCustomExBtn = document.getElementById('addCustomExerciseBtn');
  const cancelCustomExBtn = document.getElementById('cancelCustomExerciseBtn');
  const stepperExSelect = document.getElementById('stepperExercise');

  let lastSelectedEx = stepperExSelect ? stepperExSelect.value : '';

  if (stepperExSelect) {
    stepperExSelect.addEventListener('change', () => {
      if (stepperExSelect.value === '__add_custom__') {
        showCustomExerciseInput();
      } else {
        lastSelectedEx = stepperExSelect.value;
      }
    });
  }

  function showCustomExerciseInput() {
    if (customExRow) {
      customExRow.style.display = 'flex';
      if (customExInput) {
        customExInput.value = '';
        setTimeout(() => customExInput.focus(), 60);
      }
    }
  }

  function hideCustomExerciseInput() {
    if (customExRow) {
      customExRow.style.display = 'none';
      if (customExInput) customExInput.value = '';
    }
    if (stepperExSelect && stepperExSelect.value === '__add_custom__') {
      stepperExSelect.value = lastSelectedEx || '';
    }
  }

  function handleAddCustomExercise() {
    const rawName = customExInput ? customExInput.value.trim() : '';
    if (!rawName) {
      FlyToast.error('Please enter an exercise name');
      return;
    }
    saveCustomExercise(rawName);

    // Add to dropdown if not present
    let opt = Array.from(stepperExSelect.options).find(o => o.value.toLowerCase() === rawName.toLowerCase());
    if (!opt) {
      opt = document.createElement('option');
      opt.value = rawName;
      opt.textContent = `✨ ${rawName}`;
      const customOpt = stepperExSelect.querySelector('option[value="__add_custom__"]');
      if (customOpt) {
        stepperExSelect.insertBefore(opt, customOpt);
      } else {
        stepperExSelect.appendChild(opt);
      }
    }
    stepperExSelect.value = opt.value;
    lastSelectedEx = opt.value;
    hideCustomExerciseInput();
    FlyToast.success(`Added "${rawName}" to exercises!`);
  }

  if (addCustomExBtn) {
    addCustomExBtn.addEventListener('click', handleAddCustomExercise);
  }

  if (customExInput) {
    customExInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomExercise();
      } else if (e.key === 'Escape') {
        hideCustomExerciseInput();
      }
    });
  }

  if (cancelCustomExBtn) {
    cancelCustomExBtn.addEventListener('click', hideCustomExerciseInput);
  }

  if (logSetBtn) {
    logSetBtn.addEventListener('click', async () => {
      let exercise = stepperExSelect ? stepperExSelect.value : '';
      if (exercise === '__add_custom__') {
        exercise = '';
      }
      if (!exercise) {
        FlyToast.error('Please select an exercise');
        if (stepperExSelect) stepperExSelect.focus();
        return;
      }
      const rawWt = wtInput ? wtInput.value.trim() : '';
      const rawReps = repsInput ? repsInput.value.trim() : '';
      const activeGoals = state.currentRoomData?.active_goals || [];
      const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight' };

      const metricVal = parseFloat(rawWt) || 0;
      const reps = parseInt(rawReps, 10) || 0;

      if (!rawReps || reps <= 0) {
        FlyToast.error('Please enter reps');
        if (repsInput) repsInput.focus();
        return;
      }

      if (currentGoal.category === 'weight') {
        if (!rawWt || isNaN(parseFloat(rawWt))) {
          FlyToast.error('Please enter weight');
          if (wtInput) wtInput.focus();
          return;
        }
      } else if (currentGoal.category === 'distance') {
        if (!rawWt || metricVal <= 0) {
          FlyToast.error('Please enter distance');
          if (wtInput) wtInput.focus();
          return;
        }
      } else if (currentGoal.category === 'elevation') {
        if (!rawWt || metricVal <= 0) {
          FlyToast.error('Please enter elevation');
          if (wtInput) wtInput.focus();
          return;
        }
      }

      const totalMetric = currentGoal.category === 'weight' ? metricVal * reps : metricVal * reps;
      const isPrivate = document.getElementById('stepperPrivate')?.checked || false;

      if (!logSetBtn.dataset.origHtml) logSetBtn.dataset.origHtml = logSetBtn.innerHTML;
      const unit = currentGoal.category === 'distance' ? 'mi' : currentGoal.category === 'elevation' ? 'ft' : 'lbs';
      const successMsg = `<span>✓</span> Logged +${formatNumber(totalMetric)} ${unit}!`;

      await executeLogActivity({
        room_slug: state.roomSlug,
        activity_type: currentGoal.category,
        exercise_name: exercise,
        sets: 1,
        reps,
        weight_per_rep: currentGoal.category === 'weight' ? metricVal : 0,
        distance_val: currentGoal.category === 'distance' ? totalMetric : 0,
        elevation_val: currentGoal.category === 'elevation' ? totalMetric : 0,
        total_metric: totalMetric,
        goal_id: currentGoal.id,
        is_private: isPrivate,
      }, {
        onReloadState,
        triggerButton: logSetBtn,
        buttonSuccessText: successMsg,
      });
    });
  }

  if (repeatSetBtn) {
    repeatSetBtn.addEventListener('click', async () => {
      if (!repeatSetBtn.dataset.origHtml) repeatSetBtn.dataset.origHtml = repeatSetBtn.innerHTML;
      if (state.lastLoggedSet) {
        await executeLogActivity({
          ...state.lastLoggedSet,
          notes: 'Repeat set',
        }, {
          onReloadState,
          triggerButton: repeatSetBtn,
          buttonSuccessText: '<span>✓</span> +1 Added!',
        });
        return;
      }
      if (logSetBtn) logSetBtn.click();
    });
  }

  const checkoffBtn = document.getElementById('abilityCheckoffBtn');
  const featNoteInput = document.getElementById('abilityFeatNoteInput');
  if (checkoffBtn) {
    checkoffBtn.addEventListener('click', async () => {
      const activeGoals = state.currentRoomData?.active_goals || [];
      const currentGoal = activeGoals[state.selectedGoalIndex];
      const goalId = checkoffBtn.dataset.goalId || currentGoal?.id;
      if (!goalId) return;

      const notes = (featNoteInput ? featNoteInput.value.trim() : '') || 'Accomplished!';
      const isPrivate = document.getElementById('abilityFeatPrivate')?.checked || false;
      if (!checkoffBtn.dataset.origHtml) checkoffBtn.dataset.origHtml = checkoffBtn.innerHTML;
      try {
        checkoffBtn.disabled = true;
        checkoffBtn.innerHTML = '<span>⏳</span> Recording...';
        const res = await state.client.post(`/goals/${goalId}/checkoff`, { notes, is_private: isPrivate });
        if (res && res.success) {
          if (featNoteInput) featNoteInput.value = '';
          FlyToast.success(`🎉 Accomplished: ${currentGoal?.title || 'Ability'}!`);
          if (navigator.vibrate) {
            try { navigator.vibrate([40, 30, 40]); } catch (_) {}
          }
          flashButtonSuccess(checkoffBtn, '<span>✓</span> Accomplished! 🏆', checkoffBtn.dataset.origHtml);
          if (state.diorama) {
            state.diorama.spawnCelebrationBurst('⚡ Feat Unlocked!');
          }
          if (onReloadState) await onReloadState();
        } else {
          FlyToast.error(res?.error || 'Failed to check off feat');
        }
      } catch (err) {
        console.error('Checkoff error:', err);
        FlyToast.error('Failed to check off feat');
      } finally {
        checkoffBtn.disabled = false;
        checkoffBtn.innerHTML = '<span>✓</span> Mark Accomplished';
      }
    });
  }

  updateImpact();
}

export function flashButtonSuccess(btn, successHtml, originalHtml, durationMs = 1600) {
  if (!btn) return;
  btn.classList.add('btn-log-success');
  btn.innerHTML = successHtml;
  btn.disabled = true;
  setTimeout(() => {
    btn.classList.remove('btn-log-success');
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }, durationMs);
}

export async function executeLogActivity(req, { onReloadState, triggerButton, buttonSuccessText } = {}) {
  state.lastLoggedSet = req;

  if (navigator.onLine) {
    try {
      const res = await state.client.post('/activities', req);
      if (res && res.success) {
        state.justLoggedActivityId = res.data.id;
        const act = res.data;
        const unit = act.activity_type === 'weight' ? 'lbs' : act.activity_type === 'elevation' ? 'ft' : 'mi';
        const exName = act.exercise_name || req.exercise_name || 'Set';
        let detail = '';
        if (act.activity_type === 'weight') {
          detail = `${act.sets}x${act.reps} @ ${act.weight_per_rep} lbs (+${formatNumber(act.total_metric)} lbs)`;
        } else if (act.activity_type === 'distance') {
          detail = `${act.total_metric} mi`;
        } else if (act.activity_type === 'elevation') {
          detail = `${formatNumber(act.total_metric)} ft`;
        } else {
          detail = `+${formatNumber(act.total_metric)}`;
        }
        FlyToast.success(`✓ Logged ${exName}: ${detail}`);

        if (navigator.vibrate) {
          try { navigator.vibrate([40, 30, 40]); } catch (_) {}
        }

        if (triggerButton) {
          const originalText = triggerButton.dataset.origHtml || triggerButton.innerHTML;
          const flashText = buttonSuccessText || '<span>✓</span> Logged!';
          flashButtonSuccess(triggerButton, flashText, originalText);
        }

        if (onReloadState) await onReloadState();
        if (state.diorama) {
          state.diorama.spawnCelebrationBurst(`+${formatNumber(res.data.total_metric)} ${unit}`);
        }
        return res.data;
      }
    } catch (err) {
      console.warn('Online log failed, fallback to queue:', err);
    }
  }

  if (state.offlineSync) {
    state.offlineSync.enqueue(req);
  }
  FlyToast.info('✓ Logged offline! Will auto-sync when connection returns.');
  if (triggerButton) {
    const originalText = triggerButton.dataset.origHtml || triggerButton.innerHTML;
    flashButtonSuccess(triggerButton, '<span>✓</span> Logged Offline!', originalText);
  }
  if (onReloadState) await onReloadState();
}

export function setupFastAdd({ onReloadState } = {}) {
  const catSelect = document.getElementById('fastAddCategory');
  const amtInput = document.getElementById('fastAddInput');
  const presetsContainer = document.getElementById('fastAddPresets');
  const submitBtn = document.getElementById('submitFastAddBtn');

  if (!catSelect || !amtInput || !presetsContainer || !submitBtn) return;

  function updatePresets() {
    const cat = catSelect.value;
    if (cat === 'weight') {
      presetsContainer.innerHTML = `
        <button class="preset-chip-fast" data-amt="500">+500</button>
        <button class="preset-chip-fast" data-amt="1000">+1,000</button>
        <button class="preset-chip-fast" data-amt="2500">+2,500</button>
        <button class="preset-chip-fast" data-amt="5000">+5,000</button>
      `;
    } else if (cat === 'distance') {
      presetsContainer.innerHTML = `
        <button class="preset-chip-fast" data-amt="1">+1 mi</button>
        <button class="preset-chip-fast" data-amt="3">+3 mi</button>
        <button class="preset-chip-fast" data-amt="5">+5 mi</button>
        <button class="preset-chip-fast" data-amt="10">+10 mi</button>
      `;
    } else {
      presetsContainer.innerHTML = `
        <button class="preset-chip-fast" data-amt="250">+250 ft</button>
        <button class="preset-chip-fast" data-amt="500">+500 ft</button>
        <button class="preset-chip-fast" data-amt="1000">+1,000 ft</button>
        <button class="preset-chip-fast" data-amt="2500">+2,500 ft</button>
      `;
    }

    presetsContainer.querySelectorAll('.preset-chip-fast').forEach(b => {
      b.addEventListener('click', () => {
        amtInput.value = (parseFloat(amtInput.value) || 0) + parseFloat(b.dataset.amt);
      });
    });
  }

  catSelect.addEventListener('change', updatePresets);
  updatePresets();

  submitBtn.addEventListener('click', async () => {
    const cat = catSelect.value;
    const val = parseFloat(amtInput.value) || 0;
    if (val <= 0) {
      FlyToast.error('Please enter a positive amount');
      return;
    }

    const excludePrCheckbox = document.getElementById('fastAddExcludePr');
    const isCombined = excludePrCheckbox ? excludePrCheckbox.checked : false;

    const exerciseInput = document.getElementById('fastAddExercise');
    const setsInput = document.getElementById('fastAddSets');
    const repsInput = document.getElementById('fastAddReps');
    const notesInput = document.getElementById('fastAddNotes');

    const exName = (exerciseInput?.value.trim()) || 'Fast Add';
    const sets = parseInt(setsInput?.value, 10) || 1;
    const reps = parseInt(repsInput?.value, 10) || 1;
    const notes = notesInput?.value.trim() || '';

    let weightPerRep = 0;
    if (cat === 'weight') {
      if (isCombined) {
        weightPerRep = 0.0;
      } else {
        weightPerRep = (sets * reps > 1) ? +(val / (sets * reps)).toFixed(2) : val;
      }
    }

    const fastAddPrivateCheckbox = document.getElementById('fastAddPrivate');
    const isPrivate = fastAddPrivateCheckbox ? fastAddPrivateCheckbox.checked : false;

    const payload = {
      room_slug: state.roomSlug,
      activity_type: cat,
      exercise_name: exName,
      total_metric: val,
      distance_val: cat === 'distance' ? (isCombined ? 0 : val) : 0,
      elevation_val: cat === 'elevation' ? (isCombined ? 0 : val) : 0,
      weight_per_rep: weightPerRep,
      sets,
      reps,
      notes,
      is_combined: isCombined,
      is_pr: isCombined ? false : null,
      is_private: isPrivate,
    };

    if (!submitBtn.dataset.origHtml) submitBtn.dataset.origHtml = submitBtn.innerHTML;
    await executeLogActivity(payload, {
      onReloadState,
      triggerButton: submitBtn,
      buttonSuccessText: `<span>✓</span> Logged +${formatNumber(val)}!`,
    });
    amtInput.value = '';
    if (exerciseInput) exerciseInput.value = '';
    if (setsInput) setsInput.value = '';
    if (repsInput) repsInput.value = '';
    if (notesInput) notesInput.value = '';
  });
}

export function setupWorkoutMode({ onReloadState } = {}) {
  const container = document.getElementById('workoutEntriesContainer');
  const addRowBtn = document.getElementById('addWorkoutRowBtn');
  const submitBtn = document.getElementById('submitWorkoutBtn');

  if (!container || !addRowBtn || !submitBtn) return;

  function addRow(ex = '', sets = '', reps = '', wt = '') {
    const row = document.createElement('div');
    row.className = 'workout-entry-row';
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.style.alignItems = 'center';

    row.innerHTML = `
      <input type="text" class="form-input row-ex" placeholder="Exercise (e.g. Squat)" value="${ex}" style="flex: 2; padding: 8px;">
      <input type="number" class="form-input row-sets" placeholder="Sets" value="${sets}" style="width: 60px; padding: 8px;">
      <input type="number" class="form-input row-reps" placeholder="Reps" value="${reps}" style="width: 60px; padding: 8px;">
      <input type="number" step="any" class="form-input row-wt" placeholder="Lbs" value="${wt}" style="width: 75px; padding: 8px;">
      <button class="delete-btn row-del" style="font-size: 1.1rem; padding: 4px 8px;">✕</button>
    `;

    row.querySelector('.row-del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  addRowBtn.addEventListener('click', () => addRow());

  document.querySelectorAll('.quick-add-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const exName = chip.dataset.ex;
      addRow(exName);
    });
  });

  addRow('', '', '', '');

  submitBtn.addEventListener('click', async () => {
    const rows = container.querySelectorAll('.workout-entry-row');
    const batchPrivateCheckbox = document.getElementById('workoutBatchPrivate');
    const isPrivate = batchPrivateCheckbox ? batchPrivateCheckbox.checked : false;
    const activities = [];

    rows.forEach(r => {
      const ex = r.querySelector('.row-ex').value.trim();
      const sets = parseInt(r.querySelector('.row-sets').value, 10);
      const reps = parseInt(r.querySelector('.row-reps').value, 10);
      const wt = parseFloat(r.querySelector('.row-wt').value);

      if (ex || !isNaN(wt) || !isNaN(sets)) {
        activities.push({
          room_slug: state.roomSlug,
          activity_type: 'weight',
          exercise_name: ex || 'Lift',
          sets: isNaN(sets) || sets <= 0 ? 1 : sets,
          reps: isNaN(reps) || reps <= 0 ? 10 : reps,
          weight_per_rep: isNaN(wt) || wt < 0 ? 0 : wt,
          is_private: isPrivate,
        });
      }
    });

    if (activities.length === 0) {
      FlyToast.error('Please enter at least one exercise row');
      return;
    }

    if (!submitBtn.dataset.origHtml) submitBtn.dataset.origHtml = submitBtn.innerHTML;

    if (navigator.onLine) {
      try {
        const res = await state.client.post('/activities/batch', {
          room_slug: state.roomSlug,
          activities,
        });
        if (res && res.success) {
          FlyToast.success(`✓ Submitted ${activities.length} exercises!`);
          if (navigator.vibrate) {
            try { navigator.vibrate([40, 30, 40]); } catch (_) {}
          }
          flashButtonSuccess(submitBtn, `<span>✓</span> ${activities.length} Logged!`, submitBtn.dataset.origHtml);
          container.innerHTML = '';
          addRow('', '', '', '');
          if (onReloadState) await onReloadState();
          return;
        }
      } catch (e) {
        console.warn('Batch submit offline fallback:', e);
      }
    }

    if (state.offlineSync) {
      activities.forEach(a => state.offlineSync.enqueue(a));
    }
    FlyToast.info(`✓ Logged ${activities.length} exercises offline!`);
    flashButtonSuccess(submitBtn, `<span>✓</span> ${activities.length} Offline!`, submitBtn.dataset.origHtml);
    container.innerHTML = '';
    addRow('', '', '', '');
    if (onReloadState) await onReloadState();
  });
}

export function renderQuickRecentSets({ onReloadState } = {}) {
  const container = document.getElementById('quickRecentSetsList');
  const summaryEl = document.getElementById('quickTodaySummary');
  if (!container || !state.currentRoomData) return;

  const myToken = state.currentRoomData.user_profile?.user_token;
  const allActivities = state.currentRoomData.recent_activities || [];
  const myActivities = allActivities.filter(act => act.user_token === myToken);

  // Compute Today's totals for the current user
  let todayWeight = 0;
  let todayDistance = 0;
  let todayElevation = 0;
  let todaySets = 0;

  myActivities.forEach(act => {
    if (isToday(act.created_at)) {
      if (act.activity_type === 'weight') {
        todayWeight += act.total_metric || 0;
      } else if (act.activity_type === 'distance') {
        todayDistance += act.distance_val || act.total_metric || 0;
      } else if (act.activity_type === 'elevation') {
        todayElevation += act.elevation_val || act.total_metric || 0;
      } else if (act.weight_per_rep > 0) {
        todayWeight += act.total_metric || 0;
      }
      todaySets += (act.sets || 1);
    }
  });

  if (summaryEl) {
    const parts = [];
    if (todayWeight > 0) parts.push(`<strong>${formatNumber(todayWeight)} lbs</strong>`);
    if (todayDistance > 0) parts.push(`<strong>${Number.isInteger(todayDistance) ? todayDistance : (Math.round(todayDistance * 10) / 10)} mi</strong>`);
    if (todayElevation > 0) parts.push(`<strong>${formatNumber(todayElevation)} ft</strong>`);

    if (parts.length === 0) {
      summaryEl.innerHTML = 'Today: <strong>0 lbs</strong> · 0 sets';
    } else {
      summaryEl.innerHTML = `Today: ${parts.join(' · ')} · ${todaySets} set${todaySets === 1 ? '' : 's'}`;
    }
  }

  // Render recent sets (up to 4)
  if (myActivities.length === 0) {
    container.innerHTML = '<div class="recent-sets-empty">No sets logged yet</div>';
    return;
  }

  container.innerHTML = '';
  myActivities.slice(0, 4).forEach(act => {
    const item = document.createElement('div');
    const isNew = state.justLoggedActivityId === act.id;
    item.className = `recent-set-item${isNew ? ' new-set-flash' : ''}`;

    let metricText = '';
    if (act.activity_type === 'weight') {
      metricText = `+${formatNumber(act.total_metric)} lbs`;
    } else if (act.activity_type === 'distance') {
      metricText = `+${act.distance_val || act.total_metric} mi`;
    } else if (act.activity_type === 'elevation') {
      metricText = `+${formatNumber(act.elevation_val || act.total_metric)} ft`;
    } else if (act.activity_type === 'ability') {
      metricText = '⚡ Feat';
    } else {
      metricText = `+${formatNumber(act.total_metric)}`;
    }

    let detailStr = act.activity_type === 'weight'
      ? `${act.sets}x${act.reps} @ ${act.weight_per_rep}lbs`
      : act.activity_type === 'ability'
      ? 'Feat'
      : (act.sets > 1 || act.reps > 1 ? `${act.sets}x${act.reps}` : '');

    const prBadge = act.is_pr
      ? '<span class="pr-badge" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 4px;">👑 PR</span>'
      : '';
    const combBadge = act.is_combined
      ? '<span class="combined-badge" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 4px;">📦 Comb</span>'
      : '';
    const privateBadge = act.is_private
      ? '<span class="private-badge" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 4px;">🔒 Priv</span>'
      : '';

    const timeAgo = formatTimeAgo(act.created_at);

    item.innerHTML = `
      <div class="recent-set-left">
        <div class="recent-set-name-row">
          <span class="recent-set-name">${FlyToast.escape(act.exercise_name)}</span>
          ${detailStr ? `<span class="recent-set-details">(${detailStr})</span>` : ''}
          ${prBadge}${combBadge}${privateBadge}
        </div>
        <div class="recent-set-time">${act.notes ? `"${FlyToast.escape(act.notes)}" • ` : ''}${timeAgo}</div>
      </div>
      <div class="recent-set-right">
        <span class="recent-set-metric">${metricText}</span>
        <button class="recent-set-action-btn edit-btn" title="Edit set">✎</button>
        <button class="recent-set-action-btn del-btn" title="Delete set">✕</button>
      </div>
    `;

    const editBtn = item.querySelector('.edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (window.openActivityEditModal) {
          window.openActivityEditModal(act);
        }
      });
    }

    const delBtn = item.querySelector('.del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => deleteActivity(act.id, { onReloadState }));
    }

    container.appendChild(item);
  });
}
