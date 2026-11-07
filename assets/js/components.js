import { escapeHTML as e, initials, date, money, percent } from './formatters.js';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  request: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  approval: '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 3v4h7V3z"/><path d="m14 12 3 3 5-6"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9zM2 15l10 6 10-6M2 12l10 6 10-6"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5.5l9 5"/>',
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5M16 14.5h.1"/>',
  truck: '<path d="M1 3h13v13H1zM14 8h4l4 5v3h-8"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/>',
  contract: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h4m3 3 3-3"/>',
  chart: '<path d="M3 3v18h18M7 15l4-5 4 3 6-8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3a4 4 0 0 1 0 8"/>',
  network: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2"/>',
  settings: '<path d="m9 3-1 3-3 1-2 4 2 2 1 4 3 1 2 3 4-1 2-3 3-2v-4l-3-2-1-3-4-1z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2m4 0h2"/>',
  refresh: '<path d="M20 7a9 9 0 0 0-15-1L2 9M2 3v6h6M4 17a9 9 0 0 0 15 1l3-3m0 6v-6h-6"/>',
  download: '<path d="M21 15v5H3v-5M12 3v12m-5-5 5 5 5-5"/>',
  up: '<path d="m7 17 10-10M7 7h10v10"/>',
  trend: '<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="m10.3 3-9 16a1 1 0 0 0 1 2h19a1 1 0 0 0 1-2l-9-16a1.7 1.7 0 0 0-3 0zM12 9v4m0 4h.01"/>',
  circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  play: '<path d="m9 5 10 7-10 7z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-13-3 4 3 4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4m0 3h.01"/>',
  upload: '<path d="M21 15v5H3v-5M12 16V3m-5 5 5-5 5 5"/>',
  print: '<path d="M6 9V3h12v6M6 17H3v-8h18v8h-3M6 14h12v7H6z"/>',
  shield: '<path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6zM8 12l3 3 5-6"/>',
  filter: '<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
};
export const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.request}</svg>`;
export function badge(status) {
  const tone = /Conclu|Aprovad|Ativ|Vigente|Registrado|Disponível|Bom/.test(status) ? 'green' : /Rejeitad|Cancelad|Baixad|Encerrado|Urgente/.test(status) ? 'red' : /aguard|Aguard|análise|manutenção|Alta|Próximo|Devolvid|Regular/.test(status) ? 'amber' : /execução|andamento|Aberta|Normal/.test(status) ? 'blue' : 'gray';
  return `<span class="badge badge-${tone}"><span class="status-dot"></span>${e(status)}</span>`;
}
export const empty = (title = 'Nenhum registro encontrado', detail = 'Ajuste os filtros para explorar outros resultados.') => `<div class="empty-state">${icon('search', 30)}<strong>${e(title)}</strong><p>${e(detail)}</p></div>`;
export const avatar = (name, tone = '') => `<span class="avatar ${tone}">${e(initials(name))}</span>`;
export const panelHeading = (title, subtitle = '', action = '') => `<div class="panel-heading"><div><h2>${e(title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div>${action}</div>`;

export function budgetCard(model) {
  const exceeded = model.available < 0;
  const state = exceeded ? 'exceeded' : model.available === 0 ? 'limit' : 'available';
  const utilization = model.annualBudget ? `${percent(model.used)} utilizado` : 'Orçamento não definido';
  return `<article class="metric-card budget-card" data-budget-state="${state}" aria-labelledby="budget-title"><div class="metric-top"><span id="budget-title">Saldo orçamentário</span><span class="metric-icon budget">${icon('layers', 17)}</span></div><div class="metric-amount">${money(model.available)}</div><div class="budget-meter" role="progressbar" aria-label="Utilização do orçamento anual" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, model.used))}" aria-valuetext="${e(utilization)}${exceeded ? '; limite excedido' : ''}"><span style="width:${Math.min(100, Math.max(0, model.used))}%" class="${model.used >= 90 ? 'critical' : ''}"></span></div><div class="budget-footer"><strong>${utilization}</strong><span>Orçamento anual</span></div>${exceeded ? `<div class="budget-notice" title="Considera despesas registradas e valores autorizados ainda não realizados.">${icon('alert', 15)}<span><strong>Limite excedido</strong><small>${money(-model.available)} acima do limite anual.</small></span></div>` : ''}</article>`;
}

export function requestRow(row, store) {
  const unit = store.get('units', row.unitId);
  const requester = store.get('employees', row.requesterId);
  return `<tr><td><button class="record-link" data-detail="requests" data-id="${e(row.id)}">${e(row.id)}</button><span class="cell-subtitle">${e(row.title)}</span></td><td>${e(unit?.name)}<span class="cell-subtitle">${e(unit?.city)}</span></td><td><span class="person">${avatar(requester?.name || '?')}${e(requester?.name.split(' ').slice(0, 2).join(' '))}</span><span class="cell-subtitle requester-role">Resp.: ${e(store.get('employees', row.responsibleId)?.name.split(' ').slice(0, 2).join(' '))}</span></td><td>${badge(row.priority)}</td><td>${badge(row.status)}</td><td class="muted nowrap">${date(row.created)}</td><td><button class="icon-button" data-detail="requests" data-id="${e(row.id)}" aria-label="Detalhes de ${e(row.id)}">${icon('chevron', 16)}</button></td></tr>`;
}
export function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export const csv = rows => '\uFEFF' + rows.map(row => row.map(value => {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}).join(';')).join('\r\n');
export function toast(message, type = 'success') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const element = document.createElement('div'); element.className = `toast toast-${type}`;
  element.innerHTML = `${icon(type === 'success' ? 'circleCheck' : 'alert')}<span>${e(message)}</span><button class="icon-button" aria-label="Fechar mensagem">${icon('close', 16)}</button>`;
  element.querySelector('button').onclick = () => element.remove(); region.append(element);
  setTimeout(() => element.remove(), 5500);
}
