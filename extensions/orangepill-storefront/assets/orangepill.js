// Orangepill Storefront Extension
// Handles three features depending on which blocks are active:
//   1. Sticky WhatsApp button      — App Embed + whatsappStickyEnabled in settings
//   2. Rufus-style webchat panel   — App Embed + webchatEnabled in settings
//   3. Inline product-page WA CTA  — whatsapp-button section block
//
// Config is fetched from /apps/orangepill/settings at runtime.
// Identity tokens are fetched server-side — the HMAC secret never reaches the browser.
(function () {
  'use strict';

  if (window.__opInitialised) return;
  window.__opInitialised = true;

  // ── Root elements ──────────────────────────────────────────────────────────
  // App Embed block provides the anchor for global UI (sticky WA, chat panel).
  // Section block provides the anchor for the inline product-page WA button.
  var embedRoot = document.getElementById('op-embed-root');
  var waInlineRoot = document.querySelector('[data-op-block="whatsapp-button"]');
  var anyRoot = embedRoot || waInlineRoot;
  if (!anyRoot) return;

  var SHOP = anyRoot.getAttribute('data-shop');
  var PROXY = anyRoot.getAttribute('data-proxy-base') || '/apps/orangepill';
  if (!SHOP) return;

  // ── State ──────────────────────────────────────────────────────────────────
  var identityToken = null;
  var settings = {};
  var pending = 2;
  var panel = null;
  var panelContent = null;
  var embedLoaded = false;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  function jsonGet(url, cb) {
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { cb(null, d); })
      .catch(function (e) { cb(e, null); });
  }

  function customerParam() {
    var m = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    var id = m && m.page && m.page.customerId;
    return id ? '&logged_in_customer_id=' + encodeURIComponent(id) : '';
  }

  jsonGet(PROXY + '/identity?shop=' + encodeURIComponent(SHOP) + customerParam(), function (_, t) {
    identityToken = (t && t.token) || null;
    onReady();
  });

  jsonGet(PROXY + '/settings?shop=' + encodeURIComponent(SHOP), function (_, s) {
    settings = s || {};
    onReady();
  });

  function onReady() {
    if (--pending > 0) return;
    if (document.readyState !== 'loading') {
      boot();
    } else {
      document.addEventListener('DOMContentLoaded', boot);
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function boot() {
    // Feature 1: inline product-page WA button (section block, no embed needed)
    if (waInlineRoot && settings.whatsappEnabled) {
      renderInlineWa();
    }

    // Features 2 & 3 require the App Embed block
    if (!embedRoot) return;

    injectCSS();

    if (settings.webchatEnabled) {
      buildPanel();
      buildChatTrigger();
    }

    if (settings.whatsappStickyEnabled) {
      buildStickyWa();
    }

    // When both chat trigger and sticky WA share the same corner, shift WA left
    if (settings.webchatEnabled && settings.whatsappStickyEnabled) {
      var wa = document.getElementById('op-sticky-wa');
      if (wa) wa.style.right = '80px';
    }

    // Restore panel open state across page navigations
    if (settings.webchatEnabled && sessionStorage.getItem('op_panel') === '1') {
      openPanel();
    }
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('op-styles')) return;
    var el = document.createElement('style');
    el.id = 'op-styles';
    el.textContent =
      // Panel container
      '#op-panel{' +
        'position:fixed;bottom:80px;right:16px;width:380px;height:560px;' +
        'background:#fff;border-radius:16px;' +
        'box-shadow:0 8px 40px rgba(0,0,0,.18);z-index:999999;' +
        'display:flex;flex-direction:column;overflow:hidden;' +
        'transform:translateY(16px);opacity:0;pointer-events:none;' +
        'transition:transform .25s cubic-bezier(.4,0,.2,1),opacity .2s ease;' +
      '}' +
      '#op-panel.op-open{transform:translateY(0);opacity:1;pointer-events:auto}' +
      // Panel header
      '#op-panel-hd{' +
        'display:flex;align-items:center;justify-content:space-between;' +
        'padding:14px 16px;background:#1a1a1a;color:#fff;flex-shrink:0;user-select:none;' +
      '}' +
      '#op-panel-title{' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;' +
        'font-size:14px;font-weight:600;letter-spacing:.1px;' +
      '}' +
      '#op-panel-close{' +
        'background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;' +
        'padding:2px 4px;border-radius:4px;font-size:22px;line-height:1;' +
        'display:flex;align-items:center;' +
      '}' +
      '#op-panel-close:hover{color:#fff}' +
      // Panel body
      '#op-panel-bd{flex:1;overflow:hidden;position:relative;background:#f6f6f7}' +
      '#op-panel-content{width:100%;height:100%;overflow:auto}' +
      // Chat trigger bubble
      '#op-chat-trigger{' +
        'position:fixed;bottom:16px;right:16px;width:56px;height:56px;' +
        'border-radius:50%;background:#1a1a1a;color:#fff;border:none;cursor:pointer;' +
        'z-index:999998;display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.22);' +
        'transition:transform .15s ease,box-shadow .15s ease;' +
      '}' +
      '#op-chat-trigger:hover{transform:scale(1.06);box-shadow:0 6px 20px rgba(0,0,0,.28)}' +
      // Sticky WhatsApp button
      '#op-sticky-wa{' +
        'position:fixed;bottom:16px;right:16px;width:56px;height:56px;' +
        'border-radius:50%;background:#25D366;color:#fff;' +
        'display:flex;align-items:center;justify-content:center;' +
        'z-index:999997;box-shadow:0 4px 16px rgba(37,211,102,.35);' +
        'text-decoration:none;' +
        'transition:transform .15s ease,box-shadow .15s ease;' +
      '}' +
      '#op-sticky-wa:hover{transform:scale(1.06);box-shadow:0 6px 20px rgba(37,211,102,.42)}' +
      // Mobile: panel anchors to bottom, full width
      '@media(max-width:480px){' +
        '#op-panel{right:0;bottom:0;width:100vw;height:80vh;max-height:80vh;border-radius:16px 16px 0 0}' +
      '}';
    document.head.appendChild(el);
  }

  // ── Webchat panel ──────────────────────────────────────────────────────────
  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'op-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Chat');
    panel.setAttribute('aria-hidden', 'true');

    var hd = document.createElement('div');
    hd.id = 'op-panel-hd';

    var title = document.createElement('span');
    title.id = 'op-panel-title';
    title.textContent = 'Chat';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'op-panel-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closePanel);

    hd.appendChild(title);
    hd.appendChild(closeBtn);

    var bd = document.createElement('div');
    bd.id = 'op-panel-bd';
    panelContent = document.createElement('div');
    panelContent.id = 'op-panel-content';
    bd.appendChild(panelContent);

    panel.appendChild(hd);
    panel.appendChild(bd);
    document.body.appendChild(panel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && panel.classList.contains('op-open')) closePanel();
    });
  }

  function buildChatTrigger() {
    var btn = document.createElement('button');
    btn.id = 'op-chat-trigger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = chatIconSvg();
    btn.addEventListener('click', togglePanel);
    document.body.appendChild(btn);
  }

  function togglePanel() {
    if (panel && panel.classList.contains('op-open')) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    if (!panel) return;
    panel.classList.add('op-open');
    panel.setAttribute('aria-hidden', 'false');
    sessionStorage.setItem('op_panel', '1');
    loadEmbed();
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove('op-open');
    panel.setAttribute('aria-hidden', 'true');
    sessionStorage.removeItem('op_panel');
  }

  // Lazily load the Orangepill webchat embed script on first panel open.
  // window.OrangepillChatConfig is read by the embed script on initialisation.
  function loadEmbed() {
    if (embedLoaded) return;
    embedLoaded = true;
    if (!settings.webchatEmbedUrl) {
      panelContent.innerHTML =
        '<div style="padding:32px;text-align:center;color:#6d7175;' +
        'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:13px;">' +
        'Chat not configured.<br>Set the Embed script URL in Orangepill app settings.' +
        '</div>';
      return;
    }
    window.OrangepillChatConfig = {
      entrypointId: settings.webchatEntrypointId || null,
      identityToken: identityToken,
      shop: SHOP,
    };
    var s = document.createElement('script');
    s.src = settings.webchatEmbedUrl;
    s.async = true;
    panelContent.appendChild(s);
  }

  // ── Sticky WhatsApp button ─────────────────────────────────────────────────
  function buildStickyWa() {
    var href = waHref(settings);
    if (!href) return;

    var a = document.createElement('a');
    a.id = 'op-sticky-wa';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'WhatsApp');
    a.innerHTML = waIconSvg(28);
    document.body.appendChild(a);
  }

  // ── Inline WA button (whatsapp-button section block) ──────────────────────
  function renderInlineWa() {
    var href = waHref(settings);
    if (!href) return;

    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    var productTitle = (meta && meta.product && meta.product.title) || document.title;
    var msg = 'Hola, me interesa este producto: ' + productTitle + ' ' + window.location.href;
    var fullHref = href + '?text=' + encodeURIComponent(msg);

    var btnText = waInlineRoot.getAttribute('data-button-text') || 'Consultar por WhatsApp';

    var a = document.createElement('a');
    a.href = fullHref;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', btnText);
    a.style.cssText =
      'display:flex;align-items:center;gap:8px;justify-content:center;' +
      'width:100%;padding:12px;background:#25D366;color:#fff;' +
      'border-radius:4px;text-decoration:none;font-weight:600;font-size:14px;' +
      'cursor:pointer;box-sizing:border-box;font-family:inherit;';
    a.innerHTML = waIconSvg(20) + ' ' + btnText;
    waInlineRoot.appendChild(a);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function waHref(s) {
    if (!s.whatsappNumber && !s.whatsappFlowId) return null;
    var target = s.whatsappFlowId
      ? s.whatsappFlowId
      : s.whatsappNumber.replace(/[^0-9]/g, '');
    return 'https://wa.me/' + encodeURIComponent(target);
  }

  function waIconSvg(size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '"' +
      ' fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
      '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475' +
      '-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52' +
      '.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207' +
      '-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372' +
      '-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2' +
      ' 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118' +
      '.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413' +
      '-.074-.124-.272-.198-.57-.347z"/>' +
      '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.824L0 24l6.335-1.508' +
      'A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818' +
      'a9.793 9.793 0 01-5.016-1.381l-.36-.214-3.732.888.929-3.63-.234-.373' +
      'A9.781 9.781 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388' +
      ' 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>';
  }

  function chatIconSvg() {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  // Called by the Webchat Trigger section block and any custom storefront code.
  window.opOpenChat = openPanel;
  window.opCloseChat = closePanel;
})();
