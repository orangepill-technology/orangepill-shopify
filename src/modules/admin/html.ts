import { config } from '../../config';

type Status = string;

const STATUS_COLOR: Record<string, string> = {
  sent: '#008060',
  paid: '#008060',
  pending: '#916a00',
  processing: '#916a00',
  failed: '#d82c0d',
  expired: '#8c9196',
};

function badge(status: Status): string {
  const color = STATUS_COLOR[status] ?? '#8c9196';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${status}</span>`;
}

function fmt(d: Date | string): string {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
}

function layout(title: string, shop: string, body: string, refreshMs = 10_000): string {
  const host = ''; // passed in dynamically when embedding
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Orangepill</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f6f7;color:#202223}
    .container{max-width:1200px;margin:0 auto;padding:20px}
    nav{background:#fff;border-bottom:1px solid #e1e3e5;padding:0 20px;display:flex;gap:4px}
    nav a{display:inline-block;padding:12px 16px;text-decoration:none;color:#202223;font-size:14px;border-bottom:3px solid transparent}
    nav a.active{border-bottom-color:#008060;font-weight:600;color:#008060}
    nav a:hover{background:#f6f6f7}
    .card{background:#fff;border:1px solid #e1e3e5;border-radius:8px;overflow:hidden;margin-bottom:16px}
    .card-header{padding:12px 16px;border-bottom:1px solid #e1e3e5;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{padding:10px 12px;background:#f6f6f7;border-bottom:1px solid #e1e3e5;text-align:left;font-weight:600;color:#6d7175}
    td{padding:10px 12px;border-bottom:1px solid #f1f2f4;vertical-align:top}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafbfb}
    .mono{font-family:monospace;font-size:12px}
    .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;padding:16px}
    .stat{background:#f6f6f7;border-radius:6px;padding:12px 16px}
    .stat-label{font-size:12px;color:#6d7175;margin-bottom:4px}
    .stat-value{font-size:24px;font-weight:700}
    .stat-value.green{color:#008060}
    .stat-value.red{color:#d82c0d}
    .stat-value.yellow{color:#916a00}
    .error-cell{color:#d82c0d;font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .btn{display:inline-block;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;border:none;text-decoration:none}
    .btn-primary{background:#008060;color:#fff}
    .btn-primary:hover{background:#006e52}
    .btn-danger{background:#d82c0d;color:#fff}
    .btn-danger:hover{background:#bc2309}
    .filters{padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e1e3e5;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    select,input{padding:6px 10px;border:1px solid #c9cccf;border-radius:4px;font-size:13px}
    .empty{padding:32px;text-align:center;color:#6d7175}
    .refresh-info{font-size:12px;color:#8c9196;padding:8px 16px}
  </style>
</head>
<body>
  <script>
    try {
      const p = new URLSearchParams(window.location.search);
      const h = p.get('host');
      if (h && window.shopify) {
        window.shopify.createApp({ apiKey: '${config.SHOPIFY_API_KEY}', host: h });
      }
    } catch(e) {}
    setTimeout(() => location.reload(), ${refreshMs});
  </script>
  <nav>
    <a href="/app?shop=${shop}" ${title === 'Overview' ? 'class="active"' : ''}>Overview</a>
    <a href="/app/events?shop=${shop}" ${title === 'Sync Events' ? 'class="active"' : ''}>Sync Events</a>
    <a href="/app/events/failed?shop=${shop}" ${title === 'Failed Events' ? 'class="active"' : ''}>Failed Events</a>
    <a href="/app/payments?shop=${shop}" ${title === 'Payments' ? 'class="active"' : ''}>Payments</a>
  </nav>
  <div class="container">
    ${body}
  </div>
  <div class="refresh-info">Auto-refreshing every 10 seconds</div>
</body>
</html>`;
}

export interface HealthStats {
  syncEvents: { pending: number; sent: number; failed: number };
  payments: { pending: number; processing: number; paid: number; failed: number; expired: number };
  lastWebhookAt: Date | null;
}

