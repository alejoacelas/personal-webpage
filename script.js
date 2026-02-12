/* ========================================
   TERMINAL MENU INTERACTION
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  const options = document.querySelectorAll('.menu-option');
  if (!options.length) return;

  /* On hover, move the active indicator */
  options.forEach(option => {
    option.addEventListener('mouseenter', () => {
      options.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
    });
  });

  /* Restore default on mouse leave from menu */
  const menu = document.querySelector('.menu-options');
  if (menu) {
    menu.addEventListener('mouseleave', () => {
      options.forEach(o => o.classList.remove('active'));
      options[0].classList.add('active');
    });
  }

  /* Keyboard navigation */
  let currentIndex = 0;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      options[currentIndex].classList.remove('active');

      if (e.key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % options.length;
      } else {
        currentIndex = (currentIndex - 1 + options.length) % options.length;
      }

      options[currentIndex].classList.add('active');
      options[currentIndex].scrollIntoView({ block: 'nearest' });
    }

    if (e.key === 'Enter') {
      const activeOption = document.querySelector('.menu-option.active');
      if (activeOption) {
        const link = activeOption.getAttribute('href');
        if (link) window.location.href = link;
      }
    }
  });
});
