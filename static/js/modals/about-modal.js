export function setupAboutModal() {
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  const footerAboutBtn = document.getElementById('footerAboutBtn');

  if (!aboutModal) return {};

  function openAboutModal() {
    aboutModal.classList.remove('hidden');
  }

  function closeAboutModal() {
    aboutModal.classList.add('hidden');
  }

  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAboutModal);
  if (footerAboutBtn) {
    footerAboutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAboutModal();
    });
  }

  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) closeAboutModal();
  });

  return { openAboutModal, closeAboutModal };
}
