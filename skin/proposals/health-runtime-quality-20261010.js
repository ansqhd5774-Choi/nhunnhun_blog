/* Repair existing rendered metadata and profile-link names; no requests or duplicate JSON-LD. */
(() => {
  'use strict';
  const decode = text => {
    const field = document.createElement('textarea');
    field.innerHTML = text.replaceAll('<', '&lt;');
    return field.value;
  };
  function normalizeSchemas() {
    if (!/^\/\d+$/.test(location.pathname)) return;
    const pageUrl = location.origin + location.pathname;
    const title = document.querySelector('meta[property="og:title"]')?.content?.trim();
    if (!title) return;
    const expected = decode(title);
    for (const block of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(block.textContent); } catch { continue; }
      const entries = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      let changed = false;
      for (const entry of entries) {
        if (!entry || ![entry['@type']].flat().some(type => ['Article', 'BlogPosting', 'NewsArticle'].includes(type))) continue;
        const identity = entry.url ?? (typeof entry.mainEntityOfPage === 'string' ? entry.mainEntityOfPage : entry.mainEntityOfPage?.['@id']);
        if (identity !== pageUrl || typeof entry.headline !== 'string') continue;
        if (!/&(?:[a-z]+|#\d+|#x[\da-f]+);/i.test(entry.headline)) continue;
        const decoded = decode(entry.headline);
        if (decoded !== expected || decoded === entry.headline) continue;
        entry.headline = decoded;
        changed = true;
      }
      if (changed) block.textContent = JSON.stringify(data).replaceAll('<', '\\u003c');
    }
  }
  function labelProfiles(root) {
    if (!root.querySelectorAll) return;
    for (const link of root.querySelectorAll('.tt_box_namecard a.tt_wrap_thumb,.tt-box-thumb > a')) {
      if (link.hasAttribute('aria-label') || link.textContent.trim() || link.querySelector('img[alt]:not([alt=""])')) continue;
      if (!/^https?:\/\//i.test(link.getAttribute('href') ?? '')) continue;
      link.setAttribute('aria-label', link.closest('.tt_box_namecard') ? '작성자 블로그 방문' : '댓글 작성자 블로그 방문');
    }
  }
  function init() {
    normalizeSchemas();
    labelProfiles(document);
    // The platform inserts comments/profile cards lazily. Observe added nodes only.
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1) labelProfiles(node.parentElement ?? node);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
