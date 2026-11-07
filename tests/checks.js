import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/seed-data.js';
import { MiridianStore, selectDashboard, validateDatabase, periodRange, previousRange, contractStatus, ENTITIES } from '../assets/js/state.js';
import { readLocal, writeLocal, packDatabase, unpackDatabase, STORAGE_KEY } from '../assets/js/storage.js';
import { groupFinance, financialChart } from '../assets/js/charts.js';
import { csv } from '../assets/js/components.js';
import { money, todayISO, addDays, sum, escapeHTML } from '../assets/js/formatters.js';
import { renderDashboard } from '../assets/js/modules/dashboard.js';
import { explorerContent, detailContent, ENTITY_LABELS } from '../assets/js/modules/explorer.js';
import { runAppSmoke } from './app-smoke.js';
import { navigationChecks } from './navigation-checks.js';
import { identityChecks } from './identity-checks.js';
import { dashboardChecks } from './dashboard-checks.js';
import { realismChecks } from './realism-checks.js';

const reference = '2026-11-07';
const base = createSeed(reference);
const clone = () => structuredClone(base);
const memoryStorage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const makeStore = () => { const store = new MiridianStore(memoryStorage()); store.load(); return store; };
export const checks = [
  ...realismChecks,
  ...dashboardChecks,
  ...identityChecks,
  ...navigationChecks,
  ['Renomeação preserva registros e preferências de bases e backups antigos', () => {
    const storage = memoryStorage();
    const legacy = clone();
    legacy.company.name = 'Grupo Meridian';
    legacy.employees = legacy.employees.map(row => ({ ...row, email: row.email.replace('@miridian.example', '@meridian.example') }));
    legacy.preferences.theme = 'dark'; legacy.preferences.unitId = 'U04';
    assert.equal(writeLocal(legacy, storage).ok, true);
    const store = new MiridianStore(storage); store.load(reference);
    assert.equal(store.data.company.name, 'Grupo Miridian');
    assert.ok(store.data.employees.every(row => row.email.endsWith('@miridian.example')));
    assert.deepEqual(JSON.parse(JSON.stringify(store.data.requests)), JSON.parse(JSON.stringify(legacy.requests)));
    assert.equal(store.data.preferences.theme, 'dark'); assert.equal(store.data.preferences.unitId, 'U04');
    assert.equal(store.persisted, true);
    assert.equal(readLocal(storage).data.company.name, 'Grupo Miridian');
    store.importData(legacy);
    assert.equal(store.data.company.name, 'Grupo Miridian');
    assert.deepEqual(JSON.parse(JSON.stringify(store.data.requests)), JSON.parse(JSON.stringify(legacy.requests)));
  }],
  ['Inicialização e eventos conectam filtros, tema, persistência e consultas', runAppSmoke],
  ['Gestores de unidades e departamentos pertencem às entidades vinculadas', () => {
    for (const row of base.units) assert.equal(base.employees.find(e => e.id === row.managerId).unitId, row.id);
    for (const row of base.departments) assert.equal(base.employees.find(e => e.id === row.managerId).departmentId, row.id);
  }],
  ['Despesas de origem mantêm vínculo e totais; conclusão não quita compromisso', () => {
    const linked = base.transactions.filter(t => t.requestId);
    assert.ok(linked.length > 0);
    for (const row of linked) { const request = base.requests.find(r => r.id === row.requestId); assert.equal(row.unitId, request.unitId); assert.equal(row.departmentId, request.departmentId); assert.ok(row.date >= request.completed); }
    const data = clone(); const row = data.requests.find(r => r.status === 'Concluída'); data.requests = [row]; data.transactions = [];
    assert.equal(selectDashboard(data, data.preferences, reference).committed, row.authorized);
  }],
  ['Base determinística e dimensões solicitadas', () => {
    assert.deepEqual(createSeed(reference), base);
    assert.deepEqual(['units', 'employees', 'suppliers', 'contracts', 'assets', 'requests'].map(key => base[key].length), [14, 1480, 240, 430, 3800, 2400]);
    assert.equal(base.employees.filter(row => row.profile === 'Gestão').length, 86);
  }],
  ['Identificadores e vínculos íntegros', () => {
    assert.equal(validateDatabase(base), base);
    for (const key of ENTITIES) assert.equal(new Set(base[key].map(row => row.id)).size, base[key].length);
  }],
  ['Receitas e despesas anuais correspondem exatamente aos registros', () => {
    const rows = base.transactions.filter(row => row.date.startsWith('2026'));
    assert.equal(sum(rows.filter(row => row.type === 'Receita')), 18500000000);
    assert.equal(sum(rows.filter(row => row.type === 'Despesa')), 12800000000);
    assert.ok(rows.every(row => Number.isSafeInteger(row.amount)));
  }],
  ['Cards, unidades e departamentos reconciliam com os lançamentos', () => {
    const m = selectDashboard(base, base.preferences, reference);
    assert.equal(m.revenue, sum(m.transactions.filter(row => row.type === 'Receita')));
    assert.equal(m.expenses, sum(m.departments));
    assert.equal(m.revenue, sum(m.units, 'revenue')); assert.equal(m.expenses, sum(m.units, 'expenses'));
    assert.equal(m.result, m.revenue - m.expenses);
  }],
  ['Filtro de unidade afeta todos os registros compatíveis', () => {
    const m = selectDashboard(base, { ...base.preferences, unitId: 'U03' }, reference);
    assert.equal(m.units.length, 1); assert.equal(m.units[0].id, 'U03');
    for (const key of ['transactions', 'requests', 'expiring', 'maintenance', 'audit']) assert.ok(m[key].every(row => row.unitId === 'U03'));
    assert.equal(m.revenue, m.units[0].revenue);
  }],
  ['Períodos inclusivos e comparação com intervalo anterior', () => {
    assert.deepEqual(periodRange('today', reference), { from: reference, to: reference });
    assert.deepEqual(periodRange('week', reference), { from: '2026-11-01', to: reference });
    assert.deepEqual(periodRange('month', reference), { from: '2026-10-09', to: reference });
    assert.deepEqual(periodRange('quarter', reference), { from: '2026-10-01', to: reference });
    assert.deepEqual(periodRange('year', reference), { from: '2026-01-01', to: reference });
    assert.deepEqual(previousRange({ from: '2026-11-01', to: reference }), { from: '2026-10-25', to: '2026-10-31' });
  }],
  ['Previsões e lançamentos futuros não viram valores realizados', () => {
    const m = selectDashboard(base, { ...base.preferences, period: 'custom', from: '2026-01-01', to: '2026-12-31' }, reference);
    assert.ok(m.transactions.every(row => row.date <= reference && row.status === 'Registrado'));
    assert.ok(m.revenue < 18500000000);
  }],
  ['Autorização é compromisso; realização parcial não duplica orçamento', () => {
    const data = clone(); data.requests = [data.requests.find(row => row.status === 'Aprovada')];
    const row = data.requests[0]; row.authorized = 100000;
    const original = selectDashboard(data, data.preferences, reference);
    const transaction = { ...data.transactions.find(t => t.type === 'Despesa' && t.date.startsWith('2026') && t.date < reference), id: 'MOV-TEST', unitId: row.unitId, amount: 40000, requestId: row.id };
    data.transactions.push(transaction);
    const after = selectDashboard(data, data.preferences, reference);
    assert.equal(original.committed, 100000); assert.equal(after.committed, 60000);
    assert.equal(after.expenses - original.expenses, 40000); assert.equal(after.available, original.available);
  }],
  ['Vencimentos usam data atual e preservam contratos suspensos', () => {
    for (const [offset, expected] of [[-1, 'Encerrado'], [0, 'Próximo do vencimento'], [30, 'Próximo do vencimento'], [31, 'Vigente']]) assert.equal(contractStatus({ end: addDays(reference, offset), status: 'Vigente' }, reference), expected);
    assert.equal(contractStatus({ end: reference, status: 'Suspenso' }, reference), 'Suspenso');
  }],
  ['Atrasos excluem processos finalizados', () => {
    const m = selectDashboard(base, base.preferences, reference);
    assert.ok(m.overdue.length > 0); assert.ok(m.overdue.every(row => row.due < reference && !['Concluída', 'Rejeitada', 'Cancelada'].includes(row.status)));
  }],
  ['Todos os agrupamentos do gráfico preservam os totais', () => {
    const m = selectDashboard(base, base.preferences, reference);
    for (const mode of ['month', 'quarter', 'year']) {
      const groups = groupFinance(m.transactions, m.range, mode);
      assert.equal(sum(groups, 'revenue'), m.revenue); assert.equal(sum(groups, 'expenses'), m.expenses); assert.equal(sum(groups, 'result'), m.result);
      assert.ok(!/NaN|undefined|Infinity/.test(financialChart(groups)));
    }
  }],
  ['Gráfico suporta um ponto e períodos sem dados', () => {
    const groups = groupFinance([], { from: reference, to: reference });
    assert.equal(groups.length, 1); assert.equal(groups[0].revenue, 0); assert.ok(!/NaN|undefined|Infinity/.test(financialChart(groups)));
  }],
  ['Base compacta é reversível e usa menos de 4 MiB UTF-16', () => {
    const packed = packDatabase(base); assert.deepEqual(unpackDatabase(JSON.parse(JSON.stringify(packed))), base);
    assert.ok(JSON.stringify(packed).length * 2 < 4 * 1024 * 1024);
  }],
  ['Persistência e preferências sobrevivem a uma nova instância', () => {
    const storage = memoryStorage(); const first = new MiridianStore(storage); first.load(reference);
    first.updatePreferences({ theme: 'dark', unitId: 'U04', period: 'week' });
    const second = new MiridianStore(storage); second.load(reference);
    assert.equal(second.data.preferences.theme, 'dark'); assert.equal(second.data.preferences.unitId, 'U04'); assert.equal(second.data.preferences.period, 'week');
  }],
  ['JSON corrompido é preservado sem sobrescrita silenciosa', () => {
    const storage = memoryStorage(); storage.setItem(STORAGE_KEY, '{invalido');
    const store = new MiridianStore(storage); store.load(reference);
    assert.equal(store.recovery, true); assert.equal(store.persisted, false); assert.equal(storage.getItem(STORAGE_KEY), '{invalido');
    store.updatePreferences({ theme: 'dark' }); assert.equal(storage.getItem(STORAGE_KEY), '{invalido');
  }],
  ['Falhas de quota e acesso mantêm a aplicação utilizável', () => {
    const blocked = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; } };
    assert.ok(readLocal(blocked).error); assert.equal(writeLocal(base, blocked).ok, false);
    const store = new MiridianStore(blocked); store.load(reference); assert.equal(store.data.units.length, 14); assert.ok(store.error);
  }],
  ['Versão incompatível preserva dados antigos para recuperação', () => {
    const storage = memoryStorage(); storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    const store = new MiridianStore(storage); store.load(reference); assert.equal(store.recovery, true); assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 99);
  }],
  ['Importação recusa IDs repetidos, vínculos quebrados, centavos fracionários e datas inválidas', () => {
    const mutations = [d => d.units.push({ ...d.units[0] }), d => { d.assets[0].unitId = 'U99'; }, d => { d.transactions[0].amount = 1.1; }, d => { d.contracts[0].end = '2026-02-31'; }, d => { d.requests[0].id = '\" onclick=\"x'; }, d => { d.transactions[0].costCenterId = 'CC-D01'; }];
    for (const mutation of mutations) { const data = clone(); mutation(data); assert.throws(() => validateDatabase(data)); }
  }],
  ['Importação válida e restauração atualizam base e índices', () => {
    const store = makeStore(); const data = clone(); data.preferences.theme = 'dark'; store.importData(data);
    assert.equal(store.get('units', 'U01').city, data.units[0].city); assert.equal(store.data.preferences.theme, 'dark');
    store.restore(reference); assert.equal(store.data.preferences.theme, 'light'); assert.equal(store.data.requests.length, 2400);
  }],
  ['Cadastro gera ID único, histórico, notificação, persistência e indicadores', () => {
    const store = makeStore(); const before = selectDashboard(store.data);
    const input = { title: 'Teste de manutenção operacional', description: 'Registro de teste', category: 'Manutenção de equipamentos', unitId: 'U01', departmentId: 'D06', requesterId: 'COL-0003', responsibleId: 'COL-0005', amount: 123456, due: addDays(todayISO(), 10), priority: 'Alta' };
    const first = store.createRequest(input), second = store.createRequest(input); const after = selectDashboard(store.data);
    assert.notEqual(first.id, second.id); assert.equal(first.status, 'Aberta'); assert.equal(after.open.length, before.open.length + 2);
    assert.equal(after.expenses, before.expenses); assert.equal(after.revenue, before.revenue);
    assert.ok(store.data.audit.some(row => row.entityId === first.id)); assert.ok(store.data.notifications.some(row => row.text.includes(first.id)));
    const reloaded = new MiridianStore(store.storage); reloaded.load(); assert.ok(reloaded.get('requests', first.id)); validateDatabase(store.data);
  }],
  ['Cadastro valida campos, vínculos, prioridade, prazo e dinheiro', () => {
    const store = makeStore(); const input = { title: 'Solicitação de teste', unitId: 'U01', departmentId: 'D06', requesterId: 'COL-0003', responsibleId: 'COL-0005', amount: 10000, due: addDays(todayISO(), 10), priority: 'Normal' };
    for (const change of [{ title: '' }, { amount: 1.3 }, { amount: -5 }, { due: addDays(todayISO(), -1) }, { unitId: 'U99' }, { priority: 'Inválida' }]) assert.throws(() => store.createRequest({ ...input, ...change }));
  }],
  ['Preferência de notificações é respeitada', () => {
    const store = makeStore(); store.updatePreferences({ notifications: false });
    store.createRequest({ title: 'Solicitação sem notificação', unitId: 'U01', departmentId: 'D06', requesterId: 'COL-0003', responsibleId: 'COL-0005', amount: 10000, due: todayISO(), priority: 'Normal' });
    assert.equal(store.data.notifications.length, 0);
  }],
  ['HTML e CSV são escapados, com dinheiro no formato brasileiro', () => {
    assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
    const output = csv([['=HYPERLINK("x")', 'a;b', 'texto "com aspas"']]);
    assert.ok(output.includes("'=HYPERLINK")); assert.ok(output.includes('"a;b"')); assert.ok(output.includes('"texto ""com aspas"""'));
    assert.equal(money(125000000), 'R$\u00a01.250.000,00');
    const store = makeStore();
    const row = store.createRequest({ title: '<img src=x onerror=alert(1)>', unitId: 'U01', departmentId: 'D06', requesterId: 'COL-0003', responsibleId: 'COL-0005', amount: 10000, due: todayISO(), priority: 'Normal' });
    const html = detailContent('requests', row.id, store);
    assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img'));
  }],
  ['Dashboard e consultas renderizam sem valores ausentes', () => {
    const store = makeStore(); const html = renderDashboard(selectDashboard(store.data), store, { chartMode: 'month', hiddenSeries: new Set(), updated: 'agora' });
    assert.ok(!/NaN|undefined|Infinity/.test(html)); assert.ok(html.includes('Desempenho financeiro'));
    assert.ok(detailContent('requests', 'SOL-INEXISTENTE', store).includes('Registro não encontrado'));
    for (const entity of Object.keys(ENTITY_LABELS)) {
      const result = explorerContent(entity, store, { page: 1, query: '', sort: 0 }); assert.ok(!/NaN|undefined|Infinity/.test(result.html), entity);
      const actual = entity === 'approvals' ? 'requests' : entity;
      assert.ok(!/NaN|undefined|Infinity/.test(detailContent(actual, store.data[actual][0].id, store)), actual);
    }
  }],
  ['Consulta combina pesquisa sem acentos, status, ordenação e paginação', () => {
    const store = makeStore(); const state = { page: 1, query: 'manutencao', status: 'Aguardando aprovação', sort: 4, direction: 'desc' };
    const result = explorerContent('requests', store, state);
    assert.ok(result.rows.length > 0); assert.ok(result.rows.every(row => row.status === 'Aguardando aprovação'));
    assert.ok(result.rows.every((row, i, rows) => !i || row.amount <= rows[i - 1].amount));
    state.page = 9999; explorerContent('requests', store, state); assert.ok(state.page < 9999);
    const none = explorerContent('requests', store, { page: 1, query: 'inexistente-xyz' }); assert.equal(none.rows.length, 0); assert.ok(none.html.includes('Nenhum registro'));
  }],
];