export function renderOverview(shop: string, stats: HealthStats, recentEvents: unknown[]): string {
  const events = recentEvents as Array<{
    id: string; eventType: string; resourceId: string; status: string; createdAt: Date
  }>;

  const body = `
    <h1 style="font-size:20px;font-weight:700;margin:16px 0 12px">Overview</h1>

    <div class="card">
      <div class="card-header">Sync Events</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-label">Pending</div><div class="stat-value yellow">${stats.syncEvents.pending}</div></div>
        <div class="stat"><div class="stat-label">Sent</div><div class="stat-value green">${stats.syncEvents.sent}</div></div>
        <div class="stat"><div class="stat-label">Failed</div><div class="stat-value ${stats.syncEvents.failed > 0 ? 'red' : ''}">${stats.syncEvents.failed}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Payments</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-label">Pending</div><div class="stat-value yellow">${stats.payments.pending}</div></div>
        <div class="stat"><div class="stat-label">Processing</div><div class="stat-value yellow">${stats.payments.processing}</div></div>
        <div class="stat"><div class="stat-label">Paid</div><div class="stat-value green">${stats.payments.paid}</div></div>
        <div class="stat"><div class="stat-label">Failed</div><div class="stat-value ${stats.payments.failed > 0 ? 'red' : ''}">${stats.payments.failed}</div></div>
        <div class="stat"><div class="stat-label">Expired</div><div class="stat-value">${stats.payments.expired}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        Recent Sync Events
        <a href="/app/events?shop=${shop}" class="btn btn-primary">View all</a>
      </div>
      ${events.length === 0
        ? '<div class="empty">No events recorded yet</div>'
        : `<table>
          <thead><tr><th>Time</th><th>Type</th><th>Order</th><th>Status</th></tr></thead>
          <tbody>${events.map((e) => `
            <tr>
              <td class="mono">${fmt(e.createdAt)}</td>
              <td>${e.eventType}</td>
              <td class="mono">${e.resourceId}</td>
              <td>${badge(e.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`}
    </div>

    <div class="card" style="padding:12px 16px;font-size:13px;color:#6d7175">
      Last webhook: ${stats.lastWebhookAt ? fmt(stats.lastWebhookAt) : 'none recorded'}
      &nbsp;·&nbsp; Shop: <strong>${shop}</strong>
    </div>`;

  return layout('Overview', shop, body);
}

export function renderEvents(
  shop: string,
  events: unknown[],
  statusFilter: string,
  eventTypeFilter: string,
  nextCursor: string | null,
): string {
  const rows = events as Array<{
    id: string; eventType: string; resourceId: string; idempotencyKey: string;
    status: string; attemptCount: number; lastError: string | null; createdAt: Date
  }>;

  const queryBase = (extra = '') =>
    `/app/events?shop=${shop}${statusFilter ? `&status=${statusFilter}` : ''}${eventTypeFilter ? `&eventType=${eventTypeFilter}` : ''}${extra}`;

  const body = `
    <h1 style="font-size:20px;font-weight:700;margin:16px 0 12px">Sync Events</h1>
    <div class="card">
      <form class="filters" method="GET" action="/app/events">
        <input name="shop" value="${shop}" type="hidden">
        <select name="status" onchange="this.form.submit()">
          <option value="">All statuses</option>
          ${['pending','sent','failed'].map((s) => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select name="eventType" onchange="this.form.submit()">
          <option value="">All types</option>
          ${['order.finalized','order.refunded'].map((t) => `<option value="${t}" ${eventTypeFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </form>
      ${rows.length === 0
        ? '<div class="empty">No events match the current filter</div>'
        : `<table>
          <thead><tr><th>Time</th><th>Type</th><th>Order</th><th>Status</th><th>Attempts</th><th>Error</th><th></th></tr></thead>
          <tbody>${rows.map((e) => `
            <tr>
              <td class="mono">${fmt(e.createdAt)}</td>
              <td>${e.eventType}</td>
              <td class="mono">${e.resourceId}</td>
              <td>${badge(e.status)}</td>
              <td style="text-align:center">${e.attemptCount}</td>
              <td class="error-cell" title="${e.lastError ?? ''}">${e.lastError ?? '—'}</td>
              <td>
                ${e.status === 'failed'
                  ? `<form method="POST" action="/app/events/replay" style="display:inline">
                      <input type="hidden" name="eventId" value="${e.id}">
                      <input type="hidden" name="shop" value="${shop}">
                      <button class="btn btn-danger" type="submit">Replay</button>
                    </form>`
                  : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${nextCursor
          ? `<div style="padding:12px 16px"><a href="${queryBase(`&cursor=${nextCursor}`)}" class="btn btn-primary">Next page →</a></div>`
          : ''}`}
    </div>`;

  return layout('Sync Events', shop, body);
}

export function renderFailedEvents(shop: string, events: unknown[]): string {
  const rows = events as Array<{
    id: string; eventType: string; resourceId: string; idempotencyKey: string;
    status: string; attemptCount: number; lastError: string | null; createdAt: Date; updatedAt: Date
  }>;

  const body = `
    <h1 style="font-size:20px;font-weight:700;margin:16px 0 12px">
      Failed Events
      ${rows.length > 0 ? `<span style="background:#d82c0d;color:#fff;border-radius:20px;padding:2px 10px;font-size:14px;margin-left:8px">${rows.length}</span>` : ''}
    </h1>
    <div class="card">
      ${rows.length === 0
        ? '<div class="empty" style="color:#008060">✓ No failed events</div>'
        : `<table>
          <thead><tr><th>Last attempt</th><th>Type</th><th>Order</th><th>Attempts</th><th>Error</th><th>Action</th></tr></thead>
          <tbody>${rows.map((e) => `
            <tr>
              <td class="mono">${fmt(e.updatedAt)}</td>
              <td>${e.eventType}</td>
              <td class="mono">${e.resourceId}</td>
              <td style="text-align:center">${e.attemptCount}</td>
              <td class="error-cell" title="${e.lastError ?? ''}">${e.lastError ?? '—'}</td>
              <td>
                <form method="POST" action="/app/events/replay" style="display:inline">
                  <input type="hidden" name="eventId" value="${e.id}">
                  <input type="hidden" name="shop" value="${shop}">
                  <button class="btn btn-danger" type="submit">↺ Replay</button>
                </form>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`}
    </div>`;

  return layout('Failed Events', shop, body);
}

export function renderPayments(shop: string, payments: unknown[], nextCursor: string | null): string {
  const rows = payments as Array<{
    id: string; shopifyOrderId: string; orangepillSessionId: string;
    shopifyTransactionId: string | null; amount: string; currency: string;
    status: string; createdAt: Date
  }>;

  const body = `
    <h1 style="font-size:20px;font-weight:700;margin:16px 0 12px">Payments</h1>
    <div class="card">
      ${rows.length === 0
        ? '<div class="empty">No payments recorded yet</div>'
        : `<table>
          <thead><tr><th>Time</th><th>Order</th><th>Amount</th><th>Status</th><th>Session</th><th>Txn ID</th></tr></thead>
          <tbody>${rows.map((p) => `
            <tr>
              <td class="mono">${fmt(p.createdAt)}</td>
              <td class="mono">${p.shopifyOrderId}</td>
              <td class="mono">${p.amount} ${p.currency}</td>
              <td>${badge(p.status)}</td>
              <td class="mono" style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis">${p.orangepillSessionId}</td>
              <td class="mono">${p.shopifyTransactionId ?? '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${nextCursor
          ? `<div style="padding:12px 16px"><a href="/app/payments?shop=${shop}&cursor=${nextCursor}" class="btn btn-primary">Next page →</a></div>`
          : ''}`}
    </div>`;

  return layout('Payments', shop, body);
}

export function renderReplayResult(shop: string, ok: boolean, error?: string): string {
  const body = `
    <div class="card" style="padding:24px;text-align:center">
      ${ok
        ? '<div style="color:#008060;font-size:24px;margin-bottom:8px">✓</div><div style="font-weight:600">Replay submitted successfully</div>'
        : `<div style="color:#d82c0d;font-size:24px;margin-bottom:8px">✗</div><div style="font-weight:600">Replay failed: ${error ?? 'unknown error'}</div>`}
      <div style="margin-top:16px">
        <a href="/app/events/failed?shop=${shop}" class="btn btn-primary">← Back to failed events</a>
      </div>
    </div>`;

  return layout('Replay', shop, body, 0); // no auto-refresh on result page
}
