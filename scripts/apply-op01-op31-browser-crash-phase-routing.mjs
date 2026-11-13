import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label} anchor`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ambiguous ${label} anchor`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const FIXTURE = 'tests/browser/op01-op31-browser-crash-resume.ts';
let fixture = await readFile(FIXTURE, 'utf8');
if (!fixture.includes("const requestedPhase = Number(new URLSearchParams(window.location.search).get('phase'));")) {
  fixture = replaceOnce(
    fixture,
    `const retainedPhase = window.localStorage.getItem(PHASE_KEY);\nconst phase = retainedPhase ? 2 : 1;\n`,
    `const retainedPhase = window.localStorage.getItem(PHASE_KEY);\nconst requestedPhase = Number(new URLSearchParams(window.location.search).get('phase'));\nconst phase = requestedPhase === 2 ? 2 : 1;\n`,
    'explicit browser crash phase',
  );

  fixture = replaceOnce(
    fixture,
    `async function phaseTwo(evidence: PhaseOneEvidence): Promise<void> {\n  status('phase 2: restoring product session after hard Chrome termination');\n  assert(window.localStorage.getItem(PAGEHIDE_KEY) === null, 'pagehide fired before the hard crash');\n  await import('../../src/main.ts');\n\n  const store = new BrowserDurableSessionStore(window.localStorage);\n`,
    `async function phaseTwo(evidence: PhaseOneEvidence): Promise<void> {\n  status('phase 2: restoring product session after hard Chrome termination');\n  assert(window.localStorage.getItem(PAGEHIDE_KEY) === null, 'pagehide fired before the hard crash');\n  const store = new BrowserDurableSessionStore(window.localStorage);\n  const retainedBeforeRestore = store.load(Date.now(), GAME_CODE);\n  assert(\n    retainedBeforeRestore.status === 'ready',\n    \`hard-crash durable checkpoint is unavailable before restore: \${retainedBeforeRestore.status}\`,\n  );\n  assert(\n    retainedBeforeRestore.checkpoint.runtime.pending?.sequence === 2,\n    'hard-crash durable checkpoint lost its pending runtime request before restore',\n  );\n  assert(\n    retainedBeforeRestore.checkpoint.agent.host.session?.pendingReturn !== null,\n    'hard-crash durable checkpoint lost its pending Agent return before restore',\n  );\n  await import('../../src/main.ts');\n\n`,
    'phase-two retained checkpoint assertion',
  );

  fixture = replaceOnce(
    fixture,
    `async function main(): Promise<void> {\n`,
    `async function loadPhaseOneEvidence(): Promise<PhaseOneEvidence> {\n  if (retainedPhase) return JSON.parse(retainedPhase) as PhaseOneEvidence;\n  const response = await fetch('/__op01-op31-browser-crash-resume-phase-one-evidence');\n  if (!response.ok) {\n    throw new Error(\`phase-one evidence endpoint returned \${response.status}\`);\n  }\n  return await response.json() as PhaseOneEvidence;\n}\n\nasync function main(): Promise<void> {\n`,
    'phase-one evidence loader',
  );

  fixture = replaceOnce(
    fixture,
    `    else await phaseTwo(JSON.parse(retainedPhase!) as PhaseOneEvidence);\n`,
    `    else await phaseTwo(await loadPhaseOneEvidence());\n`,
    'phase-two server evidence route',
  );

  await writeFile(FIXTURE, fixture);
}

const QUALIFIER = 'scripts/qualify-op01-op31-browser-crash-resume.mjs';
let qualifier = await readFile(QUALIFIER, 'utf8');
if (!qualifier.includes('function pageUrl(phase)')) {
  qualifier = replaceOnce(
    qualifier,
    `const PAGE_URL = \`http://\${HOST}:\${PORT}/tests/browser/op01-op31-browser-crash-resume.html?game=SMLP&level=1\`;\n`,
    `const PAGE_PATH = '/tests/browser/op01-op31-browser-crash-resume.html';\n\nfunction pageUrl(phase) {\n  return \`http://\${HOST}:\${PORT}\${PAGE_PATH}?phase=\${phase}&game=SMLP&level=1\`;\n}\n`,
    'phase-specific browser URL',
  );

  qualifier = replaceOnce(
    qualifier,
    `          const target = request.url?.split('?', 1)[0];\n          if (target === '/__op01-op31-browser-crash-resume-phase-two-bootstrap'\n`,
    `          const target = request.url?.split('?', 1)[0];\n          if (\n            target === '/__op01-op31-browser-crash-resume-phase-one-evidence'\n            && request.method === 'GET'\n          ) {\n            if (!phaseOneEvidence) {\n              response.statusCode = 404;\n              response.end();\n              return undefined;\n            }\n            response.statusCode = 200;\n            response.setHeader('content-type', 'application/json');\n            response.end(JSON.stringify(phaseOneEvidence));\n            return undefined;\n          }\n          if (target === '/__op01-op31-browser-crash-resume-phase-two-bootstrap'\n`,
    'phase-one evidence endpoint',
  );

  qualifier = replaceOnce(
    qualifier,
    `    firstChrome = launchChrome(chromeExecutable, profile, 'phase-one Chrome', PAGE_URL);\n`,
    `    firstChrome = launchChrome(chromeExecutable, profile, 'phase-one Chrome', pageUrl(1));\n`,
    'phase-one Chrome routing',
  );

  qualifier = replaceOnce(
    qualifier,
    `    secondChrome = launchChrome(chromeExecutable, profile, 'phase-two Chrome', BOOTSTRAP_URL);\n    let secondPayload;\n    try {\n      secondPayload = await withTimeout(\n        phaseTwo.promise,\n        'phase-two crash recovery',\n        240_000,\n      );\n`,
    `    secondChrome = launchChrome(chromeExecutable, profile, 'phase-two Chrome', pageUrl(2));\n    let secondPayload;\n    try {\n      secondPayload = await withTimeout(\n        Promise.race([\n          phaseTwo.promise,\n          new Promise((_, reject) => {\n            secondChrome.child.once('exit', (code, signal) => {\n              reject(new Error(\n                \`phase-two Chrome exited before reporting: code=\${code} signal=\${signal}\\n\${secondChrome.stderr().slice(-6000)}\`,\n              ));\n            });\n          }),\n        ]),\n        'phase-two crash recovery',\n        240_000,\n      );\n`,
    'phase-two Chrome routing and exit diagnostics',
  );

  qualifier = qualifier.replace(
    'phaseIdentityInjectedByBootstrap: true,',
    'phaseIdentityInjectedByBootstrap: false,\n        phaseIdentitySelectedByUrl: true,',
  );

  await writeFile(QUALIFIER, qualifier);
}

console.log('Applied explicit phase routing to the hard-crash Chrome fixture');
