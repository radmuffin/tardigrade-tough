import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

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

  if (!goal || goal.category === 'weight') {
    if (exLabel) exLabel.textContent = 'Exercise';
    if (metricLabel) metricLabel.textContent = `Weight (${goal?.unit || 'lbs'})`;
    if (countLabel) countLabel.textContent = 'Reps';
    if (routeLabel) routeLabel.textContent = '';
    if (exSelect) {
      exSelect.innerHTML = `
        <option value="Back Squat">🏋️ Back Squat</option>
        <option value="Deadlift">🏋️ Deadlift</option>
        <option value="Bench Press">🏋️ Bench Press</option>
        <option value="Leg Press">🏋️ Leg Press</option>
        <option value="Overhead Press">🏋️ Overhead Press</option>
        <option value="Barbell Row">🏋️ Barbell Row</option>
        <option value="Dumbbell Lunge">🏋️ Dumbbell Lunge</option>
        <option value="Bicep Curl">🏋️ Bicep Curl</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
    }
    if (metricPresets) {
      metricPresets.className = 'quick-presets preset-grid-plates';
      metricPresets.innerHTML = `
        <button class="preset-chip preset-minus" data-delta="-45">-45</button>
        <button class="preset-chip preset-minus" data-delta="-25">-25</button>
        <button class="preset-chip preset-minus" data-delta="-5">-5</button>
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
        <option value="Stair Climber">🧗 Stair Climber</option>
        <option value="Incline Treadmill">🏔️ Incline Treadmill</option>
        <option value="Mountain Hike">🥾 Mountain Hike</option>
        <option value="Box Step-ups">📦 Box Step-ups</option>
        <option value="Hill Sprints">🏃 Hill Sprints</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
    }
    if (wtInput && (wtInput.value === '135' || parseFloat(wtInput.value) <= 0)) {
      wtInput.value = '100';
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
        <option value="Outdoor Run">🏃 Outdoor Run</option>
        <option value="Trail Walk">🚶 Trail Walk</option>
        <option value="Road Cycling">🚴 Road Cycling</option>
        <option value="Rowing Machine">🚣 Rowing Machine</option>
        <option value="Treadmill Run">🏃 Treadmill Run</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
    }
    if (wtInput && (wtInput.value === '135' || parseFloat(wtInput.value) <= 0)) {
      wtInput.value = '3';
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
        <option value="${FlyToast.escape(goal.title)}">${FlyToast.escape(goal.title)}</option>
        <option value="Custom Movement">Custom Movement</option>
        <option value="Rep Count">Rep Count</option>
        ${customOpts}
        <option value="__add_custom__">+ Custom...</option>
      `;
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
        wtInput.value = Math.max(0, (parseFloat(wtInput.value) || 0) + delta);
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
      wtInput.value = Math.max(0, (parseFloat(wtInput.value) || 0) - step);
      updateImpact();
    });
  }

  if (wtPlusBtn && wtInput) {
    wtPlusBtn.addEventListener('click', () => {
      const activeGoals = state.currentRoomData?.active_goals || [];
      const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight' };
      const step = currentGoal.category === 'distance' ? 1 : 10;
      wtInput.value = (parseFloat(wtInput.value) || 0) + step;
      updateImpact();
    });
  }

  attachMetricPresetListeners();

  if (repsMinusBtn && repsInput) {
    repsMinusBtn.addEventListener('click', () => {
      repsInput.value = Math.max(1, (parseInt(repsInput.value, 10) || 1) - 1);
      updateImpact();
    });
  }

  if (repsPlusBtn && repsInput) {
    repsPlusBtn.addEventListener('click', () => {
      repsInput.value = (parseInt(repsInput.value, 10) || 1) + 1;
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
      stepperExSelect.value = lastSelectedEx || (stepperExSelect.options[0] ? stepperExSelect.options[0].value : '');
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
      let exercise = stepperExSelect ? stepperExSelect.value : 'Lift';
      if (exercise === '__add_custom__') {
        exercise = 'Custom Exercise';
      }
      const metricVal = wtInput ? (parseFloat(wtInput.value) || 0) : 0;
      const reps = repsInput ? (parseInt(repsInput.value, 10) || 1) : 1;
      const activeGoals = state.currentRoomData?.active_goals || [];
      const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight' };

      const totalMetric = currentGoal.category === 'weight' ? metricVal * reps : metricVal * reps;
      const isPrivate = document.getElementById('stepperPrivate')?.checked || false;

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
      }, { onReloadState });
    });
  }

  if (repeatSetBtn) {
    repeatSetBtn.addEventListener('click', async () => {
      if (state.lastLoggedSet) {
        await executeLogActivity({
          ...state.lastLoggedSet,
          notes: 'Repeat set',
        }, { onReloadState });
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
      try {
        checkoffBtn.disabled = true;
        checkoffBtn.innerHTML = '<span>⏳</span> Recording...';
        const res = await state.client.post(`/goals/${goalId}/checkoff`, { notes, is_private: isPrivate });
        if (res && res.success) {
          if (featNoteInput) featNoteInput.value = '';
          FlyToast.success(`🎉 Accomplished: ${currentGoal?.title || 'Ability'}!`);
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

export async function executeLogActivity(req, { onReloadState } = {}) {
  state.lastLoggedSet = req;

  if (navigator.onLine) {
    try {
      const res = await state.client.post('/activities', req);
      if (res && res.success) {
        const unit = res.data.activity_type === 'weight' ? 'lbs' : res.data.activity_type === 'elevation' ? 'ft' : 'mi';
        FlyToast.success(`Logged ${formatNumber(res.data.total_metric)} ${unit}!`);
        if (onReloadState) await onReloadState();
        if (state.diorama) {
          state.diorama.spawnCelebrationBurst(`+${formatNumber(res.data.total_metric)} ${unit}`);
        }
        return;
      }
    } catch (err) {
      console.warn('Online log failed, fallback to queue:', err);
    }
  }

  if (state.offlineSync) {
    state.offlineSync.enqueue(req);
  }
  FlyToast.info('Logged offline! Will auto-sync when connection returns.');
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

    await executeLogActivity(payload, { onReloadState });
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
      <input type="number" class="form-input row-wt" placeholder="Lbs" value="${wt}" style="width: 75px; padding: 8px;">
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

    if (navigator.onLine) {
      try {
        const res = await state.client.post('/activities/batch', {
          room_slug: state.roomSlug,
          activities,
        });
        if (res && res.success) {
          FlyToast.success(`Submitted ${activities.length} exercises!`);
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
    FlyToast.info(`Logged ${activities.length} exercises offline!`);
    container.innerHTML = '';
    addRow('', '', '', '');
  });
}
