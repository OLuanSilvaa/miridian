export const IDENTITY_KEY = 'miridian:visitor:v1';

export function validateIdentity(input) {
  const clean = (value, label) => {
    if (typeof value !== 'string') throw new Error(`Informe seu ${label}.`);
    const name = value.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60 || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) throw new Error(`Informe um ${label} válido, com até 60 caracteres.`);
    return name;
  };
  return { firstName: clean(input?.firstName, 'nome'), lastName: clean(input?.lastName, 'sobrenome') };
}

export class LocalIdentity {
  constructor(storage) { this.storage = storage; this.current = null; this.persisted = false; this.error = null; }
  get name() { return this.current ? `${this.current.firstName} ${this.current.lastName}` : 'Seu nome'; }
  load() {
    this.current = null; this.persisted = false; this.error = null;
    try {
      const raw = (this.storage || globalThis.localStorage).getItem(IDENTITY_KEY);
      if (raw) { this.current = validateIdentity(JSON.parse(raw)); this.persisted = true; }
    } catch {
      this.error = 'Não foi possível recuperar seu nome salvo. Informe-o novamente para continuar.';
    }
    return this.current;
  }
  save(input) {
    this.current = validateIdentity(input);
    this.persisted = false; this.error = null;
    try {
      (this.storage || globalThis.localStorage).setItem(IDENTITY_KEY, JSON.stringify(this.current));
      this.persisted = true;
    } catch {
      this.error = 'Não foi possível salvar seu nome neste navegador. Ele será usado apenas nesta sessão.';
    }
    return { ok: this.persisted, error: this.error };
  }
}
