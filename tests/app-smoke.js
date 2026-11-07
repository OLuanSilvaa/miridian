import assert from 'node:assert/strict';
import { unpackDatabase, STORAGE_KEY } from '../assets/js/storage.js';
import { ROUTES } from '../assets/js/router.js';
import { createTestBrowser } from './browser-stub.js';
import { IDENTITY_KEY } from '../assets/js/identity.js';

// Tests boot and navigation with a platform stub. Visual layout, native forms,
// chart pointers and actual browser accessibility remain separate browser QA.
export async function runAppSmoke(initialHash = '') {
  const previous = Object.fromEntries(['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map(), elements = new Map(), listeners = {};
  let document;
  let navLinks = [];
  class Element {
    constructor(id = '') {
      this.id = id; this.dataset = {}; this.html = ''; this.value = ''; this.writes = 0; this.attributes = new Map();
      const classes = new Set();
      this.classList = { toggle(name, enabled) { const on = enabled === undefined ? !classes.has(name) : enabled; if (on) classes.add(name); else classes.delete(name); return on; }, remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); } };
    }
    get innerHTML() { return this.html; }
    set innerHTML(value) {
      this.html = value; this.writes++; this.dialog = null;
      if (this.id === 'app') navLinks = [...value.matchAll(/<a\b[^>]*class="nav-item[^>]*>/g)].map(match => {
        const link = new Element(); link.dataset.nav = /data-nav="([^"]+)"/.exec(match[0])[1]; return link;
      });
    }
    querySelector(selector) {
      if (selector === 'button' && this.innerHTML.includes('<button')) return new Element();
      if (selector === 'dialog' || selector === 'dialog[open]') {
        if (!this.innerHTML.includes('<dialog')) return null;
        this.dialog ||= new Element();
        return selector === 'dialog[open]' && !this.dialog.open ? null : this.dialog;
      }
      return null;
    }
    showModal() { this.open = true; }
    addEventListener() {}
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { document.activeElement = this; }
    setSelectionRange() {}
    scrollIntoView() {}
    append(child) { (this.children ||= []).push(child); }
    remove() { this.removed = true; }
    replaceChildren() { this.innerHTML = ''; this.dialog = null; }
  }
  const element = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  document = { body: new Element(), documentElement: new Element(), activeElement: null, createElement: () => new Element(), getElementById: element, addEventListener: (name, handler) => { listeners[name] = handler; }, querySelector: () => null, querySelectorAll: selector => selector === '.nav-item' ? navLinks : [] };
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const browser = createTestBrowser(initialHash);
  const click = dataset => listeners.click({ button: 0, preventDefault() {}, target: { closest: selector => selector === '[data-nav]' ? (dataset.nav ? { dataset } : null) : selector === 'button' ? { id: '', dataset, disabled: false } : null } });
  const submitIdentity = async (firstName, lastName) => {
    const fields = { firstName, lastName };
    listeners.submit({ preventDefault() {}, target: { id: 'identity-form', elements: { namedItem: name => ({ value: fields[name] }) } } });
    await application.whenReady;
  };
  let application;
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const loaded = await import('../assets/js/app.js');
    application = loaded.createApplication();
    await application.whenReady;
    const main = element('main'), shell = element('app');
    assert.equal(main.dataset.view, initialHash.includes('contratos') ? 'contracts' : 'dashboard');
    assert.ok(!/NaN|undefined|Infinity/.test(main.innerHTML));
    assert.equal(shell.writes, 1);

    assert.ok(element('overlay-root').innerHTML.includes('identity-form'));
    assert.ok(element('overlay-root').innerHTML.includes('armazenados localmente'));
    assert.ok(!element('overlay-root').innerHTML.includes('data-profile'));
    await click({ action: 'close-dialog' });
    assert.ok(element('overlay-root').innerHTML.includes('identity-form'));
    await submitIdentity('', 'Silva');
    assert.equal(storage.getItem(IDENTITY_KEY), null);
    assert.ok(element('overlay-root').innerHTML.includes('identity-form'));
    await submitIdentity('Luan', 'Silva');
    assert.deepEqual(JSON.parse(storage.getItem(IDENTITY_KEY)), { firstName: 'Luan', lastName: 'Silva' });
    assert.equal(element('overlay-root').innerHTML, '');
    assert.ok(element('visitor-button').innerHTML.includes('Luan Silva'));
    await click({ action: 'identity' });
    assert.ok(element('overlay-root').innerHTML.includes('value="Luan"'));
    await click({ action: 'close-dialog' });

    await click({ nav: 'requests' });
    assert.equal(main.dataset.view, 'requests');
    assert.ok(main.innerHTML.includes('explorer-table'));
    assert.equal(element('overlay-root').innerHTML, '');
    assert.equal(element('breadcrumb-current').textContent, 'Solicitações');
    assert.equal(document.title, 'Solicitações · Miridian');
    await listeners.change({ target: { id: 'top-unit', value: 'U03' } });
    assert.equal(unpackDatabase(JSON.parse(storage.getItem(STORAGE_KEY))).preferences.unitId, 'U03');
    assert.equal(main.dataset.view, 'requests');
    await click({ action: 'toggle-theme' });
    assert.equal(document.documentElement.dataset.theme, 'dark');
    assert.equal(main.dataset.view, 'requests');

    await listeners.change({ target: { id: 'explorer-status', value: 'Aguardando aprovação' } });
    await click({ nav: 'contracts' });
    browser.history.back(); await application.whenReady;
    assert.equal(main.dataset.view, 'requests');
    assert.ok(main.innerHTML.includes('value="Aguardando aprovação" selected'));
    browser.history.forward(); await application.whenReady;
    assert.equal(main.dataset.view, 'contracts');

    for (const route of ROUTES) {
      await click({ nav: route.id });
      assert.equal(main.dataset.view, route.id);
      assert.equal(element('breadcrumb-current').textContent, route.title);
      assert.equal(navLinks.filter(link => link.classList.contains('active')).length, 1);
      assert.equal(navLinks.find(link => link.classList.contains('active')).dataset.nav, route.id);
      assert.equal(element('overlay-root').innerHTML, '');
      assert.ok(!/NaN|undefined|Infinity/.test(main.innerHTML), route.id);
      if (route.id === 'transactions' && main.innerHTML.includes('id="compare-period-button"')) {
        await click({ action: 'toggle-period-comparison' });
        assert.ok(main.innerHTML.includes('id="month-comparison"'));
        await click({ action: 'toggle-period-comparison' });
        assert.ok(!main.innerHTML.includes('<section class="month-comparison"'));
      }
    }
    await listeners.change({ target: { id: 'density-setting', checked: true } });
    assert.equal(main.dataset.view, 'settings');
    assert.equal(unpackDatabase(JSON.parse(storage.getItem(STORAGE_KEY))).preferences.density, 'compact');
    await click({ nav: 'reports' });
    await listeners.change({ target: { id: 'report-type', value: 'finance' } });
    assert.ok(main.innerHTML.includes('Movimentações financeiras'));
    assert.equal(main.dataset.view, 'reports');

    // A delayed render from an earlier navigation must never replace the latest view.
    await Promise.all([click({ nav: 'requests' }), click({ nav: 'settings' })]);
    assert.equal(main.dataset.view, 'settings');
    browser.dispatch('storage', { key: STORAGE_KEY }); await application.whenReady;
    assert.equal(main.dataset.view, 'settings');
    await click({ nav: 'requests' });
    await click({ action: 'new-request' });
    assert.ok(element('overlay-root').innerHTML.includes('new-request-form'));
    await click({ action: 'close-dialog' });
    assert.equal(element('overlay-root').innerHTML, '');
    assert.equal(shell.writes, 1, 'O shell deve permanecer montado durante todas as trocas de tela.');
    assert.equal(element('main'), main);
    assert.equal(browser.location.pathname, '/portfolio/sistema/index.html');
    assert.ok(!browser.location.hash.includes('Luan'));

    application.destroy();
    application = loaded.createApplication();
    await application.whenReady;
    assert.equal(element('overlay-root').innerHTML, '', 'Nome salvo não deve ser solicitado novamente.');
    assert.ok(element('visitor-button').innerHTML.includes('Luan Silva'));
  } finally {
    application?.destroy();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}
