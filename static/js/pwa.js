import { FlyToast } from '/_fly/fly-ui.js';

export function updateOfflineStatus(status) {
  const dot = document.getElementById('footerStatusDot');
  const text = document.getElementById('footerStatusText');
  if (!dot || !text) return;

  if (status.pendingCount > 0) {
    dot.style.color = 'var(--accent-amber)';
    text.textContent = `Syncing (${status.pendingCount}) ⏳`;
  } else if (!status.isOnline) {
    dot.style.color = 'var(--accent-amber)';
    text.textContent = 'Offline 🔌';
  } else {
    dot.style.color = 'var(--accent-green)';
    text.textContent = 'Live ⚡';
  }
}

export function setupPwa() {
  // 1. Register Service Worker with live update reload
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('✅ Tardigrade Tough PWA Service Worker active with scope:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  FlyToast.info('Updated to latest version! Reloading...', 2000);
                  setTimeout(() => window.location.reload(), 1200);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('⚠️ PWA Service Worker registration error:', err);
        });
    });
  }

  // 2. Install Prompt Handling
  let deferredPrompt = null;
  const headerInstallBtn = document.getElementById('headerInstallBtn');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  const showInstallButtons = () => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (headerInstallBtn) headerInstallBtn.style.display = 'inline-flex';
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
  };

  const hideInstallButtons = () => {
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons();
  });

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      FlyToast.info('To install Tardigrade Tough, tap "Add to Home Screen" or the install icon in your browser address bar.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      hideInstallButtons();
    }
    deferredPrompt = null;
  };

  if (headerInstallBtn) {
    headerInstallBtn.addEventListener('click', triggerInstall);
  }
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', triggerInstall);
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButtons();
    FlyToast.success('App installed!');
  });

  // 3. Handle PWA Shortcuts & URL params (?action=log, ?view=leaderboard, etc.)
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam && ['quests', 'leaderboard', 'activity', 'trophy'].includes(viewParam)) {
    const navBtn = document.getElementById(`nav${viewParam.charAt(0).toUpperCase() + viewParam.slice(1)}Btn`);
    if (navBtn) navBtn.click();
  }
  const actionParam = urlParams.get('action');
  if (actionParam === 'log') {
    const stepperInput = document.getElementById('stepperWeight');
    if (stepperInput) {
      stepperInput.focus();
      stepperInput.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
