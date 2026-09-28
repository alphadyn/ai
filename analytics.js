(() => {
  'use strict';

  const ENDPOINT = 'https://ai-orcin-eta-15.vercel.app/api/events';
  const VISITOR_KEY = 'alphadynAnalyticsVisitor';
  const SESSION_START_KEY = 'alphadynAnalyticsSessionStart';
  const MAX_SESSION_SECONDS = 86400;
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

  const sessionStart = (() => {
    try {
      let value = Number(sessionStorage.getItem(SESSION_START_KEY));
      if (!value) {
        value = Date.now();
        sessionStorage.setItem(SESSION_START_KEY, String(value));
      }
      return value;
    } catch {
      return Date.now();
    }
  })();

  function sessionSeconds() {
    return Math.min(MAX_SESSION_SECONDS, Math.max(0, Math.round((Date.now() - sessionStart) / 1000)));
  }

  function httpStatus() {
    const [navigation] = performance.getEntriesByType?.('navigation') || [];
    const value = navigation && navigation.responseStatus;
    return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
  }

  function send(body) {
    fetch(ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

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
    type: 'pageview',
    visitorId,
    path: `${location.pathname}`.slice(0, 500),
    page: (document.title || location.pathname).slice(0, 160),
    referrer: referrer.referrer,
    referrerUrl: referrer.referrerUrl,
    device: /ipad|tablet/i.test(navigator.userAgent) ? 'Tablet' : /mobile|iphone|android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
    status: httpStatus(),
    sessionSeconds: sessionSeconds()
  };

  send(payload);

  let lastSentSeconds = payload.sessionSeconds;
  function sendSessionUpdate() {
    const seconds = sessionSeconds();
    if (seconds === lastSentSeconds) return;
    lastSentSeconds = seconds;
    send({ type: 'session', visitorId, sessionSeconds: seconds });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendSessionUpdate();
  });
  addEventListener('pagehide', sendSessionUpdate);
})();
