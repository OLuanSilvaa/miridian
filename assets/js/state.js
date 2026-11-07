import { createSeed, SCHEMA_VERSION, STATUSES, STAFF } from './seed-data.js';
import { readLocal, writeLocal } from './storage.js';
import { addDays, todayISO, sum } from './formatters.js';
import { migrateRequestContent } from './request-catalog.js';

export const ENTITIES = ['units', 'departments', 'employees', 'suppliers', 'contracts', 'assets', 'requests', 'activities', 'approvals', 'costCenters', 'transactions', 'audit', 'notifications'];
const requiredFields = {
  units: ['name', 'city', 'state', 'type', 'managerId', 'status'], departments: ['name', 'managerId'], employees: ['name', 'role', 'email', 'status', 'profile'],
  suppliers: ['name', 'category', 'city', 'state', 'contact', 'email', 'status'], contracts: ['title', 'start', 'end', 'status'], assets: ['name', 'category', 'acquired', 'condition', 'status'],
  requests: ['title', 'category', 'priority', 'status', 'created', 'due'], activities: ['status'], approvals: ['date', 'status', 'profileId'], costCenters: ['name'], transactions: ['description', 'type', 'category', 'date', 'status'],
  audit: ['time', 'profileId', 'entity', 'entityId', 'action', 'description'], notifications: ['text', 'time'],
};
const links = {
  units: { managerId: 'employees' }, departments: { managerId: 'employees' }, employees: { unitId: 'units', departmentId: 'departments' },
  contracts: { unitId: 'units', departmentId: 'departments', supplierId: 'suppliers', responsibleId: 'employees' },
  assets: { unitId: 'units', departmentId: 'departments', responsibleId: 'employees' },
  requests: { unitId: 'units', departmentId: 'departments', requesterId: 'employees', responsibleId: 'employees' },
  activities: { requestId: 'requests', responsibleId: 'employees' }, approvals: { requestId: 'requests' }, costCenters: { departmentId: 'departments' },
  transactions: { unitId: 'units', departmentId: 'departments', costCenterId: 'costCenters' },
};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export function validateDatabase(data) {
  if (!data || data.version !== SCHEMA_VERSION) throw new Error('Versão de dados incompatível. Exporte seu backup antes de restaurar a base.');
  if (!validDate(data.seedDate) || !data.company || typeof data.company.name !== 'string') throw new Error('Identificação da base inválida.');
  const ids = {};
  for (const entity of ENTITIES) {
    if (!Array.isArray(data[entity]) || data[entity].length > 50000) throw new Error(`Coleção inválida: ${entity}.`);
    ids[entity] = new Set();
    for (const row of data[entity]) {
      if (!row || typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(row.id) || ids[entity].has(row.id)) throw new Error(`Identificador inválido ou repetido em ${entity}.`);
      ids[entity].add(row.id);
      for (const key of requiredFields[entity]) if (typeof row[key] !== 'string' || !row[key].trim() || row[key].length > 5000) throw new Error(`Campo ${key} inválido em ${row.id}.`);
      if (row.actorName !== undefined && (typeof row.actorName !== 'string' || !row.actorName.trim() || row.actorName.length > 121)) throw new Error(`Responsável inválido em ${row.id}.`);
      for (const key of ['amount', 'authorized', 'budget']) if (row[key] !== undefined && (!Number.isSafeInteger(row[key]) || row[key] < 0)) throw new Error(`Valor monetário inválido em ${row.id}.`);
      if (['contracts', 'assets', 'requests', 'transactions', 'approvals'].includes(entity) && !Number.isSafeInteger(row.amount)) throw new Error(`Valor ausente em ${row.id}.`);
      if (entity === 'units' && !Number.isSafeInteger(row.budget)) throw new Error(`Orçamento ausente em ${row.id}.`);
      for (const key of ['created', 'due', 'completed', 'start', 'end', 'date', 'acquired']) if (row[key] !== undefined && !validDate(row[key])) throw new Error(`Data inválida em ${row.id}.`);
      if (row.time && Number.isNaN(Date.parse(row.time))) throw new Error(`Horário inválido em ${row.id}.`);
      if (entity === 'requests' && !STATUSES.includes(row.status)) throw new Error(`Status inválido em ${row.id}.`);
      if (entity === 'requests' && row.due < row.created) throw new Error(`Prazo anterior à abertura em ${row.id}.`);
      if (entity === 'contracts' && row.end < row.start) throw new Error(`Vigência inválida em ${row.id}.`);
      if (entity === 'transactions' && (!['Receita', 'Despesa'].includes(row.type) || !['Registrado', 'Previsto'].includes(row.status))) throw new Error(`Movimentação inválida em ${row.id}.`);
    }
  }
  for (const [entity, fields] of Object.entries(links)) for (const row of data[entity]) for (const [field, target] of Object.entries(fields)) if (!ids[target].has(row[field])) throw new Error(`Vínculo inválido: ${entity}.${field}.`);
  const centers = new Map(data.costCenters.map(row => [row.id, row.departmentId]));
  for (const row of data.transactions) {
    if (row.requestId && !ids.requests.has(row.requestId)) throw new Error('Solicitação de origem inexistente.');
    if (centers.get(row.costCenterId) !== row.departmentId) throw new Error('Centro de custo incompatível com o departamento.');
  }
  if (!data.preferences || !['light', 'dark'].includes(data.preferences.theme) || (data.preferences.profileId !== undefined && !STAFF.some(row => row.id === data.preferences.profileId)) || (data.preferences.unitId !== 'all' && !ids.units.has(data.preferences.unitId))) throw new Error('Preferências inválidas.');
  if (!['today', 'week', 'month', 'quarter', 'year', 'custom'].includes(data.preferences.period)) throw new Error('Período inválido.');
  if (data.preferences.period === 'custom' && (!validDate(data.preferences.from) || !validDate(data.preferences.to) || data.preferences.from > data.preferences.to)) throw new Error('Intervalo personalizado inválido.');
  return data;
}

