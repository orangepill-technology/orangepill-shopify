export interface PaymentDisplayInfo {
  amount: string;
  currency: string;
  orderAmount?: string | null;
  orderCurrency?: string | null;
}

const BASE_STYLES = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f6f7;color:#202223;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:32px 24px;max-width:440px;width:100%;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)}
  .icon{font-size:48px;margin-bottom:16px;line-height:1}
  .headline{font-size:22px;font-weight:700;color:#202223;margin-bottom:8px}
  .subtext{font-size:15px;color:#6d7175;line-height:1.5;margin-bottom:20px}
  .summary{background:#f6f6f7;border-radius:8px;padding:14px 16px;text-align:left;margin-bottom:24px;font-size:14px;line-height:1.8;color:#202223}
  .summary strong{color:#6d7175;font-weight:500}
  .actions{display:flex;flex-direction:column;gap:10px}
  .btn{display:block;width:100%;padding:14px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;border:none;text-decoration:none;text-align:center;transition:background .15s}
  .btn-primary{background:#008060;color:#fff}
  .btn-primary:hover{background:#006e52}
  .btn-secondary{background:#fff;color:#202223;border:1px solid #c9cccf}
  .btn-secondary:hover{background:#f6f6f7}
  .btn-warn{background:#d82c0d;color:#fff}
  .btn-warn:hover{background:#bc2309}
  .spinner{width:44px;height:44px;border:4px solid #e1e3e5;border-top-color:#008060;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 20px}
  .trust-list{list-style:none;text-align:left;margin-bottom:20px;font-size:14px;color:#6d7175;line-height:2}
  .trust-list li::before{content:"✓ ";color:#008060;font-weight:700}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .pulse-dot{width:12px;height:12px;border-radius:50%;background:#008060;animation:pulse 1.4s ease-in-out infinite;margin:0 auto 20px}
  .notice{font-size:12px;color:#8c9196;margin-top:16px}
`;

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Orangepill</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

function orderSummary(shop: string, info: PaymentDisplayInfo): string {
  const multiCurrency = info.orderCurrency && info.orderCurrency !== info.currency;
  return `<div class="summary">
    <div><strong>Tienda:</strong> ${escHtml(shop)}</div>
    <div><strong>Total a pagar:</strong> ${escHtml(info.amount)} ${escHtml(info.currency)}</div>
    ${multiCurrency ? `<div><strong>Pedido original:</strong> ${escHtml(info.orderAmount ?? '')} ${escHtml(info.orderCurrency ?? '')}</div>` : ''}
  </div>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Prepare ───────────────────────────────────────────────────────────────────

export function renderPreparePage(
  shop: string,
  info: PaymentDisplayInfo,
  checkoutUrl: string,
): string {
  const body = `
    <div class="spinner"></div>
    <div class="headline">Estamos preparando tu pago…</div>
    <div class="subtext">En unos segundos te redirigiremos al checkout seguro de Orangepill.</div>
    <ul class="trust-list">
      <li>Tu pedido sigue reservado</li>
      <li>Métodos locales disponibles</li>
      <li>No perderás tu compra</li>
    </ul>
    ${orderSummary(shop, info)}
    <div class="notice">🔒 Conexión segura</div>
    <input type="hidden" id="checkout-url" value="${escHtml(checkoutUrl)}">
    <script>
      var url = document.getElementById('checkout-url').value;
      if (url) { setTimeout(function(){ window.location.href = url; }, 1500); }
    </script>`;
  return layout('Preparando pago', body);
}

export function renderPrepareErrorPage(shop: string | null, _orderId: string | null): string {
  const backUrl = shop ? `https://${escHtml(shop)}` : '/';
  const body = `
    <div class="icon">⚠️</div>
    <div class="headline">No pudimos preparar tu pago.</div>
    <div class="subtext">Intenta de nuevo en unos segundos.</div>
    ${shop ? `<div class="summary"><strong>Tienda:</strong> ${escHtml(shop)}</div>` : ''}
    <div class="actions">
      <a href="${escHtml(backUrl)}" class="btn btn-secondary">Volver a la tienda</a>
    </div>`;
  return layout('Error de pago', body);
}

// ── Confirming ────────────────────────────────────────────────────────────────

export function renderConfirmingPage(
  shop: string,
  orderId: string,
  info: PaymentDisplayInfo,
): string {
  const multiCurrency = info.orderCurrency && info.orderCurrency !== info.currency;
  const body = `
    <div class="pulse-dot"></div>
    <div class="headline">Estamos confirmando tu pago con la tienda…</div>
    <div class="subtext">Esto puede tardar unos segundos.</div>
    <div class="summary">
      <div><strong>Tienda:</strong> ${escHtml(shop)}</div>
      <div><strong>Pagado:</strong> ${escHtml(info.amount)} ${escHtml(info.currency)}</div>
      ${multiCurrency ? `<div><strong>Pedido original:</strong> ${escHtml(info.orderAmount ?? '')} ${escHtml(info.orderCurrency ?? '')}</div>` : ''}
    </div>
    <div class="notice">No cierres esta página todavía.</div>
    <script>
      (function(){
        var shop = ${JSON.stringify(shop)};
        var orderId = ${JSON.stringify(orderId)};
        var polls = 0, MAX = 12, INTERVAL = 2500;
        function poll(){
          fetch('/checkout/status?shop='+encodeURIComponent(shop)+'&orderId='+encodeURIComponent(orderId))
            .then(function(r){ return r.json(); })
            .then(function(d){
              if(d.status==='paid'){
                window.location.href='/checkout/success?shop='+encodeURIComponent(shop)+'&orderId='+encodeURIComponent(orderId);
              } else if(d.status==='failed'){
                window.location.href='/checkout/failed?shop='+encodeURIComponent(shop)+'&orderId='+encodeURIComponent(orderId);
              } else if(d.status==='expired'){
                window.location.href='/checkout/expired?shop='+encodeURIComponent(shop)+'&orderId='+encodeURIComponent(orderId);
              } else {
                polls++;
                if(polls < MAX) setTimeout(poll, INTERVAL);
                else window.location.href='/checkout/confirming?shop='+encodeURIComponent(shop)+'&orderId='+encodeURIComponent(orderId)+'&timeout=1';
              }
            })
            .catch(function(){ polls++; if(polls < MAX) setTimeout(poll, INTERVAL); });
        }
        setTimeout(poll, INTERVAL);
      })();
    </script>`;
  return layout('Confirmando pago', body);
}

export function renderPendingTimeoutPage(
  shop: string,
  orderId: string,
  info: PaymentDisplayInfo,
): string {
  const statusUrl = `/checkout/confirming?shop=${encodeURIComponent(shop)}&orderId=${encodeURIComponent(orderId)}`;
  const backUrl = `https://${shop}`;
  const body = `
    <div class="icon">⏳</div>
    <div class="headline">Tu pago está en proceso de confirmación.</div>
    <div class="subtext">Te avisaremos en cuanto se confirme.</div>
    ${orderSummary(shop, info)}
    <div class="actions">
      <a href="${escHtml(statusUrl)}" class="btn btn-primary">Consultar estado</a>
      <a href="${escHtml(backUrl)}" class="btn btn-secondary">Volver a la tienda</a>
    </div>`;
  return layout('Confirmación pendiente', body);
}

// ── Terminal states ───────────────────────────────────────────────────────────

export function renderSuccessPage(
  shop: string,
  orderId: string,
  info: PaymentDisplayInfo,
): string {
  const multiCurrency = info.orderCurrency && info.orderCurrency !== info.currency;
  const orderUrl = `https://${shop}/account/orders`;
  const backUrl = `https://${shop}`;
  const body = `
    <div class="icon">✅</div>
    <div class="headline">Pago confirmado.</div>
    <div class="subtext">Tu pedido ya fue actualizado correctamente.</div>
    <div class="summary">
      <div><strong>Total pagado:</strong> ${escHtml(info.amount)} ${escHtml(info.currency)}</div>
      ${multiCurrency ? `<div><strong>Pedido original:</strong> ${escHtml(info.orderAmount ?? '')} ${escHtml(info.orderCurrency ?? '')}</div>` : ''}
      <div><strong>Tienda:</strong> ${escHtml(shop)}</div>
    </div>
    <div class="actions">
      <a href="${escHtml(orderUrl)}" class="btn btn-primary">Ver pedido</a>
      <a href="${escHtml(backUrl)}" class="btn btn-secondary">Volver a la tienda</a>
    </div>`;
  return layout('Pago confirmado', body);
}

export function renderFailedPage(
  shop: string,
  orderId: string,
  info: PaymentDisplayInfo,
): string {
  const retryUrl = `/checkout/prepare?shop=${encodeURIComponent(shop)}&orderId=${encodeURIComponent(orderId)}`;
  const backUrl = `https://${shop}`;
  const body = `
    <div class="icon">❌</div>
    <div class="headline">No pudimos completar tu pago.</div>
    <div class="subtext">Puedes intentarlo de nuevo.</div>
    ${orderSummary(shop, info)}
    <div class="actions">
      <a href="${escHtml(retryUrl)}" class="btn btn-warn">Intentar de nuevo</a>
      <a href="${escHtml(backUrl)}" class="btn btn-secondary">Volver a la tienda</a>
    </div>`;
  return layout('Pago fallido', body);
}

export function renderExpiredPage(
  shop: string,
  orderId: string,
  info: PaymentDisplayInfo,
): string {
  const retryUrl = `/checkout/prepare?shop=${encodeURIComponent(shop)}&orderId=${encodeURIComponent(orderId)}`;
  const backUrl = `https://${shop}`;
  const body = `
    <div class="icon">⏳</div>
    <div class="headline">La sesión de pago expiró.</div>
    <div class="subtext">Genera un nuevo pago para continuar.</div>
    ${orderSummary(shop, info)}
    <div class="actions">
      <a href="${escHtml(retryUrl)}" class="btn btn-primary">Generar nuevo pago</a>
      <a href="${escHtml(backUrl)}" class="btn btn-secondary">Volver</a>
    </div>`;
  return layout('Sesión expirada', body);
}
