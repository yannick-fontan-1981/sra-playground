from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "docs/migration/v6-entry-point-progress.json"
CHECKER_PATH = ROOT / "scripts/check-v6-entry-point-progress.mjs"
TEST_PATH = ROOT / "tests/v6-entry-point-progress.test.ts"
DOC_PATH = ROOT / "docs/recovery/v6-entry-point-registry-reconstruction-20261113.md"
AUDITED_CANONICAL_COMMIT = "68cdddc92b4b7f0214a2d7e5a5f0ffe6c94e7216"


def add_unique(values: list[str], value: str) -> None:
    if value not in values:
        values.append(value)


def derive_summary(registry: dict) -> dict:
    operations = registry["operations"]
    capabilities = registry["capabilities"]
    historical = registry["historical76"]
    return {
        "operationRecords": len(operations),
        "capabilityRecords": len(capabilities),
        "inventoryRecords": len(operations) + len(capabilities),
        "operationsCalculationQualified": sum(
            item.get("calculationStatus") == "qualified" for item in operations
        ),
        "operationsProductActive": sum(
            item.get("productActive") is True for item in operations
        ),
        "capabilitiesFunctionalQualified": sum(
            isinstance(item.get("functionalStatus"), str)
            and item["functionalStatus"].startswith("qualified")
            for item in capabilities
        ),
        "capabilitiesProductActive": sum(
            item.get("productStatus") == "active" for item in capabilities
        ),
        "capabilitiesSupportingActive": sum(
            item.get("productStatus") == "supporting-active" for item in capabilities
        ),
        "capabilitiesOfficialPerformanceQualified": sum(
            item.get("performanceStatus") == "official-qualified"
            for item in capabilities
        ),
        "historicalMappedSlots": historical.get("mappedSlots"),
        "historicalCount": historical.get("currentCount"),
        "historicalParityClaimed": historical.get("parityClaimed") is True,
    }


def update_registry() -> None:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    registry["baseline"]["canonicalCommit"] = AUDITED_CANONICAL_COMMIT
    capabilities = {item["id"]: item for item in registry["capabilities"]}

    common = capabilities["campaign.common-owner"]
    add_unique(common["tests"], "tests/v6-browser-session-resume.test.ts")
    add_unique(
        common["proofs"],
        "docs/recovery/op01-op31-browser-session-resume-20261113.md",
    )
    add_unique(
        common["proofs"],
        "docs/recovery/op01-op31-browser-session-resume-qualified.json",
    )
    common["limits"] = [
        "Aucune priorité implicite entre propriétaires indépendants.",
        "La reprise n'est admise qu'aux frontières réglées ou physiquement envoyées et corrélées.",
    ]

    checkpoint = capabilities["runtime.campaign-checkpoint-core"]
    checkpoint["productStatus"] = "active"
    checkpoint["producers"] = [
        "BrowserCommonCampaignHost checkpoint capture",
        "CommonCampaignOwner snapshot",
        "ObservedAddressedMaterialCheckpointParticipant snapshot",
        "BrowserAgentController safe-boundary ownership",
    ]
    checkpoint["consumers"] = [
        "BrowserCommonCampaignHost restore",
        "BrowserAgentController reactivation",
        "fresh CommonCampaignOwner and FieldStock runtime",
    ]
    checkpoint["decisionEffect"] = (
        "Préserve atomiquement la campagne, le needId, l’action en attente, la "
        "déduplication et FieldStock; reprend dans un host frais, acquiert un retour "
        "déjà envoyé sans rejouer l’action ni la présentation, et rejette les "
        "observations obsolètes."
    )
    for path in [
        "src/runtime/v6-browser-campaign-checkpoint.ts",
        "src/runtime/v6-browser-common-campaign-host.ts",
        "src/runtime/v6-browser-agent-controller.ts",
    ]:
        add_unique(checkpoint["implementation"], path)
    add_unique(checkpoint["tests"], "tests/v6-browser-session-resume.test.ts")
    for path in [
        "docs/recovery/op01-op31-browser-session-resume-20261113.md",
        "docs/recovery/op01-op31-browser-session-resume-qualified.json",
    ]:
        add_unique(checkpoint["proofs"], path)
    checkpoint["limits"] = [
        "Checkpoint détenu en mémoire; aucun stockage IndexedDB, localStorage ou externe n'est qualifié.",
        "Aucune conservation pagehide, crash ou nouveau processus n'est démontrée.",
        "La reprise Chrome réelle et le coût de snapshot/restauration ne sont pas encore qualifiés.",
        "La capture automatique pendant un appel physique encore en vol reste portée par le host, pas par le contrôleur.",
    ]

    host = capabilities["runtime.browser-campaign-host"]
    add_unique(host["implementation"], "src/runtime/v6-browser-campaign-checkpoint.ts")
    add_unique(host["tests"], "tests/v6-browser-session-resume.test.ts")
    for path in [
        "docs/recovery/op01-op31-browser-session-resume-20261113.md",
        "docs/recovery/op01-op31-browser-session-resume-qualified.json",
    ]:
        add_unique(host["proofs"], path)
    host["decisionEffect"] = (
        "Impose l'ordre action → acquisition sélectionnée → observation passive → "
        "présentation → décision suivante, et restaure une frontière sûre avant toute "
        "nouvelle décision sans replay physique."
    )
    host["limits"] = [
        "La reprise est qualifiée dans les contrats TypeScript avec host frais, pas encore via une réactivation Chrome persistée.",
        "Aucun stockage durable, pagehide, crash ou nouveau processus n'est couvert.",
    ]

    controller = capabilities["runtime.browser-agent-controller"]
    add_unique(
        controller["implementation"],
        "src/runtime/v6-browser-campaign-checkpoint.ts",
    )
    add_unique(controller["tests"], "tests/v6-browser-session-resume.test.ts")
    for path in [
        "docs/recovery/op01-op31-browser-session-resume-20261113.md",
        "docs/recovery/op01-op31-browser-session-resume-qualified.json",
    ]:
        add_unique(controller["proofs"], path)
    controller["decisionEffect"] = (
        "Possède une seule campagne bornée, capture un checkpoint aux frontières sûres, "
        "restaure avant toute décision, conserve sessionId et compteur d'actions, et "
        "repart proprement si le checkpoint est obsolète."
    )
    controller["limits"] = [
        "Le checkpoint reste en mémoire et dispose() l'invalide volontairement.",
        "Aucune désactivation/réactivation Chrome avec stockage durable n'est encore démontrée.",
    ]

    registry["openGates"] = [
        {
            "id": "browser-checkpoint-persistence",
            "status": "open",
            "blocks": ["cross-page-product-continuity"],
            "reason": (
                "La reprise dans un host frais est qualifiée en TypeScript, mais aucun "
                "stockage durable, pagehide, crash, nouveau processus ou cycle Chrome "
                "réel n'est encore démontré."
            ),
        }
        if gate["id"] == "browser-session-reactivation"
        else gate
        for gate in registry["openGates"]
    ]
    registry["disposition"]["nextStep"] = (
        "persist the active browser checkpoint with an expiration policy, qualify "
        "pagehide and real Chrome reactivation without replay or needId loss, measure "
        "snapshot/restore overhead, and continue searching durable evidence for the "
        "historical 76-slot schema"
    )
    registry["summary"] = derive_summary(registry)
    REGISTRY_PATH.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"missing expected {label} block")
    return text.replace(old, new)


