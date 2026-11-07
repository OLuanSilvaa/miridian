import { addDays, todayISO } from './formatters.js';
import { REQUEST_TYPES, REQUEST_CONTENT_VERSION, seedRequestDetails } from './request-catalog.js';
export { REQUEST_TYPES } from './request-catalog.js';

export const SCHEMA_VERSION = 1;
export const STATUSES = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Aprovada', 'Em execução', 'Concluída', 'Rejeitada', 'Devolvida', 'Cancelada'];
export const STAFF = [
  { id: 'director', name: 'Marcos Almeida', role: 'Diretor executivo', initials: 'MA', departmentId: 'D01', level: 3 },
  { id: 'finance', name: 'Helena Duarte', role: 'Diretora financeira', initials: 'HD', departmentId: 'D02', level: 3 },
  { id: 'manager', name: 'Fernanda Costa', role: 'Gerente de unidade', initials: 'FC', departmentId: 'D04', level: 2 },
  { id: 'purchasing', name: 'Lucas Ferreira', role: 'Analista de compras', initials: 'LF', departmentId: 'D03', level: 1 },
  { id: 'maintenance', name: 'Rafael Mendes', role: 'Supervisor de manutenção', initials: 'RM', departmentId: 'D06', level: 2 },
  { id: 'employee', name: 'Camila Nogueira', role: 'Colaboradora operacional', initials: 'CN', departmentId: 'D04', level: 0 },
];
const firstNames = ['Ana', 'Bruno', 'Camila', 'Daniel', 'Elisa', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Mateus', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Thiago', 'Valéria', 'Victor'];
const surnames = ['Almeida', 'Barbosa', 'Campos', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Lima', 'Mendes', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira', 'Viana', 'Azevedo', 'Moreira', 'Castro'];
const pad = (value, size = 4) => String(value).padStart(size, '0');
// Integer allocation preserves exact annual totals, including rounding remainders.
function allocate(total, weights) {
  const weight = weights.reduce((a, b) => a + b, 0);
  const values = weights.map(value => Math.floor(total * value / weight));
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
  return values;
}

