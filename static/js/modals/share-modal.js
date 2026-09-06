import { FlyToast } from '/_fly/fly-ui.js';

export function setupShareModal() {
  const shareModal = document.getElementById('shareModal');
  const closeShareModalBtn = document.getElementById('closeShareModalBtn');
  const closeShareModalCrossBtn = document.getElementById('closeShareModalCrossBtn');
  const footerShareBtn = document.getElementById('footerShareBtn');
  const shareAppUrlInput = document.getElementById('shareAppUrlInput');
  const copyAppUrlBtn = document.getElementById('copyAppUrlBtn');
  const nativeShareAppBtn = document.getElementById('nativeShareAppBtn');
  const appQrImage = document.getElementById('appQrImage');

  if (!shareModal) return {};

  function openShareModal() {
    const appUrl = `${window.location.origin}/`;
    if (shareAppUrlInput) shareAppUrlInput.value = appUrl;
    if (appQrImage) appQrImage.src = `/api/qr?url=${encodeURIComponent(appUrl)}`;
    if (nativeShareAppBtn && typeof navigator.share === 'function') {
      nativeShareAppBtn.style.display = 'block';
    }
    shareModal.classList.remove('hidden');
  }

  function closeShareModal() {
    shareModal.classList.add('hidden');
  }

  if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeShareModal);
  if (closeShareModalCrossBtn) closeShareModalCrossBtn.addEventListener('click', closeShareModal);
  if (footerShareBtn) {
    footerShareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openShareModal();
    });
  }

  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) closeShareModal();
  });

  if (copyAppUrlBtn && shareAppUrlInput) {
    copyAppUrlBtn.addEventListener('click', async () => {
      const url = shareAppUrlInput.value || `${window.location.origin}/`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          shareAppUrlInput.select();
          document.execCommand('copy');
        }
        FlyToast.success('Tardigrade Tough app link copied!');
      } catch (_) {
        shareAppUrlInput.select();
        document.execCommand('copy');
        FlyToast.success('Tardigrade Tough app link copied!');
      }
    });
  }

  if (nativeShareAppBtn && typeof navigator.share === 'function') {
    nativeShareAppBtn.style.display = 'block';
    nativeShareAppBtn.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: 'Tardigrade Tough — Gym & Beast Progress Tracker',
          text: 'Collaborative gym progress tracker on Tardigrade Tough',
          url: shareAppUrlInput ? shareAppUrlInput.value : `${window.location.origin}/`,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share app aborted or failed:', err);
        }
      }
    });
  }

  return { openShareModal, closeShareModal };
}
