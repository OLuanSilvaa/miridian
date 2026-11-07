export function createTestBrowser(initialHash = '') {
  const events = new Map();
  const entries = [initialHash];
  let index = 0;
  const dispatch = (name, event = {}) => { for (const handler of events.get(name) || []) handler(event); };
  const browser = {
    location: { get hash() { return entries[index]; }, pathname: '/portfolio/sistema/index.html', reload() { throw new Error('Recarregamento completo não é permitido nesta navegação.'); } },
    history: {
      pushState(_state, _title, hash) { entries.splice(index + 1, entries.length, String(hash)); index++; },
      replaceState(_state, _title, hash) { entries[index] = String(hash); },
      back() { if (index > 0) { index--; dispatch('popstate'); dispatch('hashchange'); } },
      forward() { if (index < entries.length - 1) { index++; dispatch('popstate'); dispatch('hashchange'); } },
      get length() { return entries.length; },
    },
    addEventListener(name, handler) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(handler); },
    removeEventListener(name, handler) { events.get(name)?.delete(handler); },
    dispatch,
    scrollTo() {},
    print() {},
  };
  return browser;
}
