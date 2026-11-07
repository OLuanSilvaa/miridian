import { MiridianStore, selectDashboard, periodRange } from './state.js';
import { STORAGE_KEY } from './storage.js';
import { REQUEST_TYPES } from './seed-data.js';
import { LocalIdentity, IDENTITY_KEY } from './identity.js';
import { identityForm } from './modules/identity.js';
import { createScreenHost } from './screen-host.js';
import { detailContent, ENTITY_LABELS } from './modules/explorer.js';
import { icon, toast, empty, downloadFile, csv, avatar } from './components.js';
import { money, date, dateTime, number, todayISO, addDays, escapeHTML as e, normalize } from './formatters.js';

export function createApplication() {
  const store = new MiridianStore();
  store.load();
  const identity = new LocalIdentity();
  identity.load();
  let identityDialogOpen = false;
  const ui = { chartMode: 'month', comparePartial: false, hiddenSeries: new Set(), updated: 'agora', explorer: null, explorerEntity: null, explorerResult: null };
  let focusBeforeDialog;
  let searchTimer;
  let explorerTimer;

  function showDialog(title, content, options = {}) {
    if (identityDialogOpen && !options.identity) return;
    const dismissible = options.dismissible !== false;
    const root = document.getElementById('overlay-root');
    if (!root.querySelector('dialog[open]')) focusBeforeDialog = document.activeElement;
    root.innerHTML = `<dialog class="${options.className || ''}" aria-labelledby="dialog-title">${options.search ? '' : `<header class="dialog-header"><div><div class="dialog-eyebrow">${e(options.eyebrow || 'GRUPO MIRIDIAN · BASE LOCAL')}</div><h2 id="dialog-title">${e(title)}</h2>${options.subtitle ? `<p>${e(options.subtitle)}</p>` : ''}</div>${dismissible ? `<button class="icon-button" data-action="close-dialog" aria-label="Fechar janela">${icon('close', 20)}</button>` : ''}</header>`}${options.search ? `<h2 id="dialog-title" class="sr-only">${e(title)}</h2>` : ''}${content}</dialog>`;
    const dialog = root.querySelector('dialog');
    dialog.showModal();
    dialog.addEventListener('click', event => {
      if (event.target !== dialog || !dismissible) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (dismissible) closeDialog(); });
    const autofocus = root.querySelector('[autofocus]');
    if (autofocus) requestAnimationFrame(() => autofocus.focus());
    return dialog;
  }
  function closeDialog() {
    if (identityDialogOpen && !identity.current) return;
    identityDialogOpen = false;
    document.getElementById('overlay-root').replaceChildren();
    const target = focusBeforeDialog?.isConnected ? focusBeforeDialog : document.getElementById('main');
    target?.focus({ preventScroll: true });
  }

  function header() {
    const preferences = store.data.preferences;
    const unread = store.data.notifications.filter(row => !row.read).length;
    const topDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bahia' }).format(new Date());
    return `<header class="topbar"><button class="icon-button mobile-menu-button" id="mobile-menu" aria-label="Abrir menu de navegação">${icon('menu', 20)}</button><div class="breadcrumb"><span>Workspace</span>${icon('chevron', 11)}<strong id="breadcrumb-current">${e(ui.route.title)}</strong></div><div class="topbar-right"><button class="global-search" data-action="search" aria-label="Pesquisar em toda a base">${icon('search', 17)}<span>Pesquisar na plataforma…</span><kbd>Ctrl K</kbd></button><span class="topbar-divider"></span><label class="top-unit">${icon('building', 15)}<select id="top-unit" aria-label="Selecionar unidade"><option value="all">Todas as unidades</option>${store.data.units.map(unit => `<option value="${e(unit.id)}" ${preferences.unitId === unit.id ? 'selected' : ''}>${e(unit.name)} · ${e(unit.city)}</option>`).join('')}</select>${icon('down', 12)}</label><div class="topbar-date">${icon('calendar', 14)}${e(topDate)}</div><button id="theme-toggle" class="icon-button" data-action="toggle-theme" aria-label="${preferences.theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}" title="Alternar tema">${icon(preferences.theme === 'light' ? 'moon' : 'sun', 17)}</button><button id="notification-button" class="icon-button notification-button" data-action="notifications" aria-label="Notificações${unread ? `: ${unread} não lidas` : ''}" title="Notificações">${icon('bell', 19)}${unread ? '<i class="notification-dot"></i>' : ''}</button><span class="topbar-divider"></span><button id="visitor-button" class="user-button" data-action="identity" aria-label="Alterar seu nome">${avatar(identity.name)}<span class="user-info"><strong>${e(identity.name)}</strong><small>Preferências pessoais</small></span>${icon('down', 12)}</button></div></header>`;
  }

  const application = createScreenHost({ store, identity, ui, header, closeDialog });
  const { render, navigate, openExplorer, refreshExplorer } = application;

  function openDetail(entity, id) {
    showDialog(`${ENTITY_LABELS[entity] || 'Registro'} · Detalhes`, `<div class="dialog-body">${ui.route.id === ui.explorerEntity ? `<button class="text-button" data-action="back-explorer" style="margin-bottom:23px">${icon('arrow', 14)} Voltar à consulta</button>` : ''}${detailContent(entity, id, store)}</div>`, { className: 'drawer' });
  }

  function customPeriod() {
    const current = periodRange(store.data.preferences.period, todayISO(), store.data.preferences);
    showDialog('Período personalizado', `<form id="custom-period-form"><div class="dialog-body"><p class="dialog-description">Escolha o intervalo para os indicadores, gráficos e solicitações.</p><div class="form-grid"><div class="field"><label for="range-from">Data inicial</label><input id="range-from" name="from" type="date" required value="${e(current.from)}" autofocus></div><div class="field"><label for="range-to">Data final</label><input id="range-to" name="to" type="date" required value="${e(current.to)}"></div></div><p class="form-error" id="period-error" hidden></p></div><div class="dialog-footer"><button class="button button-outline" type="button" data-action="close-dialog">Cancelar</button><button class="button button-primary">Aplicar período</button></div></form>`);
  }

  function openSettings() { return navigate('settings'); }

  function openIdentity() {
    const required = !identity.current;
    identityDialogOpen = true;
    showDialog(required ? 'Como podemos chamar você?' : 'Seu nome', identityForm(identity), { className: 'identity-dialog', eyebrow: 'MIRIDIAN', identity: true, dismissible: !required });
  }

  function newRequest() {
    const p = store.data.preferences;
    const unitId = p.unitId === 'all' ? 'U01' : p.unitId;
    const requester = store.get('employees', store.get('units', unitId).managerId);
    const units = store.data.units.map(row => `<option value="${e(row.id)}" ${row.id === unitId ? 'selected' : ''}>${e(row.name)} · ${e(row.city)}</option>`).join('');
    const departments = store.data.departments.map(row => `<option value="${e(row.id)}" ${row.id === requester.departmentId ? 'selected' : ''}>${e(row.name)}</option>`).join('');
    const employeeOptions = (selected, managersOnly) => store.data.employees.filter(row => !managersOnly || row.profile === 'Gestão').map(row => `<option value="${e(row.id)}" ${row.id === selected ? 'selected' : ''}>${e(row.name)} · ${e(row.id)}</option>`).join('');
    showDialog('Nova solicitação', `<form id="new-request-form"><div class="dialog-body"><div class="dialog-note">${icon('request', 18)}<span>O registro será salvo como <strong>Aberta</strong> e atualizará o dashboard.</span></div><p id="request-error" class="form-error" hidden></p><div class="form-grid"><div class="field full"><label for="request-title">Título da solicitação *</label><input name="title" id="request-title" minlength="5" maxlength="140" required placeholder="Ex.: Manutenção do compressor da unidade" autofocus></div><div class="field full"><label for="request-description">Descrição e observações</label><textarea name="description" id="request-description" maxlength="3000" placeholder="Descreva a necessidade e os detalhes para análise."></textarea></div><div class="field"><label for="request-category">Categoria *</label><select id="request-category" name="category" required>${REQUEST_TYPES.map(type => `<option>${e(type)}</option>`).join('')}</select></div><div class="field"><label for="request-priority">Prioridade *</label><select id="request-priority" name="priority"><option>Normal</option><option>Baixa</option><option>Alta</option><option>Urgente</option></select></div><div class="field"><label for="request-unit">Unidade *</label><select id="request-unit" name="unitId" required>${units}</select></div><div class="field"><label for="request-department">Departamento *</label><select id="request-department" name="departmentId" required>${departments}</select></div><div class="field"><label for="request-requester">Solicitante *</label><select id="request-requester" name="requesterId" required>${employeeOptions(requester.id, false)}</select></div><div class="field"><label for="request-responsible">Responsável *</label><select id="request-responsible" name="responsibleId" required>${employeeOptions('COL-0003', true)}</select></div><div class="field"><label for="request-amount">Valor estimado (R$) *</label><input name="amount" id="request-amount" type="number" step="0.01" min="0" max="999999999.99" required placeholder="0,00"></div><div class="field"><label for="request-due">Prazo desejado *</label><input name="due" id="request-due" type="date" min="${todayISO()}" required value="${addDays(todayISO(), 14)}"></div></div><p class="muted" style="font-size:9px;margin-top:18px">* Campos obrigatórios · Cadastro por ${e(identity.name)}.</p></div><div class="dialog-footer"><button type="button" class="button button-outline" data-action="close-dialog">Cancelar</button><button class="button button-primary" type="submit">${icon('plus', 15)}Criar solicitação</button></div></form>`, { subtitle: 'Registre uma necessidade interna da sua unidade.' });
  }

  function openNotifications() {
    const notifications = [...store.data.notifications].reverse();
    const model = selectDashboard(store.data);
    const content = notifications.length ? notifications.map(row => `<div class="notification-item">${icon('bell', 18)}<span>${e(row.text)}<small>${dateTime(row.time)}${row.read ? '' : ' · Nova'}</small></span></div>`).join('') : empty('Você está em dia', 'As novas solicitações aparecerão aqui. Consulte também os pontos de atenção do dashboard.');
    showDialog('Notificações', `<div class="dialog-body">${content}<div class="dialog-note" style="margin-top:15px;margin-bottom:0">${icon('alert', 18)}<span>Há ${number(model.overdue.length)} solicitações atrasadas e ${number(model.expiring.length)} contratos vencendo na seleção atual.</span></div></div>${notifications.length ? '<div class="dialog-footer"><button class="button button-outline" data-action="read-notifications">Marcar todas como lidas</button></div>' : ''}`, { subtitle: 'Acompanhamento local das suas operações.' });
  }

  function searchResults(value) {
    const query = normalize(value.trim());
    const entities = ['requests', 'units', 'contracts', 'assets', 'suppliers', 'employees', 'departments'];
    const icons = { requests: 'request', units: 'building', contracts: 'contract', assets: 'box', suppliers: 'truck', employees: 'users', departments: 'network' };
    const found = [];
    for (const entity of entities) {
      const rows = query ? store.data[entity] : entity === 'requests' ? store.data.requests.slice(-5).reverse() : [];
      for (const row of rows) {
        if (!query || normalize(`${row.id} ${row.name || row.title || ''} ${row.city || ''}`).includes(query)) found.push({ entity, row });
        if (found.length >= 15) break;
      }
      if (found.length >= 15) break;
    }
    return found.length ? found.map(({ entity, row }) => `<button class="search-result" data-detail="${entity}" data-id="${e(row.id)}">${icon(icons[entity], 19)}<span><strong>${e(row.name || row.title)}</strong><small>${e(ENTITY_LABELS[entity])} · ${e(row.id)}</small></span>${icon('chevron', 15)}</button>`).join('') : empty('Nenhum resultado', 'Pesquise pelo nome ou identificador de um registro.');
  }
  function openSearch() {
    showDialog('Pesquisar na plataforma', `<div class="search-box">${icon('search', 21)}<input id="global-search-input" aria-label="Termo de pesquisa global" placeholder="Solicitações, unidades, pessoas, ativos…" autofocus><button class="icon-button" data-action="close-dialog" aria-label="Fechar pesquisa">${icon('close', 18)}</button></div><p class="search-hint">Pesquisa em toda a base · Até 15 resultados · Esc para fechar</p><div id="search-results" class="search-results">${searchResults('')}</div>`, { className: 'search-dialog', search: true });
  }

  function exportDashboard() {
    const model = selectDashboard(store.data);
    const rows = [['GRUPO MIRIDIAN — RELATÓRIO EXECUTIVO'], ['Período', date(model.range.from), date(model.range.to)], ['Unidade', store.data.preferences.unitId === 'all' ? 'Consolidado' : store.get('units', store.data.preferences.unitId).name], [], ['Indicador', 'Valor em R$'], ['Receita operacional', (model.revenue / 100).toFixed(2).replace('.', ',')], ['Despesas operacionais', (model.expenses / 100).toFixed(2).replace('.', ',')], ['Resultado operacional', (model.result / 100).toFixed(2).replace('.', ',')], ['Orçamento anual aprovado', (model.annualBudget / 100).toFixed(2).replace('.', ',')], ['Orçamento comprometido por solicitações', (model.committed / 100).toFixed(2).replace('.', ',')], ['Saldo orçamentário anual', (model.available / 100).toFixed(2).replace('.', ',')], [], ['Unidade', 'Cidade', 'Receita (R$)', 'Despesas (R$)', 'Resultado (R$)', 'Processos ativos'], ...model.units.map(row => [row.name, row.city, (row.revenue / 100).toFixed(2).replace('.', ','), (row.expenses / 100).toFixed(2).replace('.', ','), (row.result / 100).toFixed(2).replace('.', ','), row.active]), [], ['Status', 'Quantidade'], ...model.statuses.map(row => [row.status, row.count])];
    downloadFile(`miridian-dashboard-${todayISO()}.csv`, csv(rows), 'text/csv;charset=utf-8');
    toast('Relatório do dashboard exportado em CSV.');
  }
  function openReports() { return navigate('reports'); }

  document.addEventListener('click', async event => {
    const link = event.target.closest('[data-nav]');
    if (link) {
      if (event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      return navigate(link.dataset.nav);
    }
    if (event.target.closest('.skip-link')) { event.preventDefault(); document.getElementById('main').focus(); return; }
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.id === 'collapse-sidebar') store.updatePreferences({ collapsed: !store.data.preferences.collapsed });
    if (button.id === 'mobile-menu') document.body.classList.toggle('mobile-menu-open');
    if (button.id === 'mobile-backdrop') document.body.classList.remove('mobile-menu-open');
    if (button.dataset.explore) openExplorer(button.dataset.explore, {});
    if (button.dataset.detail) openDetail(button.dataset.detail, button.dataset.id);
    if (button.dataset.filter) {
      const filter = button.dataset.filter;
      if (filter === 'finance') openExplorer('transactions', {});
      else openExplorer(filter === 'expiring' ? 'contracts' : filter === 'maintenance' ? 'assets' : 'requests', { filter });
    }
    if (button.dataset.status) openExplorer('requests', { status: button.dataset.status });
    if (button.dataset.department) openExplorer('transactions', { department: button.dataset.department });
    if (button.dataset.setUnit) { store.updatePreferences({ unitId: button.dataset.setUnit }); closeDialog(); toast('Dashboard atualizado para a unidade selecionada.'); }
    if (button.dataset.chartMode) { ui.chartMode = button.dataset.chartMode; await render(); document.querySelector(`[data-chart-mode="${ui.chartMode}"]`)?.focus({ preventScroll: true }); }
    if (button.dataset.series) {
      const series = button.dataset.series;
      if (ui.hiddenSeries.has(series)) ui.hiddenSeries.delete(series); else if (ui.hiddenSeries.size < 2) ui.hiddenSeries.add(series); else { toast('Mantenha pelo menos uma série visível.', 'error'); return; }
      await render(); document.querySelector(`[data-series="${series}"]`)?.focus({ preventScroll: true });
    }
    if (button.dataset.sort !== undefined) {
      const index = Number(button.dataset.sort);
      ui.explorer.direction = ui.explorer.sort === index && ui.explorer.direction === 'asc' ? 'desc' : 'asc'; ui.explorer.sort = index; refreshExplorer();
    }
    if (button.dataset.page) { ui.explorer.page = Number(button.dataset.page); refreshExplorer(); document.getElementById('explorer-content')?.scrollIntoView({ block: 'start' }); }
    if (button.dataset.reportPage) { ui.reportPage = Number(button.dataset.reportPage); render(); }
    if (button.dataset.theme) store.updatePreferences({ theme: button.dataset.theme });
    const action = button.dataset.action;
    if (!action) { await application.whenReady; return; }
    if (action === 'close-dialog') closeDialog();
    if (action === 'back-explorer') closeDialog();
    if (action === 'retry-route') render({ focus: true });
    if (action === 'toggle-period-comparison') { ui.comparePartial = !ui.comparePartial; await render(); }
    if (action === 'refresh') { ui.updated = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }).format(new Date()); render(); toast('Indicadores recalculados a partir da base local.'); }
    if (action === 'export' || action === 'reports') openReports();
    if (action === 'download-dashboard') exportDashboard();
    if (action === 'print') { closeDialog(); window.print(); }
    if (action === 'new-request') newRequest();
    if (action === 'custom-period') customPeriod();
    if (action === 'expenses') openExplorer('transactions', { query: 'Despesa' });
    if (action === 'settings') openSettings();
    if (action === 'identity') openIdentity();
    if (action === 'toggle-theme') store.updatePreferences({ theme: store.data.preferences.theme === 'light' ? 'dark' : 'light' });
    if (action === 'search') openSearch();
    if (action === 'notifications') openNotifications();
    if (action === 'read-notifications') { store.markNotificationsRead(); openNotifications(); toast('Notificações marcadas como lidas.'); }
    if (action === 'export-json') { downloadFile(`miridian-backup-${todayISO()}.json`, JSON.stringify(store.data), 'application/json'); toast('Backup local exportado.'); }
    if (action === 'export-original') {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) downloadFile('miridian-dados-originais.json', raw, 'application/json'); else toast('Não há dados locais disponíveis.', 'error'); }
      catch { toast('O navegador impediu a leitura do armazenamento.', 'error'); }
    }
    if (action === 'import-json') document.getElementById('json-file').click();
    if (action === 'restore') showDialog('Restaurar a base original?', `<div class="dialog-body"><p class="dialog-description">As solicitações criadas, preferências e demais alterações locais serão substituídas pela base original, com datas relativas a hoje.</p><div class="dialog-note">${icon('alert', 18)}<span>Exporte um backup em JSON se desejar guardar o estado atual. Esta substituição não pode ser desfeita sem um backup.</span></div></div><div class="dialog-footer"><button class="button button-outline" data-action="settings">Cancelar</button><button class="button button-danger" data-action="confirm-restore">Restaurar dados</button></div>`);
    if (action === 'confirm-restore') { try { store.restore(); closeDialog(); toast('Base original restaurada.'); } catch (error) { toast(error.message, 'error'); } }
    if (action === 'confirm-import') { try { store.importData(ui.pendingImport); ui.pendingImport = null; closeDialog(); toast('Backup validado e importado.'); } catch (error) { toast(error.message, 'error'); } }
    if (action === 'clear-explorer') navigate(ui.route.id, {}, { replace: true, reset: true });
    if (action === 'export-explorer') {
      const { rows, columns } = ui.explorerResult;
      downloadFile(`miridian-${ui.explorerEntity}-${todayISO()}.csv`, csv([columns.map(row => row[0]), ...rows.map(row => columns.map(col => { const value = col[1](row); return typeof value === 'number' && /Valor|Receita|Despesas|Resultado/.test(col[0]) ? (value / 100).toFixed(2).replace('.', ',') : value; }))]), 'text/csv;charset=utf-8');
      toast('Consulta exportada em CSV, com valores em reais.');
    }
    if (action === 'download-report' && ui.reportResult) {
      downloadFile(`miridian-relatorio-${ui.reportId}-${todayISO()}.csv`, csv([ui.reportResult.columns, ...ui.reportResult.rows]), 'text/csv;charset=utf-8');
      toast('Relatório exportado em CSV.');
    }
    await application.whenReady;
  });

  document.addEventListener('change', async event => {
    const target = event.target;
    if (['top-unit', 'dashboard-unit'].includes(target.id)) store.updatePreferences({ unitId: target.value });
    if (target.id === 'period-filter') { if (target.value === 'custom') { target.value = store.data.preferences.period; customPeriod(); } else store.updatePreferences({ period: target.value }); }
    if (target.id === 'density-setting') store.updatePreferences({ density: target.checked ? 'compact' : 'comfortable' });
    if (target.id === 'notification-setting') store.updatePreferences({ notifications: target.checked });
    if (target.id === 'report-type') { ui.reportId = target.value; ui.reportPage = 1; render(); }
    if (target.id === 'explorer-status') { ui.explorer.status = target.value; ui.explorer.page = 1; refreshExplorer(); }
    if (target.id === 'json-file' && target.files[0]) {
      const file = target.files[0];
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error('O arquivo excede o limite de 8 MB.');
        const data = JSON.parse(await file.text());
        const { validateDatabase } = await import('./state.js');
        validateDatabase(data);
        ui.pendingImport = data;
        showDialog('Importar este backup?', `<div class="dialog-body"><p class="dialog-description">O arquivo <strong>${e(file.name)}</strong> foi validado. Ele contém ${number(data.requests.length)} solicitações, ${number(data.transactions.length)} movimentações e ${number(data.units.length)} unidades.</p><div class="dialog-note">${icon('alert', 18)}<span>Os dados e as preferências atuais serão substituídos. Exporte um backup antes de continuar, se quiser preservá-los.</span></div></div><div class="dialog-footer"><button class="button button-outline" data-action="settings">Cancelar</button><button class="button button-primary" data-action="confirm-import">Substituir e importar</button></div>`);
      } catch (error) { target.value = ''; toast(`Importação recusada: ${error.message}`, 'error'); }
    }
    await application.whenReady;
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'global-search-input') { clearTimeout(searchTimer); const query = event.target.value; searchTimer = setTimeout(() => { const result = document.getElementById('search-results'); if (result) result.innerHTML = searchResults(query); }, 120); }
    if (event.target.id === 'explorer-search') { clearTimeout(explorerTimer); ui.explorer.query = event.target.value; ui.explorer.page = 1; explorerTimer = setTimeout(() => { if (document.getElementById('explorer-content')) refreshExplorer(true); }, 160); }
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'identity-form') {
      event.preventDefault();
      try {
        const result = identity.save({ firstName: event.target.elements.namedItem('firstName').value, lastName: event.target.elements.namedItem('lastName').value });
        closeDialog(); render();
        if (!result.ok) toast(result.error, 'error');
      } catch (error) {
        const message = document.getElementById('identity-error');
        message.textContent = error.message; message.hidden = false;
      }
      return;
    }
    if (event.target.id === 'custom-period-form') {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      if (values.from > values.to || Number(values.to.slice(0, 4)) - Number(values.from.slice(0, 4)) > 10) { const error = document.getElementById('period-error'); error.textContent = 'Use uma data final posterior à inicial e um intervalo de até 10 anos.'; error.hidden = false; return; }
      store.updatePreferences({ period: 'custom', from: values.from, to: values.to }); closeDialog();
    }
    if (event.target.id === 'new-request-form') {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(values.amount);
      try {
        if (!match) throw new Error('Informe um valor positivo com até duas casas decimais.');
        values.amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
        const row = store.createRequest(values, { name: identity.name });
        closeDialog(); toast(`${row.id} criada${store.persisted ? ' e salva neste navegador' : ' nesta sessão'}.`);
        if (!store.persisted) toast(store.error || 'Exporte um backup para preservar este registro.', 'error');
      } catch (error) { const element = document.getElementById('request-error'); element.hidden = false; element.textContent = error.message; element.scrollIntoView({ block: 'nearest' }); }
    }
  });
  document.addEventListener('keydown', event => {
    if (identityDialogOpen && !identity.current) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') document.body.classList.remove('mobile-menu-open');
  });
  window.addEventListener('storage', event => {
    if (event.key === IDENTITY_KEY) {
      identity.load(); render();
      if (!identity.current) openIdentity(); else closeDialog();
    }
    if (event.key === STORAGE_KEY) {
      closeDialog(); store.load(); render(); toast(store.error || 'Dados atualizados a partir de outra aba.', store.error ? 'error' : 'success');
    }
  });

  if (!identity.current) openIdentity();
  return application;
}
