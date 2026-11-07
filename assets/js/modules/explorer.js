import { icon, badge, empty, avatar } from '../components.js';
import { escapeHTML as e, money, number, date, dateTime, normalize, sum, addDays, todayISO } from '../formatters.js';
import { contractStatus, isOpen, selectDashboard } from '../state.js';
import { auditActor } from '../actors.js';

export const ENTITY_LABELS = { requests: 'Solicitações', approvals: 'Aprovações', activities: 'Operações', units: 'Unidades', assets: 'Recursos e ativos', transactions: 'Financeiro', suppliers: 'Fornecedores', contracts: 'Contratos', employees: 'Colaboradores', departments: 'Departamentos', audit: 'Auditoria' };
const detailButton = (entity, id, label, subtitle = '') => `<button class="record-link" data-detail="${entity}" data-id="${e(id)}">${e(label)}</button>${subtitle ? `<span class="cell-subtitle">${e(subtitle)}</span>` : ''}`;
const plain = value => e(value ?? '—');
const lookup = (store, entity, id) => store.get(entity, id)?.name || '—';

function config(entity, store, model) {
  const unit = row => lookup(store, 'units', row.unitId);
  const department = row => lookup(store, 'departments', row.departmentId);
  const request = row => store.get('requests', row.requestId);
  const configs = {
    requests: { rows: model.requests, columns: [
      ['Solicitação', row => row.id, row => detailButton('requests', row.id, row.id, row.title)], ['Categoria', row => row.category], ['Unidade', unit], ['Departamento', department], ['Valor estimado', row => row.amount, row => money(row.amount)], ['Prioridade', row => row.priority, row => badge(row.priority)], ['Status', row => row.status, row => badge(row.status)], ['Prazo', row => row.due, row => date(row.due)],
    ] },
    approvals: { rows: model.requests.filter(row => row.status === 'Aguardando aprovação'), columns: [
      ['Solicitação', row => row.id, row => detailButton('requests', row.id, row.id, row.title)], ['Unidade', unit], ['Departamento', department], ['Valor solicitado', row => row.amount, row => money(row.amount)], ['Alçada necessária', row => row.amount > 2000000 ? 'Diretoria' : 'Gestão do departamento'], ['Abertura', row => row.created, row => date(row.created)], ['Status', row => row.status, row => badge(row.status)],
    ] },
    activities: { rows: store.data.activities.filter(row => model.requests.some(r => r.id === row.requestId)), columns: [
      ['Atividade', row => row.id, row => detailButton('activities', row.id, row.id, request(row)?.title)], ['Solicitação de origem', row => row.requestId, row => detailButton('requests', row.requestId, row.requestId)], ['Unidade', row => unit(request(row) || {})], ['Responsável', row => lookup(store, 'employees', row.responsibleId)], ['Status', row => row.status, row => badge(row.status)], ['Prazo', row => request(row)?.due, row => date(request(row)?.due)],
    ] },
    units: { rows: model.units, columns: [
      ['Unidade', row => row.name, row => detailButton('units', row.id, row.name, `${row.city} · ${row.state}`)], ['Tipo', row => row.type], ['Receita', row => row.revenue, row => money(row.revenue)], ['Despesas', row => row.expenses, row => money(row.expenses)], ['Resultado', row => row.result, row => money(row.result)], ['Processos ativos', row => row.active], ['Colaboradores', row => store.data.employees.filter(r => r.unitId === row.id).length],
    ] },
    assets: { rows: store.data.assets.filter(row => store.data.preferences.unitId === 'all' || row.unitId === store.data.preferences.unitId), columns: [
      ['Patrimônio', row => row.id, row => detailButton('assets', row.id, row.id, row.name)], ['Categoria', row => row.category], ['Unidade', unit], ['Departamento', department], ['Valor de aquisição', row => row.amount, row => money(row.amount)], ['Conservação', row => row.condition], ['Status', row => row.status, row => badge(row.status)],
    ] },
    transactions: { rows: model.transactions, columns: [
      ['Movimentação', row => row.id, row => detailButton('transactions', row.id, row.id, row.description)], ['Tipo', row => row.type, row => `<span class="${row.type === 'Receita' ? 'text-green' : 'text-red'}">${e(row.type)}</span>`], ['Unidade', unit], ['Departamento', department], ['Valor', row => row.amount, row => money(row.amount)], ['Data', row => row.date, row => date(row.date)], ['Status', row => row.status, row => badge(row.status)],
    ] },
    suppliers: { rows: store.data.suppliers.filter(row => store.data.preferences.unitId === 'all' || store.data.contracts.some(c => c.supplierId === row.id && c.unitId === store.data.preferences.unitId)), columns: [
      ['Fornecedor', row => row.name, row => detailButton('suppliers', row.id, row.name, row.id)], ['Categoria', row => row.category], ['Cidade / UF', row => `${row.city} · ${row.state}`], ['Contratos', row => store.data.contracts.filter(c => c.supplierId === row.id).length], ['Valor contratado', row => sum(store.data.contracts.filter(c => c.supplierId === row.id)), row => money(sum(store.data.contracts.filter(c => c.supplierId === row.id)))], ['Status', row => row.status, row => badge(row.status)],
    ] },
    contracts: { rows: store.data.contracts.filter(row => store.data.preferences.unitId === 'all' || row.unitId === store.data.preferences.unitId), columns: [
      ['Contrato', row => row.id, row => detailButton('contracts', row.id, row.id, row.title)], ['Fornecedor', row => lookup(store, 'suppliers', row.supplierId)], ['Unidade', unit], ['Valor', row => row.amount, row => money(row.amount)], ['Início', row => row.start, row => date(row.start)], ['Vencimento', row => row.end, row => date(row.end)], ['Status', row => contractStatus(row), row => badge(contractStatus(row))],
    ] },
    employees: { rows: store.data.employees.filter(row => store.data.preferences.unitId === 'all' || row.unitId === store.data.preferences.unitId), columns: [
      ['Colaborador', row => row.name, row => detailButton('employees', row.id, row.name, row.id)], ['Cargo', row => row.role], ['Unidade', unit], ['Departamento', department], ['E-mail', row => row.email], ['Perfil', row => row.profile], ['Status', row => row.status, row => badge(row.status)],
    ] },
    departments: { rows: store.data.departments, columns: [
      ['Departamento', row => row.name, row => detailButton('departments', row.id, row.name, row.id)], ['Responsável', row => lookup(store, 'employees', row.managerId)], ['Colaboradores', row => store.data.employees.filter(c => c.departmentId === row.id && (store.data.preferences.unitId === 'all' || c.unitId === store.data.preferences.unitId)).length], ['Processos no período', row => model.requests.filter(r => r.departmentId === row.id).length], ['Despesas no período', row => sum(model.transactions.filter(t => t.departmentId === row.id && t.type === 'Despesa')), row => money(sum(model.transactions.filter(t => t.departmentId === row.id && t.type === 'Despesa')))],
    ] },
    audit: { rows: model.audit, columns: [
      ['Data e hora', row => row.time, row => dateTime(row.time)], ['Usuário', row => auditActor(row).name], ['Operação', row => row.action], ['Registro', row => row.entityId, row => detailButton(row.entity, row.entityId, row.entityId)], ['Descrição', row => row.description],
    ] },
  };
  return configs[entity];
}

