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
    `  const store = new BrowserDurableSessionStore(window.localStorage);\n  const settled = await waitFor(() => {\n`,
    `  const store = new BrowserDurableSessionStore(window.localStorage);\n  const retainedBeforeSettlement = store.load(Date.now(), GAME_CODE);\n  assert(\n    retainedBeforeSettlement.status === 'ready',\n    \`hard-crash durable checkpoint is unavailable: \${retainedBeforeSettlement.status}\`,\n  );\n  const settled = await waitFor(() => {\n`,
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
    `function launchChrome(executable, profile, label) {\n`,
    `function launchChrome(executable, profile, label, phase) {\n`,
    'phase-aware Chrome launcher',
  );
  qualifier = replaceOnce(
    qualifier,
    `    PAGE_URL,\n`,
    `    pageUrl(phase),\n`,
    'phase-aware Chrome page',
  );
  qualifier = replaceOnce(
    qualifier,
    `  const phaseOne = deferred();\n  const phaseTwo = deferred();\n`,
    `  const phaseOne = deferred();\n  const phaseTwo = deferred();\n  let phaseOneEvidence = null;\n`,
    'server-retained phase-one evidence',
  );
  qualifier = replaceOnce(
    qualifier,
    `          const target = request.url?.split('?', 1)[0];\n          const sink = target === '/__op01-op31-browser-crash-resume-phase-one'\n`,
    `          const target = request.url?.split('?', 1)[0];\n          if (\n            target === '/__op01-op31-browser-crash-resume-phase-one-evidence'\n            && request.method === 'GET'\n          ) {\n            if (!phaseOneEvidence) {\n              response.statusCode = 404;\n              response.end();\n              return undefined;\n            }\n            response.statusCode = 200;\n            response.setHeader('content-type', 'application/json');\n            response.end(JSON.stringify(phaseOneEvidence));\n            return undefined;\n          }\n          const sink = target === '/__op01-op31-browser-crash-resume-phase-one'\n`,
    'phase-one evidence endpoint',
  );
  qualifier = replaceOnce(
    qualifier,
    `            const payload = await readJsonRequest(request);\n            sink.resolve(payload);\n`,
    `            const payload = await readJsonRequest(request);\n            if (target === '/__op01-op31-browser-crash-resume-phase-one') {\n              phaseOneEvidence = payload?.evidence ?? null;\n            }\n            sink.resolve(payload);\n`,
    'phase-one evidence retention',
  );
  qualifier = replaceOnce(
    qualifier,
    `    firstChrome = launchChrome(chromeExecutable, profile, 'phase-one Chrome');\n`,
    `    firstChrome = launchChrome(chromeExecutable, profile, 'phase-one Chrome', 1);\n`,
    'phase-one Chrome routing',
  );
  qualifier = replaceOnce(
    qualifier,
    `    secondChrome = launchChrome(chromeExecutable, profile, 'phase-two Chrome');\n    const secondPayload = await withTimeout(phaseTwo.promise, 'phase-two crash recovery');\n`,
    `    secondChrome = launchChrome(chromeExecutable, profile, 'phase-two Chrome', 2);\n    const secondPayload = await withTimeout(\n      Promise.race([\n        phaseTwo.promise,\n        new Promise((_, reject) => {\n          secondChrome.child.once('exit', (code, signal) => {\n            reject(new Error(\n              \`phase-two Chrome exited before reporting: code=\${code} signal=\${signal}\\n\${secondChrome.stderr().slice(-6000)}\`,\n            ));\n          });\n        }),\n      ]),\n      'phase-two crash recovery',\n    );\n`,
    'phase-two Chrome routing and exit diagnostics',
  );

  await writeFile(QUALIFIER, qualifier);
}

console.log('Applied explicit phase routing to the hard-crash Chrome fixture');
