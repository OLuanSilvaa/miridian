import assert from 'node:assert/strict';
import { LocalIdentity, IDENTITY_KEY, validateIdentity } from '../assets/js/identity.js';
import { MiridianStore, validateDatabase, selectDashboard } from '../assets/js/state.js';
import { auditActor } from '../assets/js/actors.js';
import { todayISO } from '../assets/js/formatters.js';
import { renderDashboard } from '../assets/js/modules/dashboard.js';
import { identityForm } from '../assets/js/modules/identity.js';
import { createSeed } from '../assets/js/seed-data.js';

const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
export const identityChecks = [
  ['Nome e sobrenome são normalizados e aceitam acentos, espaços e apóstrofos', () => {
    assert.deepEqual(validateIdentity({ firstName: '  Ana   Júlia ', lastName: "D'Ávila-Santos" }), { firstName: 'Ana Júlia', lastName: "D'Ávila-Santos" });
    assert.deepEqual(validateIdentity({ firstName: 'João', lastName: 'O’Neill' }), { firstName: 'João', lastName: 'O’Neill' });
  }],
  ['Identificação rejeita dados ausentes, HTML, números e nomes excessivos', () => {
    for (const input of [null, {}, { firstName: '', lastName: 'Silva' }, { firstName: 'Ana', lastName: ' ' }, { firstName: '<script>alert(1)</script>', lastName: 'Silva' }, { firstName: 'Ana123', lastName: 'Silva' }, { firstName: 'A'.repeat(61), lastName: 'Silva' }]) assert.throws(() => validateIdentity(input));
  }],
  ['Identificação persiste apenas os dois nomes e é reutilizada em outra sessão', () => {
    const storage = memory(); const first = new LocalIdentity(storage);
    assert.equal(first.load(), null);
    assert.equal(first.save({ firstName: 'Luan', lastName: 'Silva', extra: 'descartar' }).ok, true);
    assert.deepEqual(JSON.parse(storage.getItem(IDENTITY_KEY)), { firstName: 'Luan', lastName: 'Silva' });
    const second = new LocalIdentity(storage); second.load(); assert.equal(second.name, 'Luan Silva'); assert.equal(second.persisted, true);
  }],
  ['Nome salvo inválido é tratado sem comprometer os registros operacionais', () => {
    const storage = memory(); storage.setItem(IDENTITY_KEY, '{inválido');
    const identity = new LocalIdentity(storage); assert.equal(identity.load(), null); assert.ok(identity.error);
    identity.save({ firstName: 'Ana', lastName: 'Duarte' }); assert.equal(new LocalIdentity(storage).load().firstName, 'Ana');
  }],
  ['Falha no LocalStorage mantém o nome na sessão e informa que não foi salvo', () => {
    const identity = new LocalIdentity({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('sem espaço'); } });
    assert.equal(identity.load(), null);
    const result = identity.save({ firstName: 'Ana', lastName: 'Duarte' });
    assert.equal(result.ok, false); assert.equal(identity.name, 'Ana Duarte'); assert.equal(identity.persisted, false); assert.ok(result.error.includes('sessão'));
  }],
  ['Importar e restaurar a base preserva o nome pessoal, removendo o perfil legado', () => {
    const storage = memory(); const identity = new LocalIdentity(storage); identity.save({ firstName: 'Luan', lastName: 'Silva' });
    const store = new MiridianStore(storage); store.load();
    const backup = createSeed(); backup.preferences.profileId = 'finance'; validateDatabase(backup); store.importData(backup);
    assert.equal(store.data.preferences.profileId, undefined);
    store.restore(); assert.equal(new LocalIdentity(storage).load().lastName, 'Silva');
    assert.equal(store.data.requests.length, 2400);
  }],
  ['Novas atividades usam o nome informado e preservam a autoria após sua alteração', () => {
    const storage = memory(); const store = new MiridianStore(storage); store.load();
    const row = store.createRequest({ title: 'Revisão dos equipamentos de apoio', unitId: 'U01', departmentId: 'D06', requesterId: 'COL-0003', responsibleId: 'COL-0005', amount: 10000, due: todayISO(), priority: 'Normal' }, { name: 'Luan Silva' });
    const entry = store.data.audit.find(event => event.entityId === row.id);
    assert.equal(auditActor(entry).name, 'Luan Silva'); validateDatabase(store.data);
    const identity = new LocalIdentity(storage); identity.save({ firstName: 'Ana', lastName: 'Duarte' });
    assert.equal(auditActor(entry).name, 'Luan Silva');
    const html = renderDashboard(selectDashboard(store.data), store, { chartMode: 'month', hiddenSeries: new Set(), updated: 'agora' });
    assert.ok(html.includes('Luan Silva'));
  }],
  ['Formulário pede somente nome e sobrenome e explica o armazenamento local', () => {
    const identity = new LocalIdentity(memory());
    const html = identityForm(identity);
    assert.equal((html.match(/<input /g) || []).length, 2);
    assert.ok(html.includes('melhorar sua experiência')); assert.ok(html.includes('armazenados localmente'));
    assert.ok(!/senha|email|data-profile|demonstrativ/i.test(html));
  }],
];