def update_checker() -> None:
    text = CHECKER_PATH.read_text(encoding="utf-8")
    text = replace_required(
        text,
        "  'browser-session-reactivation',",
        "  'browser-checkpoint-persistence',",
        "checker gate id",
    )
    old = """  const checkpointCore = capabilities.find(record => record.id === 'runtime.campaign-checkpoint-core');
  push(errors, checkpointCore?.functionalStatus === 'qualified-bounded', 'campaign checkpoint core must remain functionally qualified');
  push(errors, checkpointCore?.productStatus === 'available-not-main', 'campaign checkpoint core must remain outside the active browser loop until reactivation is qualified');
  push(errors, checkpointCore?.performanceStatus === 'not-measured-separately', 'campaign checkpoint core must not claim a performance qualification');

  const openGates = Array.isArray(registry.openGates) ? registry.openGates : [];
  const gateIds = uniqueIds(openGates, 'openGates', errors);
  push(errors, sameStringSet(gateIds, REQUIRED_OPEN_GATES), 'openGates must preserve all unresolved reconstruction gates');
  push(errors, openGates.find(gate => gate.id === 'browser-session-reactivation')?.status === 'open', 'browser session reactivation must remain open');
  push(errors, openGates.find(gate => gate.id === 'site-publication')?.status === 'blocked', 'Site publication must remain blocked');
"""
    new = """  const checkpointCore = capabilities.find(record => record.id === 'runtime.campaign-checkpoint-core');
  push(errors, checkpointCore?.functionalStatus === 'qualified-bounded', 'campaign checkpoint core must remain functionally qualified');
  push(errors, checkpointCore?.productStatus === 'active', 'campaign checkpoint core must remain active after browser host/controller reactivation qualification');
  push(errors, checkpointCore?.performanceStatus === 'not-measured-separately', 'campaign checkpoint core must not claim a performance qualification');
  push(errors, checkpointCore?.implementation?.includes('src/runtime/v6-browser-campaign-checkpoint.ts'), 'campaign checkpoint core must reference the browser checkpoint contract');
  push(errors, checkpointCore?.implementation?.includes('src/runtime/v6-browser-common-campaign-host.ts'), 'campaign checkpoint core must reference the browser host');
  push(errors, checkpointCore?.implementation?.includes('src/runtime/v6-browser-agent-controller.ts'), 'campaign checkpoint core must reference the Agent controller');
  push(errors, checkpointCore?.tests?.includes('tests/v6-browser-session-resume.test.ts'), 'campaign checkpoint core must retain browser session resume tests');
  push(errors, checkpointCore?.proofs?.includes('docs/recovery/op01-op31-browser-session-resume-20261113.md'), 'campaign checkpoint core must retain the browser session resume proof');
  push(errors, checkpointCore?.proofs?.includes('docs/recovery/op01-op31-browser-session-resume-qualified.json'), 'campaign checkpoint core must retain the structured browser session resume proof');

  const browserHost = capabilities.find(record => record.id === 'runtime.browser-campaign-host');
  push(errors, browserHost?.tests?.includes('tests/v6-browser-session-resume.test.ts'), 'browser campaign host must retain session resume coverage');

  const browserController = capabilities.find(record => record.id === 'runtime.browser-agent-controller');
  push(errors, browserController?.tests?.includes('tests/v6-browser-session-resume.test.ts'), 'browser Agent controller must retain session resume coverage');

  const openGates = Array.isArray(registry.openGates) ? registry.openGates : [];
  const gateIds = uniqueIds(openGates, 'openGates', errors);
  push(errors, sameStringSet(gateIds, REQUIRED_OPEN_GATES), 'openGates must preserve all unresolved reconstruction gates');
  push(errors, openGates.some(gate => gate.id === 'browser-session-reactivation') === false, 'qualified browser session reactivation must not remain listed as open');
  push(errors, openGates.find(gate => gate.id === 'browser-checkpoint-persistence')?.status === 'open', 'durable browser checkpoint persistence must remain open');
  push(errors, openGates.find(gate => gate.id === 'site-publication')?.status === 'blocked', 'Site publication must remain blocked');
"""
    text = replace_required(text, old, new, "checker checkpoint")
    CHECKER_PATH.write_text(text, encoding="utf-8")


