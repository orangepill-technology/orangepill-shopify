import { config } from '../../config';

// Generates the storefront JS snippet injected into every Shopify page via Script Tag.
// It:
//  1. Fetches an identity token from the App Proxy endpoint.
//  2. Renders a WhatsApp CTA button on product pages when configured.
//  3. Opens a webchat widget when configured.
//
// The script is parameterised at request time via query params (?shop=...) so no
// secrets are embedded — only the shop domain and public config values.
export function buildStorefrontScript(shopDomain: string, opts: {
  webchatEnabled: boolean;
  webchatEntrypointId: string | null;
  webchatEmbedUrl: string | null;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappFlowId: string | null;
}): string {
  const appUrl = config.APP_URL.replace(/\/$/, '');
  const identityEndpoint = `${appUrl}/apps/orangepill/identity`;

  return `
(function(){
  var SHOP = ${JSON.stringify(shopDomain)};
  var IDENTITY_ENDPOINT = ${JSON.stringify(identityEndpoint)};
  var WEBCHAT_ENABLED = ${opts.webchatEnabled};
  var WEBCHAT_ENTRYPOINT = ${JSON.stringify(opts.webchatEntrypointId)};
  var WEBCHAT_EMBED_URL = ${JSON.stringify(opts.webchatEmbedUrl)};
  var WA_ENABLED = ${opts.whatsappEnabled};
  var WA_NUMBER = ${JSON.stringify(opts.whatsappNumber)};
  var WA_FLOW_ID = ${JSON.stringify(opts.whatsappFlowId)};

  function fetchIdentityToken(cb) {
    var url = IDENTITY_ENDPOINT + '?shop=' + encodeURIComponent(SHOP);
    // Pass Shopify customer meta if available via Liquid globals
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.page && window.ShopifyAnalytics.meta.page.customerId) {
      url += '&logged_in_customer_id=' + encodeURIComponent(window.ShopifyAnalytics.meta.page.customerId);
    }
    fetch(url).then(function(r){ return r.json(); }).then(function(d){ cb(d.token || null); }).catch(function(){ cb(null); });
  }

  function buildWaUrl(productContext, identityToken) {
    var target = WA_FLOW_ID || WA_NUMBER;
    if (!target) return null;
    var msg = 'Hola, me interesa este producto: ' + productContext.title + ' ' + productContext.url;
    if (identityToken) msg += ' [id:' + identityToken.substring(0, 16) + '...]';
    if (WA_FLOW_ID) {
      return 'https://wa.me/' + encodeURIComponent(WA_FLOW_ID) + '?text=' + encodeURIComponent(msg);
    }
    return 'https://wa.me/' + WA_NUMBER.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg);
  }

  function injectWaButton(token) {
    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    if (!meta || !meta.product) return;
    var product = meta.product;
    var productCtx = { title: product.title || '', url: window.location.href };
    var href = buildWaUrl(productCtx, token);
    if (!href) return;

    var btn = document.createElement('a');
    btn.href = href;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:center;width:100%;padding:12px;margin-top:8px;background:#25D366;color:#fff;border-radius:4px;text-decoration:none;font-weight:600;font-size:14px;';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.824L0 24l6.335-1.508A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.016-1.381l-.36-.214-3.732.888.929-3.63-.234-.373A9.781 9.781 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg> Consultar por WhatsApp';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;margin-top:8px;';
    wrapper.appendChild(btn);

    // Try common Shopify theme add-to-cart form selectors
    var selectors = ['form[action="/cart/add"] .shopify-payment-button', 'form[action="/cart/add"] .product-form__buttons', 'form[action="/cart/add"]'];
    for (var i = 0; i < selectors.length; i++) {
      var target = document.querySelector(selectors[i]);
      if (target) { target.parentNode.insertBefore(wrapper, target.nextSibling); return; }
    }
    // Fallback: insert after the first add-to-cart button found
    var addBtn = document.querySelector('[name="add"], .btn-addtocart, .add-to-cart');
    if (addBtn) addBtn.parentNode.insertBefore(wrapper, addBtn.nextSibling);
  }

  function initWebchat(token) {
    if (!WEBCHAT_EMBED_URL) return;
    var el = document.createElement('div');
    el.id = 'op-webchat-root';
    el.setAttribute('data-entrypoint', WEBCHAT_ENTRYPOINT || '');
    el.setAttribute('data-identity-token', token || '');
    el.setAttribute('data-shop', SHOP);
    el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;';
    document.body.appendChild(el);

    var s = document.createElement('script');
    s.src = WEBCHAT_EMBED_URL;
    s.async = true;
    document.body.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', function() {
    fetchIdentityToken(function(token) {
      if (WA_ENABLED) injectWaButton(token);
      if (WEBCHAT_ENABLED) initWebchat(token);
    });
  });
})();
`.trim();
}
