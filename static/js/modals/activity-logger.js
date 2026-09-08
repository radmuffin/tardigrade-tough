import { state } from '../state.js';

export function setupActivityLoggerModal() {
  const modal = document.getElementById('activityLoggerModal');
  const openBtn = document.getElementById('floatingLogBtn');
  const closeBtn = document.getElementById('closeActivityLoggerModalBtn');

  function openLogger(mode) {
    if (!modal) return;
    const activeGoals = state.currentRoomData?.active_goals || [];
    const currentGoal = activeGoals[state.selectedGoalIndex] || { category: 'weight' };

    let targetMode = mode;
    if (!targetMode) {
      if (currentGoal.category === 'elevation' || currentGoal.category === 'distance') {
        targetMode = 'fastadd';
      } else if (currentGoal.category === 'ability') {
        targetMode = 'ability';
      } else {
        targetMode = 'stepper';
      }
    }

    if (window.setLoggingMode) {
      window.setLoggingMode(targetMode);
    }

    if (targetMode === 'fastadd') {
      const catSelect = document.getElementById('fastAddCategory');
      if (catSelect && (currentGoal.category === 'elevation' || currentGoal.category === 'distance')) {
        catSelect.value = currentGoal.category;
        catSelect.dispatchEvent(new Event('change'));
      }
      const fastAddInput = document.getElementById('fastAddInput');
      if (fastAddInput) {
        setTimeout(() => fastAddInput.focus(), 60);
      }
    } else if (targetMode === 'stepper') {
      const exSelect = document.getElementById('stepperExercise');
      if (exSelect) {
        setTimeout(() => exSelect.focus(), 60);
      }
    }

    modal.classList.remove('hidden');
  }

  function closeLogger() {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  window.openActivityLoggerModal = openLogger;
  window.closeActivityLoggerModal = closeLogger;

  if (openBtn) openBtn.addEventListener('click', () => openLogger());
  if (closeBtn) closeBtn.addEventListener('click', closeLogger);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLogger();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeLogger();
    }
  });

  return { openLogger, closeLogger };
}
