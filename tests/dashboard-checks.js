import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/seed-data.js';
import { MiridianStore, selectDashboard } from '../assets/js/state.js';
import { budgetCard } from '../assets/js/components.js';
import { money, todayISO, addDays } from '../assets/js/formatters.js';

const reference = '2026-11-07';
const seed = createSeed(reference);
const unitFilters = { ...seed.preferences, unitId: 'U05', period: 'year' };
export const dashboardChecks = [
  ['Saldo negativo preserva o cálculo e informa o valor da extrapolação', () => {
    const model = selectDashboard(seed, unitFilters, reference);
    assert.equal(model.available, -17363772);
    assert.equal(Math.round(model.used * 10), 1017);
    const card = budgetCard(model);
    assert.ok(card.includes('Saldo orçamentário'));
    assert.ok(card.includes('data-budget-state="exceeded"'));
    assert.ok(card.includes('Limite excedido'));
    assert.ok(card.includes(money(-17363772)));
    assert.ok(card.includes(`${money(17363772)} acima do limite anual`));
  }],
  ['Saldo zero ou positivo não é tratado como extrapolação', () => {
    const data = createSeed(reference);
    const original = selectDashboard(data, unitFilters, reference);
    const unit = data.units.find(row => row.id === 'U05');
    unit.budget = original.annualExpenses + original.committed;
    const zero = selectDashboard(data, unitFilters, reference);
    assert.equal(zero.available, 0); assert.equal(zero.used, 100);
    assert.ok(budgetCard(zero).includes('data-budget-state="limit"'));
    assert.ok(!budgetCard(zero).includes('Limite excedido'));
    unit.budget += 5000000;
    const positive = selectDashboard(data, unitFilters, reference);
    assert.equal(positive.available, 5000000);
    assert.ok(budgetCard(positive).includes('data-budget-state="available"'));
    assert.ok(!budgetCard(positive).includes('Limite excedido'));
  }],
  ['Contagem da imagem concilia 162 registros: 81 em aberto, 54 concluídos e 27 rejeitados', () => {
    const model = selectDashboard(seed, unitFilters, reference);
    const statuses = Object.fromEntries(model.statuses.map(row => [row.status, row.count]));
    assert.equal(model.requests.length, 162);
    assert.equal(model.open.length, 81); assert.equal(model.completed.length, 54);
    assert.equal(statuses.Rejeitada, 27); assert.equal(model.pending.length, 0);
    assert.equal(statuses['Em análise'], 27); assert.equal(statuses.Aprovada, 27); assert.equal(model.running.length, 27);
    assert.equal(model.requests.length, model.open.length + model.completed.length + statuses.Rejeitada);
  }],
  ['Totais por status são derivados dos registros em todas as unidades e períodos', () => {
    for (const unitId of ['all', ...seed.units.map(row => row.id)]) {
      for (const period of ['today', 'week', 'month', 'quarter', 'year', 'custom']) {
        const model = selectDashboard(seed, { ...seed.preferences, unitId, period, from: '2026-07-01', to: reference }, reference);
        const records = seed.requests.filter(row => (unitId === 'all' || row.unitId === unitId) && row.created >= model.range.from && row.created <= model.range.to);
        assert.equal(model.requests.length, records.length);
        assert.equal(model.statuses.reduce((total, row) => total + row.count, 0), records.length);
        const closed = records.filter(row => ['Concluída', 'Rejeitada', 'Cancelada'].includes(row.status));
        assert.equal(model.open.length + closed.length, records.length);
        assert.equal(model.pending.length, records.filter(row => row.status === 'Aguardando aprovação').length);
        assert.equal(model.running.length, records.filter(row => row.status === 'Em execução').length);
        assert.equal(model.completed.length, records.filter(row => row.status === 'Concluída').length);
      }
    }
  }],
  ['Cadastro e recarga atualizam os totais da unidade sem alterar registros de outras unidades', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const store = new MiridianStore(storage); store.load(); store.updatePreferences({ unitId: 'U05', period: 'year' });
    const before = selectDashboard(store.data);
    const otherBefore = selectDashboard(store.data, { ...store.data.preferences, unitId: 'U03' });
    store.createRequest({ title: 'Manutenção dos equipamentos da unidade', unitId: 'U05', departmentId: 'D06', requesterId: 'COL-0005', responsibleId: 'COL-0019', amount: 350000, due: addDays(todayISO(), 10), priority: 'Alta' }, { name: 'Ana Duarte' });
    const loaded = new MiridianStore(storage); loaded.load();
    const after = selectDashboard(loaded.data);
    assert.equal(after.requests.length, before.requests.length + 1);
    assert.equal(after.open.length, before.open.length + 1);
    assert.equal(after.pending.length, before.pending.length); assert.equal(after.completed.length, before.completed.length);
    const otherAfter = selectDashboard(loaded.data, { ...loaded.data.preferences, unitId: 'U03' });
    assert.equal(otherAfter.requests.length, otherBefore.requests.length);
    assert.equal(after.revenue, before.revenue); assert.equal(after.expenses, before.expenses);
  }],
];
