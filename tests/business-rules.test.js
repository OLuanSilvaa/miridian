import test from 'node:test';
import { checks } from './checks.js';
for (const [name, run] of checks) test(name, run);