def update_test() -> None:
    text = TEST_PATH.read_text(encoding="utf-8")
    old = """test('qualified checkpoint core is recorded without claiming browser reactivation', async () => {
  const registry = await loadRegistry(registryPath);
  const checkpoint = registry.capabilities.find(
    (capability: { id: string }) => capability.id === 'runtime.campaign-checkpoint-core',
  );
  assert.equal(checkpoint.functionalStatus, 'qualified-bounded');
  assert.equal(checkpoint.productStatus, 'available-not-main');
  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');
  assert.equal(
    registry.openGates.find((gate: { id: string }) => gate.id === 'browser-session-reactivation').status,
    'open',
  );
  assert.equal(
    registry.openGates.some((gate: { id: string }) => gate.id === 'campaign-snapshot-restoration'),
    false,
  );
});
"""
    new = """test('qualified checkpoint core is active without claiming durable browser persistence', async () => {
  const registry = await loadRegistry(registryPath);
  const checkpoint = registry.capabilities.find(
    (capability: { id: string }) => capability.id === 'runtime.campaign-checkpoint-core',
  );
  assert.equal(checkpoint.functionalStatus, 'qualified-bounded');
  assert.equal(checkpoint.productStatus, 'active');
  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-campaign-checkpoint.ts'));
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-common-campaign-host.ts'));
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-agent-controller.ts'));
  assert.ok(checkpoint.tests.includes('tests/v6-browser-session-resume.test.ts'));
  assert.ok(checkpoint.proofs.includes('docs/recovery/op01-op31-browser-session-resume-20261113.md'));
  assert.ok(checkpoint.proofs.includes('docs/recovery/op01-op31-browser-session-resume-qualified.json'));
  assert.equal(
    registry.openGates.some((gate: { id: string }) => gate.id === 'browser-session-reactivation'),
    false,
  );
  assert.equal(
    registry.openGates.find((gate: { id: string }) => gate.id === 'browser-checkpoint-persistence').status,
    'open',
  );
  assert.equal(registry.summary.capabilitiesProductActive, 8);
});
"""
    text = replace_required(text, old, new, "registry test checkpoint")
    TEST_PATH.write_text(text, encoding="utf-8")


