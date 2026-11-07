export const ROUTES = [
  { id: 'dashboard', path: 'visao-geral', title: 'Visão geral', icon: 'grid', group: 'workspace', module: 'dashboard', description: 'Indicadores consolidados e acompanhamento das operações empresariais.' },
  { id: 'requests', path: 'solicitacoes', title: 'Solicitações', icon: 'request', group: 'workspace', module: 'screens', description: 'Acompanhe as necessidades internas e os pedidos das unidades.' },
  { id: 'approvals', path: 'aprovacoes', title: 'Aprovações', icon: 'approval', group: 'workspace', module: 'screens', description: 'Consulte a fila de autorizações e as alçadas responsáveis.' },
  { id: 'activities', path: 'operacoes', title: 'Operações', icon: 'layers', group: 'workspace', module: 'screens', description: 'Acompanhe as atividades e a execução das solicitações autorizadas.' },
  { id: 'units', path: 'unidades', title: 'Unidades', icon: 'building', group: 'workspace', module: 'screens', description: 'Consulte o desempenho e a estrutura das unidades do grupo.' },
  { id: 'assets', path: 'recursos', title: 'Recursos e ativos', icon: 'box', group: 'workspace', module: 'screens', description: 'Visualize o patrimônio, os responsáveis e a disponibilidade dos equipamentos.' },
  { id: 'transactions', path: 'financeiro', title: 'Financeiro', icon: 'wallet', group: 'workspace', module: 'screens', description: 'Acompanhe receitas, despesas, compromissos e orçamento disponível.' },
  { id: 'suppliers', path: 'fornecedores', title: 'Fornecedores', icon: 'truck', group: 'workspace', module: 'screens', description: 'Consulte parceiros, categorias de fornecimento e contratos associados.' },
  { id: 'contracts', path: 'contratos', title: 'Contratos', icon: 'contract', group: 'workspace', module: 'screens', description: 'Acompanhe valores contratados, vigências e próximos vencimentos.' },
  { id: 'reports', path: 'relatorios', title: 'Relatórios', icon: 'chart', group: 'workspace', module: 'screens', description: 'Analise os resultados e exporte as informações da sua operação.' },
  { id: 'employees', path: 'colaboradores', title: 'Colaboradores', icon: 'users', group: 'admin', module: 'screens', description: 'Encontre as pessoas, os cargos e os vínculos com as unidades.' },
  { id: 'departments', path: 'departamentos', title: 'Departamentos', icon: 'network', group: 'admin', module: 'screens', description: 'Consulte equipes, responsáveis e a distribuição dos recursos.' },
  { id: 'audit', path: 'auditoria', title: 'Auditoria', icon: 'history', group: 'admin', module: 'screens', description: 'Acompanhe o histórico de alterações e os responsáveis por cada registro.' },
  { id: 'settings', path: 'configuracoes', title: 'Configurações', icon: 'settings', group: 'admin', module: 'screens', description: 'Gerencie suas preferências e os dados salvos neste navegador.' },
];
const byId = new Map(ROUTES.map(route => [route.id, route]));
const byPath = new Map(ROUTES.map(route => [route.path, route]));
const filters = { requests: ['open', 'pending', 'running', 'completed', 'overdue', 'stale'], contracts: ['expiring'], assets: ['maintenance'] };

export function routeHref(id, params = {}) {
  const route = byId.get(id) || ROUTES[0];
  const query = new URLSearchParams();
  for (const key of ['filter', 'status', 'department', 'query']) {
    const value = String(params[key] || '').trim().slice(0, 300);
    if (!value || (key === 'filter' && !filters[route.id]?.includes(value))) continue;
    query.set(key, value);
  }
  return `#/${route.path}${query.size ? `?${query}` : ''}`;
}

export function resolveRoute(hash = '') {
  const [path, search = ''] = String(hash).replace(/^#\/?/, '').split('?');
  const route = byPath.get(path) || byId.get(path) || ROUTES[0];
  const params = Object.fromEntries(new URLSearchParams(search));
  const canonical = routeHref(route.id, params);
  return { ...route, hash: canonical, params: Object.fromEntries(new URLSearchParams(canonical.split('?')[1] || '')) };
}

export function createHashRouter({ target = globalThis.window, onChange }) {
  let current = null;
  let started = false;
  function sync(reason, force = false) {
    const next = resolveRoute(target.location.hash);
    if (target.location.hash !== next.hash) target.history.replaceState(null, '', next.hash);
    if (force || current?.hash !== next.hash) { current = next; onChange(next, reason); }
    return current;
  }
  const browserNavigation = () => sync('history');
  return {
    get current() { return current; },
    start() {
      if (started) return current;
      started = true;
      target.addEventListener('popstate', browserNavigation);
      target.addEventListener('hashchange', browserNavigation);
      return sync('initial', true);
    },
    navigate(id, params = {}, { replace = false } = {}) {
      const hash = routeHref(id, params);
      if (target.location.hash !== hash) target.history[replace ? 'replaceState' : 'pushState'](null, '', hash);
      return sync('navigate', true);
    },
    destroy() {
      target.removeEventListener('popstate', browserNavigation);
      target.removeEventListener('hashchange', browserNavigation);
      started = false;
    },
  };
}

export function createViewLoader(loaders) {
  const cache = new Map();
  return module => {
    if (!cache.has(module)) {
      const job = Promise.resolve().then(() => loaders[module]()).catch(error => { cache.delete(module); throw error; });
      cache.set(module, job);
    }
    return cache.get(module);
  };
}
