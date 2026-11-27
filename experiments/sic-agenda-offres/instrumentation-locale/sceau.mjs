import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const seal = event => Object.freeze({ event, sha256: digest(event) });
