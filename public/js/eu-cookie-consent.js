/**
 * EU-focused cookie consent: necessary by default; marketing pixel only after opt-in.
 * Set META_PIXEL_ID when your Meta (Facebook) pixel is ready.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'vantage_cookie_consent_v1';
  /** Paste your Meta Pixel ID here (digits only). Leave empty until the pixel is live. */
  var META_PIXEL_ID = '';

  function storageGet() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storageSet(v) {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {}
  }

  function loadMetaPixel(pixelId) {
    if (!pixelId || typeof pixelId !== 'string' || !/^\d+$/.test(String(pixelId).trim())) return;
    if (window.fbq) return;
    var id = String(pixelId).trim();
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function applyConsentFromStorage() {
    if (storageGet() === 'marketing') loadMetaPixel(META_PIXEL_ID);
  }

  function removeBanner() {
    var el = document.getElementById('vantage-cookie-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function injectBannerStyles() {
    if (document.getElementById('vantage-cookie-banner-styles')) return;
    var s = document.createElement('style');
    s.id = 'vantage-cookie-banner-styles';
    s.textContent =
      '#vantage-cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
      'padding:1rem clamp(1rem,4vw,1.5rem);background:#0b0b0d;color:#f5f3f0;' +
      'border-top:1px solid rgba(255,255,255,0.12);box-shadow:0 -8px 32px rgba(0,0,0,0.35);' +
      'font-family:system-ui,-apple-system,sans-serif;font-size:0.875rem;line-height:1.5;}' +
      '#vantage-cookie-banner .vc-inner{max-width:56rem;margin:0 auto;display:flex;' +
      'flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;}' +
      '#vantage-cookie-banner .vc-text{flex:1;min-width:min(100%,280px);margin:0;color:rgba(245,243,240,0.92);}' +
      '#vantage-cookie-banner .vc-text a{color:#a5b4fc;text-decoration:underline;}' +
      '#vantage-cookie-banner .vc-actions{display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;}' +
      '#vantage-cookie-banner button{font:inherit;cursor:pointer;border-radius:999px;padding:0.55rem 1.1rem;' +
      'font-weight:600;font-size:0.8125rem;border:none;}' +
      '#vantage-cookie-banner .vc-reject{background:rgba(255,255,255,0.1);color:#f5f3f0;border:1px solid rgba(255,255,255,0.2);}' +
      '#vantage-cookie-banner .vc-reject:hover{background:rgba(255,255,255,0.14);}' +
      '#vantage-cookie-banner .vc-accept{background:#6366f1;color:#fff;}' +
      '#vantage-cookie-banner .vc-accept:hover{background:#4f46e5;}';
    document.head.appendChild(s);
  }

  function showBanner(force) {
    if (!force && storageGet()) return;
    injectBannerStyles();
    if (document.getElementById('vantage-cookie-banner')) return;

    var wrap = document.createElement('div');
    wrap.id = 'vantage-cookie-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', 'Cookies and marketing');
    wrap.innerHTML =
      '<div class="vc-inner">' +
      '<p class="vc-text">We use necessary cookies so the site works. If you accept, we also use a ' +
      'marketing pixel (e.g. Meta) to measure campaigns. You can change this anytime via ' +
      '<strong>Cookie settings</strong> in the footer. <a href="/cookie-policy">Cookie policy</a>.</p>' +
      '<div class="vc-actions">' +
      '<button type="button" class="vc-reject" data-vc-reject>Reject non-essential</button>' +
      '<button type="button" class="vc-accept" data-vc-accept>Accept</button>' +
      '</div></div>';

    document.body.appendChild(wrap);

    wrap.querySelector('[data-vc-reject]').addEventListener('click', function () {
      storageSet('necessary');
      removeBanner();
    });
    wrap.querySelector('[data-vc-accept]').addEventListener('click', function () {
      storageSet('marketing');
      loadMetaPixel(META_PIXEL_ID);
      removeBanner();
    });
  }

  function bindFooterButtons() {
    document.querySelectorAll('[data-vantage-cookie-settings]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        showBanner(true);
      });
    });
  }

  function init() {
    applyConsentFromStorage();
    if (!storageGet()) showBanner(false);
    bindFooterButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.openVantageCookieSettings = function () {
    showBanner(true);
  };
})();
