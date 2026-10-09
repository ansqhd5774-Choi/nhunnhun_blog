/* Uses the existing Google tag. No new tracker, page_view or content/medical input collection. */
(() => {
  'use strict';
  if (window.__nhGrowthEventsInstalled) return;
  window.__nhGrowthEventsInstalled = true;
  const article = /^\/\d+$/.test(location.pathname) ? location.pathname : null;
  if (!article) return;
  const debug = new URLSearchParams(location.search).get('nh_analytics_debug') === '1';
  const send = (name, extra) => {
    const params = {
      page_location: location.origin + article,
      page_referrer: '',
      article_path: article,
      interaction_stage: 'requested',
      ...extra,
      ...(debug ? { debug_mode: true } : {})
    };
    // The existing skin loads its Google tag after scrolling. Queue only these bounded interactions.
    const deliver = remaining => {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
      else if (remaining) setTimeout(() => deliver(remaining - 1), 500);
    };
    deliver(20);
  };
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('a,button');
    if (!target) return;
    if (target.matches('a') && target.closest('.contents_style,.related_table,.nh-direct-v2')) {
      let url; try { url = new URL(target.href, location.origin); } catch { return; }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
      if (url.origin === location.origin && /^\/\d+$/.test(url.pathname) && url.pathname !== article) {
        send('related_link_click', { target_path: url.pathname });
      } else if (url.origin !== location.origin && target.closest('.contents_style,.nh-direct-v2')) {
        send('source_click', { source_host: url.hostname });
      }
    } else if (target.matches('.btn_share')) {
      send('share_click', { control: 'share_menu' });
    } else if (target.matches('.btn_mark') && target.textContent.trim() === 'URL 복사') {
      send('copy_link', { control: 'copy_url' });
    }
  }, { passive: true });
})();
