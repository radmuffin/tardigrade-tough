export function setupActivityLoggerModal() {
  const modal = document.getElementById('activityLoggerModal');
  const openBtn = document.getElementById('floatingLogBtn');
  const heroBtn = document.getElementById('heroOpenLoggerBtn');
  const closeBtn = document.getElementById('closeActivityLoggerModalBtn');

  function openLogger(mode) {
    if (!modal) return;
    if (mode && window.setLoggingMode) {
      window.setLoggingMode(mode);
    }
    modal.classList.remove('hidden');
    const exSelect = document.getElementById('stepperExercise');
    if (exSelect) {
      setTimeout(() => exSelect.focus(), 60);
    }
  }

  function closeLogger() {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  window.openActivityLoggerModal = openLogger;
  window.closeActivityLoggerModal = closeLogger;

  if (openBtn) openBtn.addEventListener('click', () => openLogger());
  if (heroBtn) heroBtn.addEventListener('click', () => openLogger());
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
