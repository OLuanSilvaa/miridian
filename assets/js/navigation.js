import { icon } from './components.js';
import { escapeHTML as e } from './formatters.js';
import { ROUTES, routeHref } from './router.js';

export const NAV_ITEMS = ROUTES.filter(route => route.group === 'workspace').map(route => [route.id, route.title, route.icon]);
const ADMIN = ROUTES.filter(route => route.group === 'admin').map(route => [route.id, route.title, route.icon]);
export function sidebar(pending, activeId = 'dashboard') {
  const row = ([id, title, image]) => `<a href="${routeHref(id)}" class="nav-item ${id === activeId ? 'active' : ''}" data-nav="${id}" ${id === activeId ? 'aria-current="page"' : ''} title="${e(title)}">${icon(image, 19)}<span>${e(title)}</span>${id === 'approvals' ? `<b class="nav-count" id="pending-count">${pending}</b>` : ''}</a>`;
  return `<aside class="sidebar" aria-label="Navegação principal"><a href="${routeHref('dashboard')}" data-nav="dashboard" class="brand" aria-label="Miridian — Visão geral"><span class="brand-mark"><i></i><i></i><i></i></span><span class="brand-word">miridian<span>GESTÃO EMPRESARIAL</span></span></a><div class="workspace-label"><span class="workspace-icon">M</span><div><strong>Grupo Miridian</strong><small>Workspace corporativo</small></div>${icon('down', 14)}</div><div class="sidebar-scroll"><span class="nav-section-label">WORKSPACE</span><nav>${NAV_ITEMS.map(row).join('')}</nav><span class="nav-section-label admin-label">ADMINISTRAÇÃO</span><nav>${ADMIN.map(row).join('')}</nav></div><div class="sidebar-bottom"><button class="collapse-button" id="collapse-sidebar" aria-label="Recolher menu" title="Recolher ou expandir menu">${icon('panel', 17)}<span>Recolher menu</span></button></div></aside><button class="mobile-backdrop" id="mobile-backdrop" aria-label="Fechar menu"></button>`;
}
