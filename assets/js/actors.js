import { STAFF } from './seed-data.js';

export function auditActor(entry) {
  if (entry.actorName) return { name: entry.actorName, role: 'Usuário' };
  const employee = STAFF.find(row => row.id === entry.profileId);
  return { name: employee?.name || 'Equipe Miridian', role: employee?.role || 'Equipe' };
}
