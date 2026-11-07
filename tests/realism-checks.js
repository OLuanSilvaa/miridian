import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/seed-data.js';
import { LEGACY_REQUEST_TITLES, REQUEST_TYPES, REQUEST_CONTENT_VERSION } from '../assets/js/request-catalog.js';
import { MiridianStore, selectDashboard, compareMonthDays, validateDatabase } from '../assets/js/state.js';
import { groupFinance, financialChart, financialContext } from '../assets/js/charts.js';
import { writeLocal } from '../assets/js/storage.js';
import { money } from '../assets/js/formatters.js';

const reference = '2026-11-07';
const base = createSeed(reference);
const filters = { ...base.preferences, unitId: 'U05', period: 'year' };
const ui = { chartMode: 'month', hiddenSeries: new Set(), comparePartial: true };
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
function legacyData() {
  const data = createSeed(reference); data.requestContentVersion = 1;
  data.requests.forEach((row, index) => { row.title = LEGACY_REQUEST_TITLES[index % 7]; row.category = REQUEST_TYPES[index % 7]; });
  const titles = new Map(data.requests.map(row => [row.id, row.title]));
  data.transactions.forEach(row => { if (row.requestId) row.description = titles.get(row.requestId); });
  return data;
}
const normalize = value => JSON.parse(JSON.stringify(value));