def update_doc() -> None:
    text = DOC_PATH.read_text(encoding="utf-8")
    replacements = [
        (
            "Commit canonique audité : `9e04bbd5569f6755178fa1b5276a112ca47d646b`",
            f"Commit canonique audité : `{AUDITED_CANONICAL_COMMIT}`",
            "audited commit",
        ),
        (
            "| `capabilitiesProductActive` | 7 |",
            "| `capabilitiesProductActive` | 8 |",
            "active capability total",
        ),
        (
            "| `runtime.campaign-checkpoint-core` | `qualified-bounded` | `available-not-main` | `not-measured-separately` |",
            "| `runtime.campaign-checkpoint-core` | `qualified-bounded` | `active` | `not-measured-separately` |",
            "checkpoint capability row",
        ),
        (
            "| `browser-session-reactivation` | `open` | Le noyau atomique campagne + FieldStock est qualifié, mais le host et le contrôleur navigateur ne possèdent pas encore le checkpoint et aucune reprise Agent réelle n’est démontrée. |",
            "| `browser-checkpoint-persistence` | `open` | La reprise dans un host frais est qualifiée en TypeScript, mais aucun stockage durable, `pagehide`, crash, nouveau processus ou cycle Chrome réel n’est encore démontré. |",
            "browser gate",
        ),
        (
            "- les 16 capacités de cette reconstruction, y compris le noyau atomique de checkpoint ;",
            "- les 16 capacités de cette reconstruction, y compris le checkpoint navigateur maintenant actif ;",
            "checker capability description",
        ),
        (
            "- la limitation des qualifications officielles de performance à Region et `joint_channels` ;",
            "- la limitation des qualifications officielles de performance à Region et `joint_channels` ;\n- la fermeture du garde de réactivation TypeScript et le maintien du garde de persistance navigateur ;",
            "checker gate description",
        ),
    ]
    for old, new, label in replacements:
        text = replace_required(text, old, new, label)

    old_paragraph = (
        "Le noyau `runtime.campaign-checkpoint-core` conserve désormais atomiquement la campagne commune, "
        "le `needId`, l’action en attente, la déduplication et l’état exact de FieldStock, avec rollback "
        "intégral. Il reste toutefois hors de la boucle navigateur active : le host et le contrôleur Agent "
        "ne possèdent pas encore le checkpoint et aucune réactivation Agent réelle n’est revendiquée.\n"
    )
    new_paragraph = """Le noyau `runtime.campaign-checkpoint-core` conserve atomiquement la campagne commune, le `needId`, l’action en attente, la déduplication et l’état exact de FieldStock, avec rollback intégral. Il est maintenant raccordé au host produit et au contrôleur Agent : un host frais peut reprendre une frontière réglée, et un retour déjà physiquement envoyé peut être acquis avec le même `needId` sans rejouer l’action ni la présentation. Un checkpoint réglé devenu obsolète est refusé avant toute nouvelle décision.

La qualification correspondante est durable :

- `docs/recovery/op01-op31-browser-session-resume-20261113.md` ;
- `docs/recovery/op01-op31-browser-session-resume-qualified.json` ;
- run GitHub Actions `43431242149`, job `131904989533` ;
- **25/25** tests ciblés ;
- **396/396** régressions TypeScript ;
- build de production réussi.

La frontière reste bornée : le checkpoint du contrôleur est en mémoire, `dispose()` l’invalide, et aucun stockage IndexedDB/localStorage, `pagehide`, crash, nouveau processus ou cycle de réactivation Chrome persisté n’est encore qualifié.
"""
    text = replace_required(text, old_paragraph, new_paragraph, "checkpoint narrative")

    old_next = (
        "La priorité fonctionnelle suivante est le raccord navigateur du noyau de continuité déjà qualifié : "
        "ownership du checkpoint par le host et le contrôleur, restauration avant toute nouvelle décision, "
        "vérification de l’observation courante et reprise d’un retour en attente sans rejouer l’action. En "
        "parallèle, toute preuve durable permettant de reconstruire l’identité des 76 emplacements pourra "
        "être ajoutée sans modifier rétroactivement les statuts actuels.\n"
    )
    new_next = (
        "La priorité fonctionnelle suivante est la persistance sûre du checkpoint déjà actif : politique "
        "d’expiration, liaison à l’identité du jeu et à la génération produit, capture à `pagehide`, puis "
        "vraie désactivation/réactivation dans Chrome contre Pyodide sans double action, double acquisition, "
        "double présentation ni perte de `needId`. Le coût de snapshot/restauration devra être mesuré "
        "séparément avant toute revendication de performance. En parallèle, toute preuve durable permettant "
        "de reconstruire l’identité des 76 emplacements pourra être ajoutée sans modifier rétroactivement "
        "les statuts actuels.\n"
    )
    text = replace_required(text, old_next, new_next, "next step")
    DOC_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    update_registry()
    update_checker()
    update_test()
    update_doc()
    print("V6 registry synchronized with browser session resume qualification")


if __name__ == "__main__":
    main()
