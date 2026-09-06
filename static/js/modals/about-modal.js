export function setupAboutModal() {
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  const footerAboutBtn = document.getElementById('footerAboutBtn');
  const footerContactBtn = document.getElementById('footerContactBtn');

  if (!aboutModal) return {};

  function openAboutModal(scrollToContact = false) {
    aboutModal.classList.remove('hidden');
    if (scrollToContact) {
      setTimeout(() => {
        const contactSection = document.getElementById('aboutContactSection');
        if (contactSection) {
          contactSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  function closeAboutModal() {
    aboutModal.classList.add('hidden');
  }

  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAboutModal);
  if (footerAboutBtn) {
    footerAboutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAboutModal(false);
    });
  }
  if (footerContactBtn) {
    footerContactBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAboutModal(true);
    });
  }

  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) closeAboutModal();
  });

  return { openAboutModal, closeAboutModal };
}
