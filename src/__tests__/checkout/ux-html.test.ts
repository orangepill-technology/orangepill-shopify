import {
  renderPreparePage,
  renderPrepareErrorPage,
  renderConfirmingPage,
  renderPendingTimeoutPage,
  renderSuccessPage,
  renderFailedPage,
  renderExpiredPage,
} from '../../modules/checkout/ux-html';

const SHOP = 'tienda.myshopify.com';
const ORDER_ID = '456';
const SINGLE = { amount: '75.00', currency: 'EUR' };
const MULTI = { amount: '100000.00', currency: 'COP', orderAmount: '25.00', orderCurrency: 'USD' };
const CHECKOUT_URL = 'https://pay.orangepill.cloud/sessions/abc123';

describe('renderPreparePage', () => {
  it('contains preparation copy', () => {
    const html = renderPreparePage(SHOP, SINGLE, CHECKOUT_URL);
    expect(html).toContain('Estamos preparando tu pago');
    expect(html).toContain('checkout seguro de Orangepill');
  });

  it('embeds checkout URL for JS redirect', () => {
    const html = renderPreparePage(SHOP, SINGLE, CHECKOUT_URL);
    expect(html).toContain(CHECKOUT_URL);
    expect(html).toContain('checkout-url');
    expect(html).toContain('setTimeout');
  });

  it('shows trust bullets', () => {
    const html = renderPreparePage(SHOP, SINGLE, CHECKOUT_URL);
    expect(html).toContain('Tu pedido sigue reservado');
    expect(html).toContain('Métodos locales disponibles');
  });

  it('shows both amounts for multi-currency', () => {
    const html = renderPreparePage(SHOP, MULTI, CHECKOUT_URL);
    expect(html).toContain('100000.00 COP');
    expect(html).toContain('25.00 USD');
    expect(html).toContain('Pedido original');
  });

  it('does not show original line for single currency', () => {
    const html = renderPreparePage(SHOP, SINGLE, CHECKOUT_URL);
    expect(html).not.toContain('Pedido original');
  });

  it('escapes shop domain in output', () => {
    const html = renderPreparePage(SHOP, SINGLE, CHECKOUT_URL);
    expect(html).toContain(SHOP);
    expect(html).not.toContain('<script>alert');
  });
});

describe('renderPrepareErrorPage', () => {
  it('contains error copy', () => {
    const html = renderPrepareErrorPage(SHOP, ORDER_ID);
    expect(html).toContain('No pudimos preparar tu pago');
    expect(html).toContain('Intenta de nuevo');
  });

  it('handles null shop gracefully', () => {
    const html = renderPrepareErrorPage(null, null);
    expect(html).toContain('No pudimos preparar tu pago');
  });
});

describe('renderConfirmingPage', () => {
  it('contains confirming copy', () => {
    const html = renderConfirmingPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('Estamos confirmando tu pago');
    expect(html).toContain('Esto puede tardar unos segundos');
    expect(html).toContain('No cierres esta página');
  });

  it('includes polling script', () => {
    const html = renderConfirmingPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('/checkout/status');
    expect(html).toContain('setTimeout');
    expect(html).toContain('/checkout/success');
    expect(html).toContain('/checkout/failed');
    expect(html).toContain('/checkout/expired');
  });

  it('shows multi-currency payment amounts', () => {
    const html = renderConfirmingPage(SHOP, ORDER_ID, MULTI);
    expect(html).toContain('100000.00 COP');
    expect(html).toContain('25.00 USD');
  });
});

describe('renderPendingTimeoutPage', () => {
  it('contains pending copy and is not success', () => {
    const html = renderPendingTimeoutPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('en proceso de confirmación');
    expect(html).toContain('Te avisaremos');
    expect(html).not.toContain('Pago confirmado');
  });

  it('has consultar estado button', () => {
    const html = renderPendingTimeoutPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('Consultar estado');
    expect(html).toContain('/checkout/confirming');
  });
});

describe('renderSuccessPage', () => {
  it('contains confirmed copy', () => {
    const html = renderSuccessPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('Pago confirmado');
    expect(html).toContain('Tu pedido ya fue actualizado');
  });

  it('shows paid amount', () => {
    const html = renderSuccessPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('75.00 EUR');
    expect(html).toContain('Total pagado');
  });

  it('shows both amounts for multi-currency', () => {
    const html = renderSuccessPage(SHOP, ORDER_ID, MULTI);
    expect(html).toContain('100000.00 COP');
    expect(html).toContain('25.00 USD');
    expect(html).toContain('Pedido original');
  });

  it('has ver pedido and volver buttons', () => {
    const html = renderSuccessPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('Ver pedido');
    expect(html).toContain('Volver a la tienda');
  });
});

describe('renderFailedPage', () => {
  it('contains failed copy', () => {
    const html = renderFailedPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('No pudimos completar tu pago');
    expect(html).toContain('Puedes intentarlo de nuevo');
  });

  it('has retry button pointing to prepare', () => {
    const html = renderFailedPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('Intentar de nuevo');
    expect(html).toContain('/checkout/prepare');
    expect(html).toContain(encodeURIComponent(ORDER_ID));
  });

  it('does not claim success', () => {
    const html = renderFailedPage(SHOP, ORDER_ID, SINGLE);
    expect(html).not.toContain('Pago confirmado');
  });
});

describe('renderExpiredPage', () => {
  it('contains expired copy distinct from failed', () => {
    const html = renderExpiredPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('La sesión de pago expiró');
    expect(html).toContain('Genera un nuevo pago');
    expect(html).not.toContain('No pudimos completar');
  });

  it('has generate button pointing to prepare', () => {
    const html = renderExpiredPage(SHOP, ORDER_ID, SINGLE);
    expect(html).toContain('Generar nuevo pago');
    expect(html).toContain('/checkout/prepare');
  });
});
