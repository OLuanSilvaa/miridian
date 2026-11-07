import assert from 'node:assert/strict';
import { ROUTES, resolveRoute, routeHref, createHashRouter, createViewLoader } from '../assets/js/router.js';
import { createTestBrowser } from './browser-stub.js';
import { runAppSmoke } from './app-smoke.js';
import { MiridianStore, selectDashboard } from '../assets/js/state.js';
import { renderEntityPage, renderSettingsPage, renderReportsPage, getReportData } from '../assets/js/modules/screens.js';

export const navigationChecks = [
  ['Todas as opções da sidebar têm rotas diretas válidas', () => {
    assert.equal(ROUTES.length, 14);
    assert.equal(new Set(ROUTES.map(route => route.path)).size, 14);
    for (const route of ROUTES) assert.equal(resolveRoute(routeHref(route.id)).id, route.id);
    assert.equal(resolveRoute('#/pagina-inexistente').id, 'dashboard');
  }],
  ['Links de indicadores preservam filtros codificados e ignoram parâmetros desconhecidos', () => {
    const href = routeHref('requests', { status: 'Aguardando aprovação', filter: 'overdue', ignored: 'x' });
    const route = resolveRoute(href);
    assert.equal(route.params.status, 'Aguardando aprovação'); assert.equal(route.params.filter, 'overdue');
    assert.equal(route.params.ignored, undefined);
    assert.equal(resolveRoute('#/unidades?filter=overdue').params.filter, undefined);
  }],
  ['Histórico volta e avança uma vez por rota, preservando o subdiretório', () => {
    const browser = createTestBrowser(); const visits = [];
    const router = createHashRouter({ target: browser, onChange: route => visits.push(route.id) });
    router.start(); router.navigate('requests'); router.navigate('contracts');
    browser.history.back(); assert.equal(router.current.id, 'requests');
    browser.history.forward(); assert.equal(router.current.id, 'contracts');
    assert.deepEqual(visits, ['dashboard', 'requests', 'contracts', 'requests', 'contracts']);
    assert.equal(browser.location.pathname, '/portfolio/sistema/index.html');
    router.navigate('settings', {}, { replace: true }); assert.equal(browser.history.length, 3);
    router.destroy(); browser.history.back(); assert.equal(router.current.id, 'settings');
  }],
  ['Carregamento assíncrono compartilha a mesma requisição e reutiliza o módulo', async () => {
    let count = 0, release;
    const load = createViewLoader({ screens: () => { count++; return new Promise(resolve => { release = resolve; }); } });
    const first = load('screens'), second = load('screens'); assert.equal(first, second);
    await Promise.resolve(); release({ ready: true });
    const loaded = await first; assert.equal(await second, loaded); assert.equal(await load('screens'), loaded); assert.equal(count, 1);
  }],
  ['Falha de carregamento permite uma nova tentativa', async () => {
    let attempts = 0;
    const load = createViewLoader({ screens: () => { if (++attempts === 1) throw new Error('Rede indisponível'); return { ready: true }; } });
    await assert.rejects(load('screens'), /Rede indisponível/);
    assert.equal((await load('screens')).ready, true); assert.equal(attempts, 2);
  }],
  ['Cada tela renderiza indicadores e registros relacionados à unidade', () => {
    const values = new Map(); const store = new MiridianStore({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
    store.load(); store.updatePreferences({ unitId: 'U03' });
    const model = selectDashboard(store.data);
    const ui = { explorer: { page: 1, query: '', sort: 0 }, chartMode: 'month', hiddenSeries: new Set(), reportId: 'units', reportPage: 1 };
    for (const route of ROUTES.filter(route => route.module === 'screens')) {
      const html = route.id === 'settings' ? renderSettingsPage(route, store) : route.id === 'reports' ? renderReportsPage(route, store, ui, model).html : renderEntityPage(route, store, ui, model).html;
      assert.ok(html.includes(`<h1>${route.title}`), route.id); assert.ok(!/NaN|undefined|Infinity/.test(html), route.id);
    }
    assert.equal(getReportData(model, store, 'units').rows.length, 1);
    assert.equal(getReportData(model, store, 'finance').rows.length, model.transactions.length);
    assert.equal(getReportData(model, store, 'departments').rows.length, model.departments.length);
    assert.equal(getReportData(model, store, 'statuses').rows.length, model.statuses.length);
  }],
  ['Link direto inicial abre a tela correta sem exigir navegação pelo dashboard', () => runAppSmoke('#/contratos')],
];
