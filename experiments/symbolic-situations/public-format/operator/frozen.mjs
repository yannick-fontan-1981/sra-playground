import { execFileSync } from 'node:child_process';
import { bundle, fingerprints } from '../../ressource/qualification/solveur.mjs';

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
}

export function consumer({ solveur, sha, entree, depot, dep = [] }) {
  if (solveur) {
    if (sha || entree || depot || dep.length) throw new Error('Choisir le fichier local ou le commit figé');
    const files = bundle(solveur);
    return { files, program: 'solveur.mjs', sha: null, hashes: fingerprints(files) };
  }
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !entree) throw new Error('Un SHA Git complet et --entree sont requis');
  const repo = depot ?? '.';
  if (git(repo, ['rev-parse', '--verify', sha + '^{commit}']).toString().trim() !== sha) throw new Error('SHA de commit incohérent');
  const files = new Map();
  for (const path of new Set([entree, ...dep])) {
    if (!/^[\w@.-]+(?:\/[\w@.-]+)*$/.test(path) || path.split('/').some(p => ['.', '..', '.git'].includes(p.toLowerCase()))) {
      throw new Error('Chemin relatif Git attendu');
    }
    const row = git(repo, ['ls-tree', sha, '--', path]).toString().trimEnd();
    if (!/^100(?:644|755) blob /.test(row) || row.split('\t')[1] !== path) throw new Error('Fichier source absent du gel : ' + path);
    files.set('programme/' + path, git(repo, ['cat-file', 'blob', sha + ':' + path]));
  }
  return { files, program: 'programme/' + entree, sha, hashes: fingerprints(files) };
}
