(() => {
  'use strict';

  const ENDPOINT = 'https://ai-orcin-eta-15.vercel.app/api/events';
  const VISITOR_KEY = 'alphadynAnalyticsVisitor';
  const visitorId = (() => {
    try {
      let value = sessionStorage.getItem(VISITOR_KEY);
      if (!value) {
        value = crypto.randomUUID();
        sessionStorage.setItem(VISITOR_KEY, value);
      }
      return value;
    } catch {
      return crypto.randomUUID();
    }
  })();

  function referrerDetails() {
    if (!document.referrer) return { referrer: 'Direct', referrerUrl: null };
    try {
      const url = new URL(document.referrer);
      return { referrer: url.hostname, referrerUrl: `${url.origin}${url.pathname}`.slice(0, 500) };
    } catch {
      return { referrer: 'Unknown', referrerUrl: null };
    }
  }

  const referrer = referrerDetails();
  const payload = {
    visitorId,
    path: `${location.pathname}`.slice(0, 500),
    page: (document.title || location.pathname).slice(0, 160),
    referrer: referrer.referrer,
    referrerUrl: referrer.referrerUrl,
    device: /ipad|tablet/i.test(navigator.userAgent) ? 'Tablet' : /mobile|iphone|android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
  };

  fetch(ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload)
  }).catch(() => {});
})();