export function explorerContent(entity, store, state, options = {}) {
  const model = selectDashboard(store.data);
  const table = config(entity, store, model);
  if (!table) return { html: empty('Consulta indisponível'), rows: [] };
  let rows = table.rows;
  if (state.filter === 'open') rows = model.open;
  if (state.filter === 'pending') rows = model.pending;
  if (state.filter === 'running') rows = model.running;
  if (state.filter === 'completed') rows = model.completed;
  if (state.filter === 'overdue') rows = model.overdue;
  if (state.filter === 'stale') rows = model.pending.filter(row => row.created < addDays(todayISO(), -7));
  if (state.filter === 'expiring') rows = model.expiring;
  if (state.filter === 'maintenance') rows = model.maintenance;
  if (state.status) rows = rows.filter(row => (entity === 'contracts' ? contractStatus(row) : row.status) === state.status);
  if (state.department) rows = rows.filter(row => row.departmentId === state.department && (entity !== 'transactions' || row.type === 'Despesa'));
  const query = normalize(state.query || '');
  if (query) rows = rows.filter(row => normalize(table.columns.map(col => col[1](row)).join(' ')).includes(query));
  const statuses = [...new Set(table.rows.map(row => entity === 'contracts' ? contractStatus(row) : row.status).filter(Boolean))];
  if (state.status && !statuses.includes(state.status)) statuses.push(state.status);
  const sortColumn = table.columns[state.sort || 0];
  rows = [...rows].sort((a, b) => {
    const av = sortColumn[1](a) ?? '', bv = sortColumn[1](b) ?? '';
    const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
    return state.direction === 'desc' ? -result : result;
  });
  const pageSize = 15;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  state.page = Math.max(1, Math.min(state.page || 1, pages));
  const start = (state.page - 1) * pageSize;
  const subtitle = state.status || ({ open: 'Solicitações não finalizadas', pending: 'Aguardando aprovação', running: 'Em execução', completed: 'Concluídas', overdue: 'Prazo ultrapassado', expiring: 'Vencimento em até 30 dias', maintenance: 'Equipamentos em manutenção', stale: 'Aprovações há mais de 7 dias' }[state.filter]) || (state.department ? lookup(store, 'departments', state.department) : 'Registros da seleção atual');
  const html = `<div class="explorer-toolbar"><label class="explorer-search-shell">${icon('search', 16)}<input class="explorer-search" id="explorer-search" aria-label="Pesquisar nesta listagem" placeholder="Pesquisar nesta listagem…" value="${e(state.query || '')}"></label>${statuses.length ? `<select class="explorer-select" id="explorer-status" aria-label="Filtrar por status"><option value="">Todos os status</option>${statuses.map(status => `<option value="${e(status)}" ${state.status === status ? 'selected' : ''}>${e(status)}</option>`).join('')}</select>` : ''}<span class="explorer-count">${number(rows.length)} registros</span><button class="button button-outline" data-action="export-explorer">${icon('download', 14)} CSV</button>${entity === 'requests' && !options.page ? `<button class="button button-primary" data-action="new-request">${icon('plus', 14)}Nova solicitação</button>` : ''}${state.filter || state.department || state.status || state.query ? '<button class="text-button" data-action="clear-explorer">Limpar filtros</button>' : ''}</div><div class="dialog-note" style="margin:0 24px 18px">${icon('filter', 15)}<span>${e(subtitle)}. ${['requests', 'approvals', 'activities', 'transactions', 'units', 'departments'].includes(entity) ? `Período: ${date(model.range.from)} a ${date(model.range.to)}.` : 'Posição atual dos registros da unidade selecionada.'}</span></div>${rows.length ? `<div class="table-scroll"><table class="data-table explorer-table"><thead><tr>${table.columns.map((column, index) => `<th scope="col" aria-sort="${(state.sort || 0) === index ? (state.direction === 'desc' ? 'descending' : 'ascending') : 'none'}"><button data-sort="${index}">${e(column[0])}${icon('down', 11)}</button></th>`).join('')}</tr></thead><tbody>${rows.slice(start, start + pageSize).map(row => `<tr>${table.columns.map(column => `<td>${column[2] ? column[2](row) : plain(column[1](row))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty()}<div class="pagination"><span>${rows.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, rows.length))} de ${number(rows.length)} registros` : '0 registros'}</span><div><button class="button button-outline" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>Anterior</button><span>Página ${state.page} de ${pages}</span><button class="button button-outline" data-page="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''}>Próxima</button></div></div>`;
  return { html, rows, columns: table.columns };
}

