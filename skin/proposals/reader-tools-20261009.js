/* nhunnhun reader tools: append at the end of the latest backed-up skin. */
(() => {
  'use strict';
  function init() {
    const body = document.querySelector('.e-content.post-content');
    if (!body || document.getElementById('nh-reader-tools')) return;
    const headings = [...body.querySelectorAll('h2')];
    if (headings.length < 2) return;
    const nav = document.createElement('nav');
    nav.id = 'nh-reader-tools'; nav.setAttribute('aria-label', '본문 목차');
    const details = document.createElement('details'); details.open = true;
    const summary = document.createElement('summary'); summary.textContent = '이 글의 목차';
    const list = document.createElement('ol');
    headings.forEach((heading, i) => {
      if (!heading.id) heading.id = `nh-section-${i + 1}`;
      const li = document.createElement('li'), link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.closest('.nh-direct-v2') ? heading.textContent.trim().replace(/^\d{2}(?!\d)\s*/, '') : heading.textContent.trim();
      link.addEventListener('click', event => {
        event.preventDefault();
        heading.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
        if (innerWidth < 768) details.open = false;
      });
      li.append(link); list.append(li);
    });
    details.append(summary, list); nav.append(details); body.prepend(nav);
    // Supersede duplicate legacy lists while preserving their other skin features.
    body.querySelectorAll('.toc-space,.floating-toc-space').forEach(el => { el.hidden = true; });
    const observer = new MutationObserver(() => body.querySelectorAll('.toc-space,.floating-toc-space').forEach(el => { el.hidden = true; }));
    observer.observe(body, {childList: true});
    if ('IntersectionObserver' in window) {
      const active = new IntersectionObserver(entries => {
        const current = entries.find(entry => entry.isIntersecting);
        if (!current) return;
        list.querySelectorAll('a').forEach(link => {
          if (link.hash === `#${current.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }, {rootMargin: '-10% 0px -70% 0px'});
      headings.forEach(heading => active.observe(heading));
    }
    // Hero image loads eagerly; subsequent article images use native lazy loading.
    body.querySelectorAll('img').forEach((image, i) => {
      image.decoding = 'async'; image.loading = i === 0 ? 'eager' : 'lazy';
    });
    const images = [...body.querySelectorAll('.nh-direct-v2 img')].filter(image => !image.closest('a'));
    if (images.length && typeof HTMLDialogElement !== 'undefined') {
      const dialog = document.createElement('dialog'); dialog.id = 'nh-photo-viewer';
      dialog.setAttribute('aria-label', '사진 확대');
      const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기';
      const photo = document.createElement('img');
      dialog.append(close, photo); document.body.append(dialog);
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      images.forEach(image => {
        image.tabIndex = 0; image.setAttribute('role', 'button');
        image.setAttribute('aria-label', `${image.alt || '본문 사진'} 확대`);
        function open() { photo.src = image.currentSrc || image.src; photo.alt = image.alt; dialog.showModal(); }
        image.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); open(); }, true);
        image.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
