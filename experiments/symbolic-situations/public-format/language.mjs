// JSON expressions and exact public-line citations, shared by both front ends.
export const eq = (ref, value) => ({ eq: [ref, value] });
export const all = (...items) => ({ all: items });
export const any = (...items) => ({ any: items });
export const not = expr => ({ not: expr });
export const set = (ref, value) => ({ set: [ref, value] });

export function distinct(ids) {
  if (new Set(ids).size !== ids.length) throw new Error('Identifiants publics en conflit');
}

export class Page {
  constructor(text) {
    this.lines = text.replaceAll('\r\n', '\n').split('\n');
    this.used = new Set();
    this.msg = { format: 'sra.public/1', observations: [], domains: [], commands: [], rules: [], sources: {} };
  }

  many(pattern) {
    const found = [];
    for (const [i, line] of this.lines.entries()) {
      const match = pattern.exec(line);
      if (match) {
        found.push({ n: i + 1, args: match.slice(1) });
        this.used.add(i + 1);
      }
    }
    return found;
  }

  one(pattern, required = true) {
    const found = this.many(pattern);
    if (found.length > 1 || (required && !found.length)) throw new Error('Clause publique manquante ou répétée : ' + pattern);
    return found[0];
  }

  cite(rows) {
    const numbers = [...new Set(rows.map(row => row.n))].sort((a, b) => a - b);
    for (const n of numbers) this.msg.sources[n] = this.lines[n - 1];
    return numbers;
  }

  observe(ref, value, ...rows) {
    const fact = value === undefined ? { ref, status: 'unknown' } : { ref, status: 'known', value };
    this.msg.observations.push({ ...fact, source: this.cite(rows) });
  }

  command(tokens, ...rows) {
    this.msg.commands.push({ command: tokens, source: this.cite(rows) });
    return tokens;
  }

  rule(command, clause, ...rows) {
    this.msg.rules.push({ command, ...clause, source: this.cite(rows) });
  }

  finish() {
    for (const [i, line] of this.lines.entries()) {
      if (line.trim() && !/^# |^\*\*[^*]+\*\*$/.test(line) && !this.used.has(i + 1)) {
        throw new Error('Clause publique non reconnue, ligne ' + (i + 1));
      }
    }
    return this.msg;
  }
}