export function detailContent(entity, id, store) {
  const row = store.get(entity, id);
  if (!row) return empty('Registro não encontrado', 'Este registro pode ter sido removido ou a base foi restaurada.');
  const unit = store.get('units', row.unitId);
  const department = store.get('departments', row.departmentId);
  const model = selectDashboard(store.data);
  const field = (label, value) => `<div><span>${e(label)}</span><strong>${e(value ?? '—')}</strong></div>`;
  const linked = (entity, rows, label) => `<section class="detail-section"><h3>${e(label)} <span class="muted">(${number(rows.length)})</span></h3>${rows.slice(0, 8).map(item => `<button class="linked-row" data-detail="${entity}" data-id="${e(item.id)}"><span><strong>${e(item.name || item.title || item.id)}</strong><small>${e(item.id)}</small></span><span>${item.amount !== undefined ? money(item.amount) : badge(item.status || 'Ativo')} ${icon('chevron', 14)}</span></button>`).join('') || '<p class="muted">Nenhum registro associado.</p>'}${rows.length > 8 ? `<p class="muted" style="font-size:10px;margin-top:12px">Exibindo os 8 primeiros registros associados.</p>` : ''}</section>`;
  let content = `<div class="dialog-eyebrow">${e(row.id)}</div><h3 class="detail-title">${e(row.title || row.name || row.description || row.id)}</h3>${row.status ? badge(entity === 'contracts' ? contractStatus(row) : row.status) : ''}`;
  if (entity === 'requests') {
    const registered = sum(store.data.transactions.filter(t => t.requestId === row.id && t.type === 'Despesa' && t.status === 'Registrado'));
    content += `<div class="detail-kpis"><div><small>Valor solicitado</small><strong>${money(row.amount)}</strong></div><div><small>Valor autorizado</small><strong>${money(row.authorized || 0)}</strong></div><div><small>Despesa registrada</small><strong>${money(registered)}</strong></div></div><div class="detail-grid">${field('Categoria', row.category)}${field('Prioridade', row.priority)}${field('Unidade', `${unit.name} · ${unit.city}`)}${field('Departamento', department.name)}${field('Solicitante', lookup(store, 'employees', row.requesterId))}${field('Responsável', lookup(store, 'employees', row.responsibleId))}${field('Data de abertura', date(row.created))}${field('Prazo desejado', date(row.due))}${row.completed ? field('Concluída em', date(row.completed)) : ''}</div><p class="dialog-description">${e(row.description || 'Solicitação interna destinada à continuidade e à melhoria das operações da unidade. O valor estimado está sujeito à análise e à autorização do departamento responsável.')}</p><div class="dialog-note">${icon('shield', 17)}<span>${row.amount > 2000000 ? 'Valor superior a R$ 20.000,00: exige alçada da diretoria.' : `Análise de alçada vinculada ao departamento de ${e(department.name)}.`} A autorização e a despesa efetiva são registradas separadamente.</span></div>`;
    const activities = store.data.activities.filter(r => r.requestId === row.id);
    if (activities.length) content += linked('activities', activities, 'Atividades vinculadas');
  } else if (entity === 'units') {
    const scoped = selectDashboard(store.data, { ...store.data.preferences, unitId: row.id });
    content += `<div class="detail-grid">${field('Localização', `${row.city} · ${row.state}`)}${field('Tipo', row.type)}${field('Gestor responsável', lookup(store, 'employees', row.managerId))}${field('Orçamento anual', money(row.budget))}${field('Colaboradores', number(store.data.employees.filter(r => r.unitId === row.id).length))}${field('Ativos vinculados', number(store.data.assets.filter(r => r.unitId === row.id).length))}</div><div class="detail-kpis"><div><small>Receita do período</small><strong>${money(scoped.revenue)}</strong></div><div><small>Despesas do período</small><strong>${money(scoped.expenses)}</strong></div><div><small>Processos ativos</small><strong>${number(scoped.open.length)}</strong></div></div><button class="button button-primary" data-set-unit="${row.id}">${icon('building', 16)}Usar esta unidade no dashboard</button>`;
    content += linked('departments', store.data.departments.filter(d => store.data.employees.some(c => c.unitId === row.id && c.departmentId === d.id)), 'Departamentos');
    content += linked('requests', scoped.requests.slice().reverse(), 'Solicitações no período');
    content += linked('contracts', store.data.contracts.filter(c => c.unitId === row.id), 'Contratos');
    content += linked('assets', store.data.assets.filter(c => c.unitId === row.id), 'Equipamentos');
  } else if (entity === 'suppliers') {
    const contracts = store.data.contracts.filter(c => c.supplierId === row.id);
    content += `<div class="detail-grid">${field('Razão social', `${row.name} Ltda.`)}${field('Categoria', row.category)}${field('Localização', `${row.city} · ${row.state}`)}${field('Contato', row.contact)}${field('E-mail', row.email)}${field('Valor contratado', money(sum(contracts)))}</div>${linked('contracts', contracts, 'Contratos associados')}`;
  } else if (entity === 'departments') {
    const employees = store.data.employees.filter(r => r.departmentId === row.id && (store.data.preferences.unitId === 'all' || r.unitId === store.data.preferences.unitId));
    content += `<div class="detail-grid">${field('Responsável', lookup(store, 'employees', row.managerId))}${field('Colaboradores na seleção', number(employees.length))}${field('Despesas no período', money(sum(model.transactions.filter(t => t.departmentId === row.id && t.type === 'Despesa'))))}${field('Solicitações no período', number(model.requests.filter(r => r.departmentId === row.id).length))}</div>${linked('employees', employees, 'Colaboradores vinculados')}`;
  } else if (entity === 'activities') {
    const request = store.get('requests', row.requestId);
    content += `<div class="detail-grid">${field('Responsável', lookup(store, 'employees', row.responsibleId))}${field('Unidade', lookup(store, 'units', request.unitId))}${field('Prazo', date(request.due))}${field('Prioridade', request.priority)}</div>${linked('requests', [request], 'Solicitação de origem')}`;
  } else {
    content += `<div class="detail-grid">${unit ? field('Unidade', `${unit.name} · ${unit.city}`) : ''}${department ? field('Departamento', department.name) : ''}${row.amount !== undefined ? field('Valor', money(row.amount)) : ''}${row.responsibleId ? field('Responsável', lookup(store, 'employees', row.responsibleId)) : ''}${row.category ? field('Categoria', row.category) : ''}${row.condition ? field('Conservação', row.condition) : ''}${row.acquired ? field('Aquisição', date(row.acquired)) : ''}${row.start ? field('Início de vigência', date(row.start)) : ''}${row.end ? field('Término de vigência', date(row.end)) : ''}${row.supplierId ? field('Fornecedor', lookup(store, 'suppliers', row.supplierId)) : ''}${row.date ? field('Data', date(row.date)) : ''}${row.costCenterId ? field('Centro de custo', lookup(store, 'costCenters', row.costCenterId)) : ''}${row.role ? field('Cargo', row.role) : ''}${row.email ? field('E-mail', row.email) : ''}${row.profile ? field('Perfil', row.profile) : ''}${row.type ? field('Tipo', row.type) : ''}</div>`;
    if (row.supplierId) content += linked('suppliers', [store.get('suppliers', row.supplierId)], 'Fornecedor vinculado');
    if (entity === 'employees') content += linked('departments', [department], 'Departamento');
  }
  const history = store.data.audit.filter(entry => entry.entity === entity && entry.entityId === id).sort((a, b) => a.time.localeCompare(b.time));
  content += `<section class="detail-section"><h3>Histórico do registro</h3><div class="detail-history"><div>Registro disponibilizado na base inicial.<small>Base inicial de ${date(store.data.seedDate)}</small></div>${history.map(entry => `<div>${e(entry.description)}<small>${e(auditActor(entry).name)} · ${dateTime(entry.time)}</small></div>`).join('')}</div></section>`;
  return content;
}