export const realismChecks = [
  ['Novembro é identificado como parcial sem alterar os valores registrados', () => {
    const model = selectDashboard(base, filters, reference);
    const groups = groupFinance(model.transactions, model.range, 'month', reference);
    const november = groups.find(row => row.key === '2026-11');
    const october = groups.find(row => row.key === '2026-10');
    assert.equal(november.partial, true); assert.equal(november.coveredFrom, '2026-11-01'); assert.equal(november.coveredTo, reference);
    assert.equal(october.partial, false);
    assert.equal(groups.reduce((total, row) => total + row.revenue, 0), model.revenue);
    assert.ok(financialChart(groups).includes('Nov*'));
    const context = financialContext(model, groups, ui);
    assert.ok(context.includes('Novembro de 2026 parcial')); assert.ok(context.includes('07/11/2026'));
    assert.ok(context.includes('month-comparison')); assert.ok(!/NaN|undefined|Infinity/.test(context));
  }],
  ['Comparação proporcional usa somente os mesmos sete dias da unidade selecionada', () => {
    const model = selectDashboard(base, filters, reference);
    const comparison = model.monthComparison;
    assert.equal(comparison.days, 7);
    assert.equal(comparison.current.from, '2026-11-01'); assert.equal(comparison.current.to, '2026-11-07');
    assert.equal(comparison.previous.from, '2026-10-01'); assert.equal(comparison.previous.to, '2026-10-07');
    for (const interval of [comparison.current, comparison.previous]) {
      const rows = base.transactions.filter(row => row.unitId === 'U05' && row.status === 'Registrado' && row.date >= interval.from && row.date <= interval.to);
      assert.equal(interval.revenue, rows.filter(row => row.type === 'Receita').reduce((total, row) => total + row.amount, 0));
      assert.equal(interval.expenses, rows.filter(row => row.type === 'Despesa').reduce((total, row) => total + row.amount, 0));
      assert.equal(interval.result, interval.revenue - interval.expenses);
    }
    const october = groupFinance(model.transactions, model.range, 'month', reference).find(row => row.key === '2026-10');
    assert.ok(comparison.previous.revenue < october.revenue, 'A comparação não deve usar o mês anterior inteiro.');
  }],
  ['Intervalos equivalentes respeitam anos, meses curtos e ano bissexto', () => {
    const january = compareMonthDays([], { from: '2026-01-01', to: '2026-01-07' }, '2026-01-07');
    assert.equal(january.previous.from, '2025-12-01'); assert.equal(january.previous.to, '2025-12-07');
    const leap = compareMonthDays([], { from: '2024-03-01', to: '2024-03-30' }, '2024-03-30');
    assert.equal(leap.days, 29); assert.equal(leap.current.to, '2024-03-29'); assert.equal(leap.previous.to, '2024-02-29');
    const regular = compareMonthDays([], { from: '2026-03-01', to: '2026-03-30' }, '2026-03-30');
    assert.equal(regular.days, 28); assert.equal(regular.current.to, '2026-03-28'); assert.equal(regular.previous.to, '2026-02-28');
    assert.equal(compareMonthDays([], { from: '2026-03-30', to: '2026-03-30' }, '2026-03-30'), null);
    assert.equal(compareMonthDays([], { from: '2026-10-01', to: '2026-10-31' }, reference), null);
  }],
  ['Filtros personalizados indicam recortes parciais e não desenham meses futuros como queda', () => {
    const model = selectDashboard(base, { ...filters, period: 'custom', from: '2026-10-09', to: '2026-12-31' }, reference);
    const groups = groupFinance(model.transactions, model.range, 'month', reference);
    assert.deepEqual(groups.map(row => row.key), ['2026-10', '2026-11']);
    assert.ok(groups.every(row => row.partial)); assert.equal(groups[0].coveredFrom, '2026-10-09');
    for (const mode of ['quarter', 'year']) {
      const grouped = groupFinance(model.transactions, model.range, mode, reference);
      assert.equal(grouped.at(-1).partial, true);
      assert.equal(grouped.reduce((total, row) => total + row.revenue, 0), model.revenue);
    }
    const complete = groupFinance([], { from: '2026-10-01', to: '2026-10-31' }, 'month', reference);
    assert.equal(complete[0].partial, false); assert.equal(financialContext(model, complete, ui), '');
  }],
  ['Cada unidade possui categorias variadas e os últimos cinco pedidos têm títulos distintos', () => {
    assert.equal(base.requestContentVersion, REQUEST_CONTENT_VERSION);
    for (const unit of base.units) {
      const requests = base.requests.filter(row => row.unitId === unit.id);
      assert.equal(new Set(requests.map(row => row.category)).size, REQUEST_TYPES.length);
      assert.ok(new Set(requests.map(row => row.title)).size >= 40, unit.name);
      assert.equal(new Set(requests.slice(-5).map(row => row.title)).size, 5, unit.name);
    }
    assert.ok(base.requests.some(row => row.title === 'Substituição de equipamentos de refrigeração'));
    assert.ok(base.requests.some(row => row.title === 'Aquisição de servidores para infraestrutura'));
    assert.ok(base.requests.some(row => row.title === 'Manutenção corretiva da Unidade 05'));
    validateDatabase(base);
  }],
  ['Base já salva recebe títulos variados sem alterar pedidos personalizados ou valores', () => {
    const data = legacyData();
    data.requests[0].title = 'Pedido ajustado pelo visitante';
    data.requests[1].description = 'Observação adicionada pelo visitante';
    const custom = { ...data.requests.find(row => row.status === 'Aberta'), id: 'SOL-2026-2401', title: LEGACY_REQUEST_TITLES[0], category: REQUEST_TYPES[0], description: '' };
    data.requests.push(custom);
    const stableRequests = normalize(data.requests.map(({ title, category, ...row }) => row));
    const stableTransactions = normalize(data.transactions.map(({ description, ...row }) => row));
    const storage = memory(); writeLocal(data, storage);
    const store = new MiridianStore(storage); store.load(reference);
    assert.equal(store.data.requestContentVersion, REQUEST_CONTENT_VERSION);
    assert.equal(store.data.requests[0].title, data.requests[0].title);
    assert.equal(store.data.requests[1].title, data.requests[1].title);
    assert.equal(store.get('requests', custom.id).title, custom.title);
    assert.notEqual(store.data.requests[2].title, data.requests[2].title);
    assert.deepEqual(normalize(store.data.requests.map(({ title, category, ...row }) => row)), stableRequests);
    assert.deepEqual(normalize(store.data.transactions.map(({ description, ...row }) => row)), stableTransactions);
    store.data.requests[2].title = 'Título editado após a atualização'; store.persist();
    const loaded = new MiridianStore(storage); loaded.load(reference);
    assert.equal(loaded.data.requests[2].title, 'Título editado após a atualização');
    assert.equal(loaded.persisted, true); validateDatabase(loaded.data);
  }],
  ['Importação de base anterior atualiza somente o conteúdo inicial e os vínculos textuais', () => {
    const data = legacyData(); const storage = memory(); const store = new MiridianStore(storage); store.load(reference);
    const original = selectDashboard(data, filters, reference); store.importData(data);
    const updated = selectDashboard(store.data, filters, reference);
    assert.equal(updated.revenue, original.revenue); assert.equal(updated.expenses, original.expenses); assert.equal(updated.available, original.available);
    assert.equal(updated.requests.length, original.requests.length);
    for (const row of store.data.transactions.filter(row => row.requestId)) assert.equal(row.description, store.get('requests', row.requestId).title);
    assert.equal(new Set(store.data.requests.filter(row => row.unitId === 'U05').map(row => row.category)).size, 7);
  }],
  ['Receita da Unidade 05 é exclusiva e não é afetada por lançamentos de outras unidades', () => {
    const model = selectDashboard(base, filters, reference);
    const consolidated = selectDashboard(base, { ...filters, unitId: 'all' }, reference);
    assert.equal(model.revenue, 1384776796); assert.equal(consolidated.revenue, 15748676297);
    assert.ok(model.transactions.every(row => row.unitId === 'U05'));
    assert.equal(model.revenue, consolidated.units.find(row => row.id === 'U05').revenue);
    const data = createSeed(reference);
    data.transactions.filter(row => row.unitId === 'U03' && row.type === 'Receita').forEach(row => { row.amount += 10000; });
    const unchanged = selectDashboard(data, filters, reference);
    assert.equal(unchanged.revenue, model.revenue);
    assert.equal(unchanged.monthComparison.current.revenue, model.monthComparison.current.revenue);
    assert.equal(unchanged.monthComparison.previous.revenue, model.monthComparison.previous.revenue);
    assert.ok(financialContext(model, groupFinance(model.transactions, model.range, 'month', reference), ui).includes(money(model.monthComparison.current.revenue)));
  }],
];