export function createSeed(referenceDate = todayISO()) {
  const year = Number(referenceDate.slice(0, 4));
  const locations = [
    ['Porto Sereno', 'BA'], ['Vale do Sol', 'SP'], ['Nova Esperança do Sul', 'MG'], ['Campo das Águas', 'PR'],
    ['Vila do Horizonte', 'SC'], ['Santa Clara do Norte', 'PE'], ['Jardim das Palmeiras', 'GO'], ['Lagoa Serena', 'CE'],
    ['Monte Azul do Leste', 'RJ'], ['Boa Vista dos Campos', 'RS'], ['Serra Dourada do Oeste', 'ES'], ['Rio das Flores do Norte', 'AM'],
    ['Porto Sereno', 'BA'], ['Vale do Sol', 'SP'],
  ];
  const units = locations.map(([city, state], index) => ({
    id: `U${pad(index + 1, 2)}`, name: index === 12 ? 'Sede administrativa' : index === 13 ? 'Centro de distribuição' : `Unidade ${pad(index + 1, 2)}`,
    city, state, type: index === 12 ? 'Sede' : index === 13 ? 'Distribuição' : 'Operacional',
    managerId: `COL-${pad(index + 29)}`, budget: index === 12 ? 950000000 : index === 13 ? 1250000000 : 1000000000,
    status: 'Ativa',
  }));
  const departments = ['Diretoria', 'Financeiro', 'Compras', 'Operações', 'Logística', 'Manutenção', 'Recursos Humanos', 'Tecnologia', 'Administrativo', 'Comercial'].map((name, index) => ({ id: `D${pad(index + 1, 2)}`, name, managerId: `COL-${pad(index + 15)}` }));
  const employees = Array.from({ length: 1480 }, (_, index) => {
    const departmentId = index < 6 ? STAFF[index].departmentId : index >= 14 && index < 24 ? departments[index - 14].id : index < 14 ? 'D04' : departments[(index * 7 + 3) % departments.length].id;
    const management = index < 88 && index !== 3 && index !== 5;
    return { id: `COL-${pad(index + 1)}`, name: index < 6 ? STAFF[index].name : `${firstNames[index % 20]} ${surnames[Math.floor(index / 20) % 20]} ${surnames[(index * 3 + Math.floor(index / 400)) % 20]}`,
      departmentId, unitId: units[index % 14].id, role: index < 6 ? STAFF[index].role : index >= 28 && index < 42 ? 'Gerente de unidade' : management ? 'Supervisor' : departmentId === 'D04' ? 'Técnico de operações' : 'Analista',
      email: `colaborador.${pad(index + 1)}@miridian.example`, status: index % 43 === 42 ? 'Afastado' : 'Ativo', profile: management ? 'Gestão' : 'Operacional' };
  });
  const supplierRoots = ['Ápice', 'Vereda', 'Orbe', 'Nascente', 'Prisma', 'Terravista', 'Arcos', 'Altiva', 'Senda', 'Alvorada', 'Pórtico', 'Cedro'];
  const supplierCategories = ['Materiais industriais', 'Tecnologia', 'Serviços técnicos', 'Logística', 'Infraestrutura', 'Suprimentos'];
  const suppliers = Array.from({ length: 240 }, (_, index) => ({ id: `FOR-${pad(index + 1)}`, name: `${supplierRoots[index % 12]} ${supplierCategories[Math.floor(index / 12) % 6]} ${pad(Math.floor(index / 72) + 1, 2)}`,
    category: supplierCategories[Math.floor(index / 12) % 6], city: locations[index % 14][0], state: locations[index % 14][1], contact: `${firstNames[index % 20]} ${surnames[(index * 3) % 20]}`,
    email: `contato.${index + 1}@fornecedor.example`, status: index % 19 === 18 ? 'Inativo' : 'Ativo' }));
  const contracts = Array.from({ length: 430 }, (_, index) => ({ id: `CTR-${year}-${pad(index + 1)}`, title: ['Fornecimento de insumos operacionais', 'Manutenção preventiva de equipamentos', 'Serviços de transporte e distribuição', 'Suporte de infraestrutura e tecnologia', 'Serviços de facilities', 'Aquisição de materiais administrativos'][index % 6],
    supplierId: suppliers[index % 240].id, unitId: units[index % 14].id, departmentId: departments[(index * 3 + 3) % 10].id, responsibleId: employees[index % 86].id,
    amount: (18000 + (index * 7919) % 460000) * 100, start: addDays(referenceDate, -180 - index % 360), end: addDays(referenceDate, (index * 11) % 640 - 45), status: index % 29 === 28 ? 'Suspenso' : 'Vigente' }));
  const assetNames = ['Estação de trabalho', 'Empilhadeira elétrica', 'Impressora multifuncional', 'Compressor industrial', 'Coletor de dados', 'Sistema de climatização', 'Esteira transportadora', 'Notebook corporativo'];
  const assetStatuses = ['Em utilização', 'Em utilização', 'Disponível', 'Em utilização', 'Em manutenção', 'Em utilização', 'Inativo', 'Em utilização', 'Em utilização', 'Baixado'];
  const assets = Array.from({ length: 3800 }, (_, index) => ({ id: `EQP-${pad(index + 1, 5)}`, name: assetNames[index % 8], category: index % 8 === 0 || index % 8 === 7 ? 'Tecnologia' : 'Equipamentos', unitId: units[index % 14].id,
    departmentId: departments[(index + 3) % 10].id, responsibleId: employees[index % 1480].id, acquired: addDays(referenceDate, -360 - index % 1000), amount: (3200 + (index * 433) % 92000) * 100, condition: index % 9 === 0 ? 'Regular' : 'Bom', status: assetStatuses[index % 10] }));
  const statusWeights = ['Concluída', 'Concluída', 'Concluída', 'Aberta', 'Em análise', 'Aguardando aprovação', 'Em execução', 'Concluída', 'Aprovada', 'Aguardando aprovação', 'Rejeitada', 'Devolvida'];
  const requests = Array.from({ length: 2400 }, (_, index) => {
    const created = addDays(referenceDate, -Math.floor((2399 - index) * 330 / 2400));
    const status = statusWeights[index % 12];
    return { id: `SOL-${year}-${pad(index + 1)}`, ...seedRequestDetails(index, units[index % 14].name), unitId: units[index % 14].id, departmentId: departments[(index + 3) % 10].id,
      requesterId: employees[(index * 13) % 1480].id, responsibleId: employees[index % 86].id, amount: (750 + (index * 137) % 38000) * 100,
      priority: ['Normal', 'Normal', 'Alta', 'Normal', 'Baixa', 'Urgente'][index % 6], status, created, due: addDays(created, 7 + index % 23),
      ...(status === 'Concluída' ? { completed: addDays(created, Math.min(3 + index % 12, Math.max(0, Math.floor((2399 - index) * 330 / 2400)))) } : {}),
      ...(status === 'Aprovada' || status === 'Em execução' || status === 'Concluída' ? { authorized: (750 + (index * 137) % 38000) * 100 } : {}),
    };
  });
  const activities = requests.filter(row => ['Aprovada', 'Em execução', 'Concluída'].includes(row.status)).map((row, index) => ({ id: `ATV-${pad(index + 1)}`, requestId: row.id, responsibleId: row.responsibleId, status: row.status === 'Concluída' ? 'Concluído' : row.status === 'Aprovada' ? 'Aguardando início' : ['Em andamento', 'Aguardando recurso', 'Em validação'][index % 3] }));
  const approvals = requests.filter(row => row.authorized).map((row, index) => ({ id: `APR-${pad(index + 1)}`, requestId: row.id, amount: row.authorized, profileId: row.amount > 2000000 ? 'finance' : 'manager', date: row.created, status: 'Aprovada' }));
  const costCenters = departments.map(row => ({ id: `CC-${row.id}`, name: row.name, departmentId: row.id }));
  const transactions = [];
  const revenueWeights = [112, 104, 98, 93, 88, 83, 78, 73, 69, 64, 59, 54, 0, 25];
  const expenseWeights = [100, 95, 91, 88, 85, 81, 78, 74, 72, 68, 64, 60, 82, 105];
  const expenseDepartments = ['D04', 'D05', 'D09', 'D06', 'D08', 'D07', 'D10'];
  for (let y = year - 1; y <= year; y++) {
    const annualRevenue = y === year ? 18500000000 : 17066420664;
    const annualExpense = y === year ? 12800000000 : 12403100775;
    const seasonality = [92, 88, 99, 96, 101, 100, 104, 106, 102, 108, 103, 101];
    const monthRevenue = allocate(annualRevenue, seasonality);
    const monthExpense = allocate(annualExpense, seasonality.map((value, i) => value + (i % 3) * 2));
    for (let month = 0; month < 12; month++) {
      const revenues = allocate(monthRevenue[month], revenueWeights);
      const expenses = allocate(monthExpense[month], expenseWeights);
      units.forEach((unit, u) => {
        const pieces = allocate(revenues[u], [26, 24, 28, 22]);
        const costs = allocate(expenses[u], [35, 19, 15, 11, 8, 7, 5]);
        const push = (amount, type, part, departmentId) => {
          if (!amount) return;
          const day = 1 + ((u * 5 + part * 7 + month * 3) % 28);
          const date = `${y}-${pad(month + 1, 2)}-${pad(day, 2)}`;
          const id = `MOV-${y}-${pad(transactions.length + 1, 5)}`;
          transactions.push({ id, description: type === 'Receita' ? `Receita operacional · lote ${part + 1}` : `${departments.find(row => row.id === departmentId).name} · competência ${pad(month + 1, 2)}/${y}`,
            type, category: type === 'Receita' ? 'Operacional' : 'Custeio', amount, unitId: unit.id, departmentId, costCenterId: `CC-${departmentId}`, date, status: date <= referenceDate ? 'Registrado' : 'Previsto' });
        };
        pieces.forEach((amount, part) => push(amount, 'Receita', part, 'D10'));
        costs.forEach((amount, part) => push(amount, 'Despesa', part, expenseDepartments[part]));
      });
    }
  }
  // Split existing expense batches to preserve the exact annual financial totals.
  requests.filter(row => row.status === 'Concluída').slice(0, 160).forEach(row => {
    const source = transactions.find(t => t.type === 'Despesa' && !t.requestId && t.unitId === row.unitId && t.departmentId === row.departmentId && t.date >= row.completed && t.date <= referenceDate && t.amount >= row.amount * 2);
    if (!source) return;
    source.amount -= row.amount;
    transactions.push({ ...source, id: `MOV-${row.id}`, description: row.title, amount: row.amount, requestId: row.id });
  });
  const approved = requests.findLast(row => row.status === 'Aprovada');
  const executing = requests.findLast(row => row.status === 'Em execução');
  const audit = [
    { id: 'AUD-0001', time: `${referenceDate}T10:42:00-03:00`, profileId: 'finance', entity: 'requests', entityId: approved.id, action: 'Aprovação', description: `Autorização registrada para ${approved.id}.`, unitId: approved.unitId },
    { id: 'AUD-0002', time: `${referenceDate}T10:28:00-03:00`, profileId: 'manager', entity: 'assets', entityId: assets[380].id, action: 'Transferência', description: `${assets[380].id} alocado à ${units.find(u => u.id === assets[380].unitId).name}.`, unitId: assets[380].unitId },
    { id: 'AUD-0003', time: `${referenceDate}T09:56:00-03:00`, profileId: 'purchasing', entity: 'contracts', entityId: contracts[12].id, action: 'Atualização', description: `Dados de acompanhamento de ${contracts[12].id} atualizados.`, unitId: contracts[12].unitId },
    { id: 'AUD-0004', time: `${referenceDate}T09:15:00-03:00`, profileId: 'maintenance', entity: 'requests', entityId: executing.id, action: 'Execução', description: `Andamento de ${executing.id} registrado.`, unitId: executing.unitId },
  ];
  // Audit timestamps always precede now, including when the application is initialized early.
  audit.forEach((entry, i) => { entry.time = new Date(new Date(`${referenceDate}T00:00:00-03:00`).getTime() - (i + 1) * 17 * 60000).toISOString(); });
  return { version: SCHEMA_VERSION, requestContentVersion: REQUEST_CONTENT_VERSION, seedDate: referenceDate, company: { name: 'Grupo Miridian', annualRevenue: 18500000000, annualExpenses: 12800000000 }, units, departments, employees, suppliers, contracts, assets, requests, activities, approvals, costCenters, transactions, audit, notifications: [], preferences: { theme: 'light', unitId: 'all', period: 'year', density: 'comfortable', notifications: true, collapsed: false } };
}