export function periodRange(period, referenceDate = todayISO(), custom = {}) {
  const year = referenceDate.slice(0, 4);
  const month = Number(referenceDate.slice(5, 7));
  if (period === 'custom') return { from: custom.from || `${year}-01-01`, to: custom.to || referenceDate };
  if (period === 'today') return { from: referenceDate, to: referenceDate };
  if (period === 'week') return { from: addDays(referenceDate, -6), to: referenceDate };
  if (period === 'month') return { from: addDays(referenceDate, -29), to: referenceDate };
  if (period === 'quarter') return { from: `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}-01`, to: referenceDate };
  return { from: `${year}-01-01`, to: referenceDate };
}
export function previousRange(range) {
  const days = Math.round((new Date(`${range.to}T12:00:00Z`) - new Date(`${range.from}T12:00:00Z`)) / 86400000) + 1;
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}
export const isOpen = row => !['Concluída', 'Rejeitada', 'Cancelada'].includes(row.status);
export function contractStatus(row, referenceDate = todayISO()) {
  if (['Suspenso', 'Cancelado', 'Encerrado'].includes(row.status)) return row.status;
  return row.end < referenceDate ? 'Encerrado' : row.end <= addDays(referenceDate, 30) ? 'Próximo do vencimento' : 'Vigente';
}

