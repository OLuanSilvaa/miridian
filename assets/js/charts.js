import { shortMoney, money, date, percent, todayISO, escapeHTML as e } from './formatters.js';

export const SERIES = [{ id: 'revenue', label: 'Receita', color: '#356ee8' }, { id: 'expenses', label: 'Despesas', color: '#8da7d6' }, { id: 'result', label: 'Resultado', color: '#21a385' }];
const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function periodBounds(iso, mode) {
  const year = Number(iso.slice(0, 4)), month = Number(iso.slice(5, 7)) - 1;
  const startMonth = mode === 'year' ? 0 : mode === 'quarter' ? Math.floor(month / 3) * 3 : month;
  const length = mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1;
  return { start: new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, startMonth + length, 0)).toISOString().slice(0, 10), periodTitle: mode === 'year' ? `Ano de ${year}` : mode === 'quarter' ? `${Math.floor(month / 3) + 1}º trimestre de ${year}` : `${fullMonthNames[month]} de ${year}` };
}
export function groupFinance(transactions, range, mode = 'month', referenceDate = todayISO()) {
  const cutoff = range.to < referenceDate ? range.to : referenceDate;
  if (range.from > cutoff) return [];
  const groups = new Map();
  const keyFor = value => mode === 'year' ? value.slice(0, 4) : mode === 'quarter' ? `${value.slice(0, 4)}-T${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1}` : value.slice(0, 7);
  const cursor = new Date(`${range.from.slice(0, 7)}-01T12:00:00Z`);
  const end = new Date(`${cutoff}T12:00:00Z`);
  for (let count = 0; cursor <= end && count < 2400; count++) {
    const iso = cursor.toISOString().slice(0, 10);
    const key = keyFor(iso);
    if (!groups.has(key)) {
      const bounds = periodBounds(iso, mode);
      const coveredFrom = range.from > bounds.start ? range.from : bounds.start;
      const coveredTo = cutoff < bounds.end ? cutoff : bounds.end;
      groups.set(key, { key, label: mode === 'year' ? key : mode === 'quarter' ? `${key.slice(-2)} ${key.slice(0, 4)}` : `${monthNames[cursor.getUTCMonth()]}${range.from.slice(0, 4) !== cutoff.slice(0, 4) ? ` ${cursor.getUTCFullYear()}` : ''}`, ...bounds, coveredFrom, coveredTo, partial: coveredFrom !== bounds.start || coveredTo !== bounds.end, revenue: 0, expenses: 0, result: 0 });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  transactions.forEach(row => { const group = groups.get(keyFor(row.date)); if (group && row.date >= group.coveredFrom && row.date <= group.coveredTo) group[row.type === 'Receita' ? 'revenue' : 'expenses'] += row.amount; });
  return [...groups.values()].map(row => ({ ...row, result: row.revenue - row.expenses }));
}
const smooth = points => points.length < 2 ? '' : points.map((point, i) => i === 0 ? `M${point[0]},${point[1]}` : `C${(points[i - 1][0] + point[0]) / 2},${points[i - 1][1]} ${(points[i - 1][0] + point[0]) / 2},${point[1]} ${point[0]},${point[1]}`).join(' ');

export function financialChart(groups, hidden = new Set()) {
  const width = 720, height = 248, left = 55, right = 19, top = 18, bottom = 34;
  const visible = SERIES.filter(row => !hidden.has(row.id));
  const values = groups.flatMap(row => visible.map(series => row[series.id]));
  const max = Math.max(10000, ...values);
  const min = Math.min(0, ...values);
  const unit = 10 ** Math.floor(Math.log10(max / 100));
  const upper = Math.ceil(max / unit) * unit;
  const lower = min < 0 ? Math.floor(min / unit) * unit : 0;
  const x = index => groups.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / Math.max(1, groups.length - 1);
  const y = value => top + (upper - value) / (upper - lower) * (height - top - bottom);
  const axes = Array.from({ length: 5 }, (_, i) => { const value = lower + (upper - lower) * (4 - i) / 4; return `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" class="chart-grid"/><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end" class="axis-label">${e(shortMoney(value))}</text>`; }).join('');
  const partialAreas = groups.map((row, i) => {
    if (!row.partial) return '';
    const start = i ? (x(i - 1) + x(i)) / 2 : left;
    const end = i < groups.length - 1 ? (x(i) + x(i + 1)) / 2 : width - right;
    return `<rect x="${start}" y="${top}" width="${end - start}" height="${height - top - bottom}" class="chart-partial-area"><title>${e(`${row.periodTitle} parcial: ${date(row.coveredFrom)} a ${date(row.coveredTo)}`)}</title></rect>`;
  }).join('');
  const labels = groups.map((row, i) => `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" class="axis-label ${row.partial ? 'axis-label-partial' : ''}" aria-label="${e(row.label)}${row.partial ? ', parcial' : ''}">${e(row.label)}${row.partial ? '*' : ''}</text>`).join('');
  const lines = visible.map(series => {
    const points = groups.map((row, i) => [x(i), y(row[series.id])]);
    const path = smooth(points);
    const segments = points.slice(1).map((point, i) => `<path d="${smooth([points[i], point])}" fill="none" stroke="${series.color}" stroke-width="${series.id === 'revenue' ? 3 : 2.2}" ${series.id === 'result' || groups[i].partial || groups[i + 1].partial ? 'stroke-dasharray="5 5"' : ''}/>`).join('');
    return `${series.id === 'revenue' && points.length > 1 ? `<path d="${path} L${x(groups.length - 1)},${y(0)} L${x(0)},${y(0)}Z" fill="url(#chart-fill)"/>` : ''}${segments}${points.map((point, i) => `<circle cx="${point[0]}" cy="${point[1]}" r="${points.length === 1 || groups[i].partial ? 4.5 : 3}" fill="${series.color}" stroke="${groups[i].partial ? 'var(--amber)' : 'var(--surface)'}" stroke-width="2"><title>${e(`${groups[i].label}${groups[i].partial ? ' (parcial)' : ''} · ${series.label}: ${money(groups[i][series.id])}`)}</title></circle>`).join('')}`;
  }).join('');
  return `<div class="financial-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução de receita, despesas e resultado. Períodos parciais estão marcados com asterisco e fundo destacado. Use as legendas para mostrar ou ocultar séries."><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b75ed" stop-opacity=".13"/><stop offset="1" stop-color="#3b75ed" stop-opacity="0"/></linearGradient></defs>${partialAreas}${axes}${labels}${lines}</svg><div class="chart-tooltip" hidden></div><div class="chart-hover" aria-hidden="true"></div></div>`;
}

export function wireChart(container, groups) {
  const chart = container.querySelector('.financial-chart');
  if (!chart || !groups.length) return;
  const tooltip = chart.querySelector('.chart-tooltip');
  chart.addEventListener('pointermove', event => {
    const bounds = chart.getBoundingClientRect();
    const relative = Math.max(0, Math.min(1, (event.clientX - bounds.left - bounds.width * 55 / 720) / (bounds.width * 646 / 720)));
    const row = groups[Math.round(relative * (groups.length - 1))];
    tooltip.innerHTML = `<strong>${e(row.periodTitle || row.label)}${row.partial ? ' · Parcial' : ''}</strong><small>${date(row.coveredFrom)} a ${date(row.coveredTo)}</small>${SERIES.map(series => `<span><i style="background:${series.color}"></i>${series.label}<b>${money(row[series.id])}</b></span>`).join('')}`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(4, Math.min(bounds.width - 256, event.clientX - bounds.left - 120))}px`;
    tooltip.style.top = `${Math.max(0, event.clientY - bounds.top - 145)}px`;
  });
  chart.addEventListener('pointerleave', () => { tooltip.hidden = true; });
}

export function financialContext(model, groups, ui) {
  const partial = groups.filter(row => row.partial).at(-1);
  if (!partial) return '';
  const comparison = ui.chartMode === 'month' && model.monthComparison?.current.from.slice(0, 7) === partial.key ? model.monthComparison : null;
  const show = comparison && ui.comparePartial;
  const shortRange = interval => `${date(interval.from).slice(0, 5)}–${date(interval.to).slice(0, 5)}`;
  const rows = show ? SERIES.map(series => {
    const previous = comparison.previous[series.id], current = comparison.current[series.id];
    const change = previous ? (current - previous) / Math.abs(previous) * 100 : null;
    const positive = change !== null && (series.id === 'expenses' ? change <= 0 : change >= 0);
    return `<tr><th scope="row">${series.label}</th><td>${money(previous)}</td><td>${money(current)}</td><td><span class="comparison-change ${change === null ? '' : positive ? 'positive' : 'negative'}">${change === null ? 'Sem base' : `${change > 0 ? '+' : ''}${percent(change)}`}</span></td></tr>`;
  }).join('') : '';
  return `<div class="partial-period-note"><div><strong>${e(partial.periodTitle)} parcial</strong><p>${date(partial.coveredFrom)} a ${date(partial.coveredTo)}. Os períodos com * cobrem apenas parte do mês, trimestre ou ano.</p></div>${comparison ? `<button id="compare-period-button" class="button button-outline" data-action="toggle-period-comparison" aria-controls="month-comparison" aria-expanded="${!!show}">${show ? 'Fechar comparação' : 'Comparar mesmos dias'}</button>` : ''}</div>${show ? `<section class="month-comparison" id="month-comparison" aria-label="Comparação entre os mesmos dias do mês"><h3>Comparação entre os mesmos dias do mês</h3><p>${date(comparison.previous.from)} a ${date(comparison.previous.to)} × ${date(comparison.current.from)} a ${date(comparison.current.to)} · ${comparison.days} ${comparison.days === 1 ? 'dia' : 'dias'} em cada mês. Valores registrados, sem projeção.</p><div class="table-scroll"><table class="comparison-table"><thead><tr><th scope="col">Indicador</th><th scope="col">${shortRange(comparison.previous)}</th><th scope="col">${shortRange(comparison.current)}</th><th scope="col">Variação</th></tr></thead><tbody>${rows}</tbody></table></div></section>` : ''}`;
}

export function sparkline(values, color = '#2aa88f') {
  if (!values.length) return '';
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const points = values.map((value, i) => [i * 84 / Math.max(1, values.length - 1), 30 - (value - min) / (max - min) * 24]);
  return `<svg viewBox="0 0 88 36" class="sparkline" aria-hidden="true"><path d="${smooth(points)}" fill="none" stroke="${color}" stroke-width="1.8"/></svg>`;
}
