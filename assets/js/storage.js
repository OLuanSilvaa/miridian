// Keep the original storage identifiers so the Miridian rename preserves local data.
export const STORAGE_KEY = 'meridian:database:v1';

// Columnar serialization avoids repeating field names in thousands of records.
// Public imports/exports still use the readable, complete database schema.
export function packDatabase(data) {
  const metadata = {}, tables = {};
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) { metadata[key] = value; continue; }
    const columns = [...new Set(value.flatMap(row => Object.keys(row)))];
    tables[key] = { columns, rows: value.map(row => columns.map(field => row[field] ?? null)) };
  }
  return { format: 'meridian-columnar-1', metadata, tables };
}
export function unpackDatabase(packed) {
  if (packed?.format !== 'meridian-columnar-1') return packed;
  const data = { ...packed.metadata };
  for (const [key, table] of Object.entries(packed.tables)) {
    if (!Array.isArray(table.columns) || !Array.isArray(table.rows)) throw new Error('Formato de armazenamento inválido.');
    Object.defineProperty(data, key, { enumerable: true, configurable: true, writable: true, value: table.rows.map(values => Object.fromEntries(table.columns.flatMap((field, i) => values[i] === null || values[i] === undefined ? [] : [[field, values[i]]]))) });
  }
  return data;
}

export function readLocal(storage) {
  let raw = null;
  try {
    raw = (storage || globalThis.localStorage).getItem(STORAGE_KEY);
    return { data: raw ? unpackDatabase(JSON.parse(raw)) : null, raw, error: null };
  } catch (error) {
    return { data: null, raw, error: `Não foi possível ler os dados locais: ${error.message}` };
  }
}

export function writeLocal(data, storage) {
  try {
    (storage || globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(packDatabase(data)));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.name === 'QuotaExceededError' ? 'O armazenamento do navegador está cheio. Exporte um backup antes de liberar espaço.' : 'O navegador impediu o salvamento. As alterações desta sessão ainda estão disponíveis para exportação.' };
  }
}
