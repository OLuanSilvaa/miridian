import { createHashRouter, resolveRoute, routeHref, createViewLoader } from './router.js';
import { sidebar } from './navigation.js';
import { selectDashboard } from './state.js';
import { explorerContent, ENTITY_LABELS } from './modules/explorer.js';
import { groupFinance, wireChart } from './charts.js';
import { icon, avatar } from './components.js';
import { escapeHTML as e } from './formatters.js';

export function createScreenHost({ store, identity, ui, header, closeDialog, target = globalThis.window }) {
  const loadView = createViewLoader({ dashboard: () => import('./modules/dashboard.js'), screens: () => import('./modules/screens.js') });
  ui.route = resolveRoute(target.location.hash);
  ui.explorers = new Map();
  ui.reportId = 'units';
  ui.reportPage = 1;
  ui.viewReady = Promise.resolve();
  let revision = 0;
  let renderedHash = null;

  // The shell is mounted once. Navigation only replaces the main content.
  document.getElementById('app').innerHTML = `${sidebar(selectDashboard(store.data).pending.length, ui.route.id)}<div class="app-shell">${header()}<main id="main" class="main-content" tabindex="-1"></main></div><div id="route-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>`;

  function syncShell(model) {
    const p = store.data.preferences;
    document.documentElement.dataset.theme = p.theme;
    document.body.classList.toggle('sidebar-collapsed', !!p.collapsed);
    document.body.classList.toggle('compact', p.density === 'compact');
    document.title = `${ui.route.title} · Miridian`;
    document.getElementById('breadcrumb-current').textContent = ui.route.title;
    for (const link of document.querySelectorAll('.nav-item')) {
      const active = link.dataset.nav === ui.route.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    document.getElementById('pending-count').textContent = model.pending.length;
    document.getElementById('collapse-sidebar').setAttribute('aria-label', p.collapsed ? 'Expandir menu' : 'Recolher menu');
    const selector = document.getElementById('top-unit');
    const options = `<option value="all">Todas as unidades</option>${store.data.units.map(unit => `<option value="${e(unit.id)}">${e(unit.name)} · ${e(unit.city)}</option>`).join('')}`;
    if (selector.innerHTML !== options) selector.innerHTML = options;
    selector.value = p.unitId;
    const theme = document.getElementById('theme-toggle');
    theme.innerHTML = icon(p.theme === 'light' ? 'moon' : 'sun', 17);
    theme.setAttribute('aria-label', p.theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro');
    const userButton = document.getElementById('visitor-button');
    userButton.innerHTML = `${avatar(identity.name)}<span class="user-info"><strong>${e(identity.name)}</strong><small>Preferências pessoais</small></span>${icon('down', 12)}`;
    userButton.setAttribute('aria-label', `Alterar seu nome. Atual: ${identity.name}`);
    const unread = store.data.notifications.filter(row => !row.read).length;
    const notification = document.getElementById('notification-button');
    notification.innerHTML = `${icon('bell', 19)}${unread ? '<i class="notification-dot"></i>' : ''}`;
    notification.setAttribute('aria-label', unread ? `Notificações: ${unread} não lidas` : 'Notificações');
  }

  function explorerState(route) {
    if (!ui.explorers.has(route.hash)) ui.explorers.set(route.hash, { page: 1, query: '', sort: 0, direction: ['requests', 'audit', 'transactions'].includes(route.id) ? 'desc' : 'asc', ...route.params });
    ui.explorer = ui.explorers.get(route.hash);
    ui.explorerEntity = route.id;
  }

  function storageBanner() {
    return store.error ? `<div class="storage-banner" role="alert">${icon('alert', 19)}<span>${e(store.error)} ${store.recovery ? 'A base original foi preservada; esta sessão usa dados temporários.' : ''}</span><button class="text-button" data-action="settings">Gerenciar dados ${icon('arrow', 14)}</button></div>` : '';
  }

  async function renderView({ focus = false } = {}) {
    const currentRevision = ++revision;
    const route = ui.route;
    const focusedId = document.activeElement?.id;
    const main = document.getElementById('main');
    const model = selectDashboard(store.data);
    syncShell(model);
    main.setAttribute('aria-busy', 'true');
    if (renderedHash !== route.hash) main.innerHTML = `<div class="route-loading" role="status"><span class="loading-ring"></span><p>Carregando ${e(route.title.toLowerCase())}…</p></div>`;
    try {
      const view = await loadView(route.module);
      if (currentRevision !== revision) return;
      let content;
      ui.explorerEntity = null;
      ui.explorerResult = null;
      if (route.id === 'dashboard') content = view.renderDashboard(model, store, ui);
      else if (route.id === 'settings') content = view.renderSettingsPage(route, store, identity);
      else if (route.id === 'reports') {
        const result = view.renderReportsPage(route, store, ui, model);
        content = result.html; ui.reportResult = result.report;
      } else {
        explorerState(route);
        const result = view.renderEntityPage(route, store, ui, model);
        content = result.html; ui.explorerResult = result.explorer;
      }
      main.innerHTML = storageBanner() + content;
      main.dataset.view = route.id;
      main.setAttribute('aria-label', route.title);
      const period = document.getElementById('period-filter');
      if (period) period.value = store.data.preferences.period;
      const unit = document.getElementById('dashboard-unit');
      if (unit) unit.value = store.data.preferences.unitId;
      wireChart(main, groupFinance(model.transactions, model.range, ui.chartMode, model.referenceDate));
      if (renderedHash !== route.hash) document.getElementById('route-announcer').textContent = `${route.title} carregada`;
      renderedHash = route.hash;
      if (focus) { main.focus({ preventScroll: true }); target.scrollTo({ top: 0, behavior: 'auto' }); }
      else if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
    } catch (error) {
      if (currentRevision !== revision) return;
      main.innerHTML = `<section class="panel route-error" role="alert">${icon('alert', 32)}<h1>Não foi possível carregar esta tela</h1><p>Verifique a conexão e tente novamente.</p><button class="button button-primary" data-action="retry-route">Tentar novamente</button></section>`;
      console.error('Falha ao carregar tela:', error);
    } finally {
      if (currentRevision === revision) main.setAttribute('aria-busy', 'false');
    }
  }
  function render(options) { ui.viewReady = renderView(options); return ui.viewReady; }

  const router = createHashRouter({ target, onChange(route, reason) {
    ui.route = route;
    if (reason !== 'initial') closeDialog();
    document.body.classList.remove('mobile-menu-open');
    render({ focus: reason !== 'initial' });
  } });

  function navigate(id, params = {}, options = {}) {
    closeDialog();
    if (options.reset) ui.explorers.delete(routeHref(id, params));
    router.navigate(id, params, options);
    return ui.viewReady;
  }
  function openExplorer(entity, state = null) {
    if (!ENTITY_LABELS[entity]) return Promise.resolve();
    return navigate(entity, state || {}, { reset: state !== null });
  }
  function refreshExplorer(preserveFocus = false) {
    const container = document.getElementById('explorer-content');
    if (!container || !ui.explorerEntity) return;
    const input = document.getElementById('explorer-search');
    const position = preserveFocus ? input?.selectionStart : null;
    ui.explorerResult = explorerContent(ui.explorerEntity, store, ui.explorer, { page: true });
    container.innerHTML = ui.explorerResult.html;
    if (preserveFocus) {
      const next = document.getElementById('explorer-search');
      next?.focus(); next?.setSelectionRange(position, position);
    }
  }
  const unsubscribe = store.subscribe(() => render());
  router.start();
  return { render, navigate, openExplorer, refreshExplorer, get whenReady() { return ui.viewReady; }, destroy() { revision++; unsubscribe(); router.destroy(); } };
}
