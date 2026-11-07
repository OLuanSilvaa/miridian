export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
export const number = value => new Intl.NumberFormat('pt-BR').format(value || 0);
export const percent = (value, digits = 1) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value || 0)}%`;
export const date = value => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '—';
export const dateTime = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }).format(new Date(value));
export const shortMoney = cents => {
  const value = cents / 100;
  return Math.abs(value) >= 1e6 ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1e6)} mi` : Math.abs(value) >= 1e3 ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value / 1e3)} mil` : number(value);
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('');
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (iso, days) => {
  const value = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const sum = (rows, field = 'amount') => rows.reduce((total, row) => total + (row[field] || 0), 0);
export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