export function compareMonthDays(transactions, range, referenceDate = todayISO()) {
  const cutoff = range.to < referenceDate ? range.to : referenceDate;
  if (range.from > cutoff) return null;
  const year = Number(cutoff.slice(0, 4)), month = Number(cutoff.slice(5, 7));
  const monthStart = `${cutoff.slice(0, 7)}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const from = range.from > monthStart ? range.from : monthStart;
  if (from === monthStart && cutoff === monthEnd) return null;
  const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const firstDay = Number(from.slice(8, 10));
  const lastDay = Math.min(Number(cutoff.slice(8, 10)), new Date(Date.UTC(year, month - 1, 0)).getUTCDate());
  if (firstDay > lastDay) return null;
  const day = value => String(value).padStart(2, '0');
  const summarize = (start, end) => {
    const rows = transactions.filter(row => row.status === 'Registrado' && row.date >= start && row.date <= end);
    const revenue = sum(rows.filter(row => row.type === 'Receita'));
    const expenses = sum(rows.filter(row => row.type === 'Despesa'));
    return { from: start, to: end, revenue, expenses, result: revenue - expenses, records: rows.length };
  };
  return { days: lastDay - firstDay + 1, current: summarize(from, `${cutoff.slice(0, 7)}-${day(lastDay)}`), previous: summarize(`${previousMonth}-${day(firstDay)}`, `${previousMonth}-${day(lastDay)}`) };
}

export function selectDashboard(data, filters = data.preferences, referenceDate = todayISO()) {
  const range = periodRange(filters.period, referenceDate, filters);
  const previous = previousRange(range);
  const matchesUnit = row => filters.unitId === 'all' || row.unitId === filters.unitId;
  const within = (value, interval) => value >= interval.from && value <= interval.to;
  const allTransactions = data.transactions.filter(row => matchesUnit(row) && row.status === 'Registrado' && row.date <= referenceDate);
  const transactions = allTransactions.filter(row => within(row.date, range));
  const priorTransactions = allTransactions.filter(row => within(row.date, previous));
  const revenue = sum(transactions.filter(row => row.type === 'Receita'));
  const expenses = sum(transactions.filter(row => row.type === 'Despesa'));
  const priorRevenue = sum(priorTransactions.filter(row => row.type === 'Receita'));
  const priorExpenses = sum(priorTransactions.filter(row => row.type === 'Despesa'));
  const requests = data.requests.filter(row => matchesUnit(row) && within(row.created, range));
  const allRequests = data.requests.filter(matchesUnit);
  const pending = requests.filter(row => row.status === 'Aguardando aprovação');
  const running = requests.filter(row => row.status === 'Em execução');
  const completed = requests.filter(row => row.status === 'Concluída');
  const open = requests.filter(isOpen);
  const overdue = open.filter(row => row.due < referenceDate);
  const expiring = data.contracts.filter(row => matchesUnit(row) && contractStatus(row, referenceDate) === 'Próximo do vencimento');
  const maintenance = data.assets.filter(row => matchesUnit(row) && row.status === 'Em manutenção');
  const spentByRequest = new Map();
  data.transactions.filter(row => row.type === 'Despesa' && row.status === 'Registrado' && row.date <= referenceDate && row.requestId).forEach(row => spentByRequest.set(row.requestId, (spentByRequest.get(row.requestId) || 0) + row.amount));
  const committed = sum(allRequests.filter(row => row.authorized && !['Rejeitada', 'Cancelada'].includes(row.status)).map(row => ({ amount: Math.max(0, row.authorized - (spentByRequest.get(row.id) || 0)) })));
  const annualBudget = sum(data.units.filter(row => filters.unitId === 'all' || row.id === filters.unitId), 'budget');
  const yearStart = `${referenceDate.slice(0, 4)}-01-01`;
  const annualExpenses = sum(allTransactions.filter(row => row.type === 'Despesa' && row.date >= yearStart));
  const available = annualBudget - annualExpenses - committed;
  const used = annualBudget ? (annualExpenses + committed) / annualBudget * 100 : 0;
  const units = data.units.filter(row => filters.unitId === 'all' || row.id === filters.unitId).map(row => {
    const revenue = sum(transactions.filter(t => t.unitId === row.id && t.type === 'Receita'));
    const expenses = sum(transactions.filter(t => t.unitId === row.id && t.type === 'Despesa'));
    const related = requests.filter(r => r.unitId === row.id);
    return { ...row, revenue, expenses, result: revenue - expenses, active: related.filter(isOpen).length, performance: related.length ? related.filter(r => r.status === 'Concluída').length / related.length * 100 : 0 };
  }).sort((a, b) => b.revenue - a.revenue);
  const groups = [['Operações', 'D04', '#3b6fea'], ['Logística', 'D05', '#7e9ff3'], ['Administração', 'D09', '#a7bdf6'], ['Manutenção', 'D06', '#2aa88f'], ['Tecnologia', 'D08', '#79c8ba'], ['Recursos Humanos', 'D07', '#f3bb64'], ['Comercial', 'D10', '#d9e1ef']];
  const departments = groups.map(([name, id, color]) => ({ name, id, color, amount: sum(transactions.filter(row => row.type === 'Despesa' && row.departmentId === id)) }));
  // Other administrative cost centers are folded into Administração.
  departments[2].amount += sum(transactions.filter(row => row.type === 'Despesa' && !groups.some(group => group[1] === row.departmentId)));
  return { referenceDate, monthComparison: compareMonthDays(allTransactions, range, referenceDate), range, previous, transactions, priorTransactions, revenue, expenses, result: revenue - expenses, priorRevenue, priorExpenses, priorResult: priorRevenue - priorExpenses, requests, open, pending, running, completed, overdue, expiring, maintenance, committed, annualBudget, annualExpenses, available, used, units, departments, audit: data.audit.filter(matchesUnit).sort((a, b) => b.time.localeCompare(a.time)), statuses: STATUSES.map(status => ({ status, count: requests.filter(row => row.status === status).length })) };
}

function updateBrand(data) {
  const company = data.company.name === 'Grupo Meridian' ? { ...data.company, name: 'Grupo Miridian' } : data.company;
  const employees = data.employees.map(row => row.email.endsWith('@meridian.example') ? { ...row, email: row.email.replace(/@meridian\.example$/, '@miridian.example') } : row);
  const preferences = data.preferences.profileId === undefined ? data.preferences : Object.fromEntries(Object.entries(data.preferences).filter(([key]) => key !== 'profileId'));
  const current = company === data.company && preferences === data.preferences && employees.every((row, index) => row === data.employees[index]) ? data : { ...data, company, employees, preferences };
  return migrateRequestContent(current);
}

export class MiridianStore {
  constructor(storage) { this.storage = storage; this.listeners = new Set(); this.error = null; this.recovery = false; this.persisted = false; }
  load(referenceDate) {
    this.data = null; this.recovery = false; this.error = null; this.persisted = false;
    const result = readLocal(this.storage);
    if (result.error) { this.error = result.error; this.recovery = true; }
    if (result.data) {
      try {
        const data = validateDatabase(result.data);
        this.data = updateBrand(data); this.persisted = true;
        if (this.data !== data) this.persist();
      }
      catch (error) { this.error = error.message; this.recovery = true; }
    }
    if (!this.data) {
      this.data = createSeed(referenceDate);
      if (!this.recovery) this.persist();
    }
    this.reindex();
    return this.data;
  }
  reindex() { this.index = Object.fromEntries(ENTITIES.map(key => [key, new Map(this.data[key].map(row => [row.id, row]))])); }
  get(entity, id) { return this.index[entity]?.get(id); }
  persist() {
    if (this.recovery) return false;
    const result = writeLocal(this.data, this.storage);
    this.error = result.error || null; this.persisted = result.ok;
    return result.ok;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.reindex(); this.listeners.forEach(fn => fn(this.data)); }
  updatePreferences(values) {
    this.data.preferences = { ...this.data.preferences, ...values };
    this.persist(); this.emit();
  }
  importData(data) {
    const validated = updateBrand(validateDatabase(data));
    const result = writeLocal(validated, this.storage);
    if (!result.ok) throw new Error(result.error);
    this.data = validated; this.error = null; this.recovery = false; this.persisted = true; this.emit();
  }
  restore(referenceDate) { this.importData(createSeed(referenceDate)); }
  markNotificationsRead() {
    this.data.notifications = this.data.notifications.map(row => ({ ...row, read: true })); this.persist(); this.emit();
  }
  createRequest(input, actor = {}) {
    const title = String(input.title || '').trim();
    if (title.length < 5 || title.length > 140) throw new Error('Informe um título com 5 a 140 caracteres.');
    for (const [field, entity] of Object.entries(links.requests)) if (!this.get(entity, input[field])) throw new Error('Selecione unidade, departamento, solicitante e responsável válidos.');
    if (!Number.isSafeInteger(input.amount) || input.amount < 0) throw new Error('Informe um valor válido.');
    if (!validDate(input.due) || input.due < todayISO()) throw new Error('O prazo deve ser hoje ou uma data futura.');
    if (!['Normal', 'Alta', 'Baixa', 'Urgente'].includes(input.priority)) throw new Error('Prioridade inválida.');
    const year = todayISO().slice(0, 4);
    const sequence = Math.max(0, ...this.data.requests.filter(row => row.id.startsWith(`SOL-${year}-`)).map(row => Number(row.id.split('-').pop()) || 0)) + 1;
    const id = `SOL-${year}-${String(sequence).padStart(4, '0')}`;
    const actorName = typeof actor.name === 'string' && actor.name.trim() ? actor.name.trim().slice(0, 121) : 'Usuário';
    const row = { id, title, description: String(input.description || '').slice(0, 3000), category: String(input.category || 'Solicitação administrativa').slice(0, 100), unitId: input.unitId, departmentId: input.departmentId, requesterId: input.requesterId, responsibleId: input.responsibleId, priority: input.priority, amount: input.amount, due: input.due, created: todayISO(), status: 'Aberta' };
    this.data.requests.push(row);
    this.data.audit.push({ id: `AUD-${globalThis.crypto.randomUUID()}`, time: new Date().toISOString(), profileId: 'visitor', actorName, entity: 'requests', entityId: id, action: 'Cadastro', description: `Criou ${id}: ${title}.`, unitId: row.unitId });
    if (this.data.preferences.notifications) this.data.notifications.push({ id: `NOT-${globalThis.crypto.randomUUID()}`, time: new Date().toISOString(), text: `${id} criada e disponível para acompanhamento.`, read: false });
    this.persist(); this.emit(); return row;
  }
}
