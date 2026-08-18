  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');
  menuToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });
  primaryNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      primaryNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.getElementById('copyright').textContent =
    '© ' + new Date().getFullYear() + ' Musikverein Cäcilia 1907 Bietzen e.V.';

  function openModal(name) {
    const overlay = document.getElementById('modal-' + name);
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeModal(name) {
    const overlay = document.getElementById('modal-' + name);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 250);
  }
  document.querySelectorAll('[data-modal-open]').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); openModal(t.getAttribute('data-modal-open')); });
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id.replace('modal-', ''));
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id.replace('modal-', '')); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-overlay.open');
      if (open) closeModal(open.id.replace('modal-', ''));
    }
  });
