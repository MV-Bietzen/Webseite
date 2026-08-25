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

  (function flyerLightbox() {
    const overlay = document.getElementById('modal-flyer');
    const thumbs = document.querySelectorAll('.flyer-thumb[data-flyer-index]');
    if (!overlay || !thumbs.length) return;
    const track = overlay.querySelector('.flyer-track');
    const slides = overlay.querySelectorAll('.flyer-slide');
    const dots = overlay.querySelectorAll('.flyer-dots button');
    const prevBtn = overlay.querySelector('.flyer-prev');
    const nextBtn = overlay.querySelector('.flyer-next');
    let current = 0;

    function updateDots() {
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }
    function goTo(i, behavior) {
      current = Math.max(0, Math.min(slides.length - 1, i));
      slides[current].scrollIntoView({ behavior: behavior || 'smooth', inline: 'start', block: 'nearest' });
      updateDots();
    }

    thumbs.forEach(t => {
      t.addEventListener('click', e => {
        e.preventDefault();
        const idx = parseInt(t.getAttribute('data-flyer-index'), 10) || 0;
        openModal('flyer');
        requestAnimationFrame(() => goTo(idx, 'auto'));
      });
    });

    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

    let scrollTimeout;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        current = Math.round(track.scrollLeft / track.clientWidth);
        updateDots();
      }, 100);
    });

    overlay.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') goTo(current + 1);
      if (e.key === 'ArrowLeft') goTo(current - 1);
    });
  })();
