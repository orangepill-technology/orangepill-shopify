// Orangepill Storefront Extension
// Reads config from data attributes on the block root element.
// Fetches identity token from App Proxy — HMAC secret never reaches the browser.
(function () {
  'use strict';

  // Deduplicate: only initialise once per page regardless of how many blocks render the script.
  if (window.__opInitialised) return;
  window.__opInitialised = true;

  // ── Config ───────────────────────────────────────────────────────────────────
  // Primary source: first WA button block found on the page.
  // Fallback: first webchat block.
  var waRoot = document.querySelector('[data-op-block="whatsapp-button"]');
  var wcRoot = document.querySelector('[data-op-block="webchat-widget"]');

  var SHOP = (waRoot || wcRoot) && (waRoot || wcRoot).getAttribute('data-shop');
  if (!SHOP) return; // no Orangepill block on this page

  var APP_PROXY_BASE = (waRoot || wcRoot).getAttribute('data-proxy-base') || '/apps/orangepill';

  var WA_ENABLED = waRoot && waRoot.getAttribute('data-enabled') === 'true';
  var WA_BUTTON_TEXT = waRoot && (waRoot.getAttribute('data-button-text') || 'Consultar por WhatsApp');
  // Phone / flow ID come from the server-side settings endpoint, not from Liquid,
  // so no sensitive data is embedded in theme templates.

  var WC_ENABLED = wcRoot && wcRoot.getAttribute('data-enabled') === 'true';
  var WC_ENTRYPOINT = wcRoot && wcRoot.getAttribute('data-entrypoint');
  var WC_EMBED_URL = wcRoot && wcRoot.getAttribute('data-embed-url');

  // ── Identity ─────────────────────────────────────────────────────────────────
  function fetchIdentityToken(cb) {
    var url = APP_PROXY_BASE + '/identity?shop=' + encodeURIComponent(SHOP);
    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    if (meta && meta.page && meta.page.customerId) {
      url += '&logged_in_customer_id=' + encodeURIComponent(meta.page.customerId);
    }
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(null, d.token || null); })
      .catch(function (e) { cb(e, null); });
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  // Fetch WA target (number / flow ID) from server — never hardcoded in Liquid.
  function fetchSettings(cb) {
    var url = APP_PROXY_BASE + '/settings?shop=' + encodeURIComponent(SHOP);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(null, d); })
      .catch(function (e) { cb(e, null); });
  }

  // ── WhatsApp button ──────────────────────────────────────────────────────────
  function buildWaUrl(settings, identityToken) {
    var target = settings.whatsappFlowId || settings.whatsappNumber;
    if (!target) return null;

    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    var title = (meta && meta.product && meta.product.title) || document.title;
    var productUrl = window.location.href;

    var msg = 'Hola, me interesa este producto: ' + title + ' ' + productUrl;
    if (identityToken) msg += ' [id:' + identityToken.substring(0, 16) + '...]';

    if (settings.whatsappFlowId) {
      return 'https://wa.me/' + encodeURIComponent(settings.whatsappFlowId) + '?text=' + encodeURIComponent(msg);
    }
    return 'https://wa.me/' + settings.whatsappNumber.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg);
  }

  function renderWaButton(container, settings, identityToken) {
    var href = buildWaUrl(settings, identityToken);
    if (!href) return;

    var btn = document.createElement('a');
    btn.href = href;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.setAttribute('aria-label', WA_BUTTON_TEXT);
    btn.style.cssText = [
      'display:flex', 'align-items:center', 'gap:8px', 'justify-content:center',
      'width:100%', 'padding:12px', 'background:#25D366', 'color:#fff',
      'border-radius:4px', 'text-decoration:none', 'font-weight:600', 'font-size:14px',
      'cursor:pointer', 'border:none',
    ].join(';');

    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
      '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.824L0 24l6.335-1.508A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.016-1.381l-.36-.214-3.732.888.929-3.63-.234-.373A9.781 9.781 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>' +
      '</svg> ' + WA_BUTTON_TEXT;

    container.appendChild(btn);
  }

  // ── Webchat widget ───────────────────────────────────────────────────────────
  function initWebchat(container, identityToken) {
    if (!WC_EMBED_URL) return;
    container.setAttribute('data-identity-token', identityToken || '');
    var s = document.createElement('script');
    s.src = WC_EMBED_URL;
    s.async = true;
    document.body.appendChild(s);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    if (!WA_ENABLED && !WC_ENABLED) return;

    // Parallel: identity token + settings
    var pending = 2;
    var identityToken = null;
    var settings = {};

    function maybeRender() {
      if (--pending > 0) return;
      if (WA_ENABLED && waRoot && settings.whatsappEnabled) renderWaButton(waRoot, settings, identityToken);
      if (WC_ENABLED && wcRoot) initWebchat(wcRoot, identityToken);
    }

    fetchIdentityToken(function (_, token) {
      identityToken = token;
      maybeRender();
    });

    fetchSettings(function (_, s) {
      settings = s || {};
      maybeRender();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
