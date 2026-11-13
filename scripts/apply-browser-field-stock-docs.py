from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def section(text: str, start: str, end: str, replacement: str, label: str) -> str:
    pattern = rf"{re.escape(start)}.*?(?={re.escape(end)})"
    updated, count = re.subn(pattern, replacement.rstrip() + "\n\n", text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{label}: expected one section, found {count}")
    return updated


# ---------------------------------------------------------------------------
# Consolidated OP01-OP31 progress
# ---------------------------------------------------------------------------
path = "docs/migration/op01-op31-progress.md"
text = read(path)
text = replace_once(
    text,
    "- Baseline canonique de la tranche contrôleur :\n"
    "  `4bf27669ce8f2945aa7672f134ffe1cefcac35ae`\n"
    "- Branche de travail :\n"
    "  `op01-op31-browser-agent-controller-20261112`\n"
    "- Commit fonctionnel qualifié :\n"
    "  `50948c69806d8682313ed61d7364399e699b365f`\n",
    "- Baseline canonique de la tranche FieldStock browser :\n"
    "  `510642125e1f5994b30e4f71b884a2278dcc91a8`\n"
    "- Branche de travail :\n"
    "  `recovery/op01-op31-browser-field-stock-context-20261112`\n"
    "- Commit combiné qualifié :\n"
    "  `400d9bcc1062130508d27e62f1508f82011d2ea7`\n",
    "progress references",
)
text = replace_once(
    text,
    "- Contrôleur Agent actif :\n"
    "  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`\n",
    "- Contrôleur Agent actif :\n"
    "  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`\n"
    "- Contexte navigateur FieldStock :\n"
    "  `docs/recovery/op01-op31-browser-field-stock-context-20261112.md`\n",
    "progress report reference",
)
text = replace_once(
    text,
    "- un contrôleur Agent explicite et unique activé dans `main.ts` ;\n"
    "- un chemin Manual toujours séparé.\n",
    "- un contrôleur Agent explicite et unique activé dans `main.ts` ;\n"
    "- un transport FieldStock navigateur enregistré mais inerte sans prior ;\n"
    "- un chemin Manual toujours séparé.\n",
    "progress global status",
)
text = replace_once(
    text,
    "- `src/runtime/v6-browser-agent-controller.ts` : propriétaire unique de la\n"
    "  session Agent, boucle bornée et causes d’arrêt.\n",
    "- `src/runtime/v6-browser-agent-controller.ts` : propriétaire unique de la\n"
    "  session Agent, boucle bornée et causes d’arrêt ;\n"
    "- `src/runtime/v6-browser-field-stock-campaign.ts` : mesure publique,\n"
    "  revalidation et transport du contexte FieldStock/OP18.\n",
    "progress architecture",
)
text = replace_once(
    text,
    "| C1 | **contrôleur produit actif et qualifié** | campagne commune, browser, Worker, même `needId`, une seule session Agent, transfert Manual gracieux | snapshots produit et acquisitions passives multi-propriétaires |\n"
    "| C2 | **OP18 démontrée dans le Worker ; OP28 active dans le produit sous contrat strict** | OP18 change la proposition suivante ; OP28 traverse le produit réel jusqu’au retour acquis | contexte produit FieldStock et propriétaire OP31 |\n",
    "| C1 | **contrôleur produit actif avec deux propriétaires enregistrés** | session unique, OP28 actif, FieldStock inertiel sans prior, retour acquis avant frontière et présentation | snapshot produit et acquisitions passives multi-propriétaires |\n"
    "| C2 | **OP18 transportée dans le browser lorsqu’un prior réel est fourni ; OP28 active sans régression** | revalidation publique, ACTION6 mesurée, retour spécialisé puis frontière ; OP28 inchangée avec runtime vide | acquisition initiale réelle du prior et propriétaire OP31 |\n",
    "progress C1 C2",
)
text = replace_once(
    text,
    "| C7 | **ouvert** | 325 tests, build, câblage et runners candidats | quatre runners complets et médianes par jeu sous +10 % |",
    "| C7 | **ouvert** | 332 tests, build, câblage et runners candidats | quatre runners complets et médianes par jeu sous +10 % |",
    "progress C7",
)
text = section(
    text,
    "## Chaîne OP18 : FieldStock",
    "## Chaîne OP28 produit active",
    """## Chaîne OP18 : FieldStock

### Besoin

Un prior adressé réellement acquis existe, la scène publique actuelle le
revalide et une demande typée reste insatisfaite alors qu’ACTION6 est disponible.

### Production navigateur

`BrowserFieldStockOwnerTransport` :

- reste inerte si le runtime est vide ou réfuté ;
- mesure uniquement l’observation publique 64×64 ;
- matérialise les composants visibles seulement pour revalider un prior ;
- rétrograde un stock provenant d’une autre session avant toute utilisation ;
- expose `FieldStockCampaignContext` seulement après revalidation courante.

`FieldStockCallerOwnerAdapter` produit alors le bundle OP18 et l’action ACTION6
coordonnée. Le retour suit l’ordre :

1. acquisition corrélée au même `needId` ;
2. `afterStock()` ;
3. `recordStock()` ;
4. frontière et rétention locales ;
5. présentation.

Le scénario qualifié revalide un prior public, propose ACTION6 vers `(22,20)`
et enregistre une réécriture conjointe observée en matériau de type 2.

Disposition OP18 : **chaîne navigateur qualifiée depuis un prior fourni jusqu’au
retour spécialisé et à la rétention de frontière.**

Dette produit : acquérir honnêtement le prior initial. Le contrôleur par défaut
crée un runtime vide et n’invente jamais cette connaissance.""",
    "progress OP18 section",
)
text = replace_once(
    text,
    "| OP18 | **chaîne FieldStock complète dans le Worker** | besoin, bundle, admission, action, retour spécialisé et décision suivante |",
    "| OP18 | **chaîne Worker complète et transport browser qualifié avec prior fourni** | revalidation publique, bundle, ACTION6 mesurée, retour spécialisé puis frontière ; acquisition initiale absente |",
    "progress OP18 row",
)
text = replace_once(
    text,
    "Deux vulnérabilités de dépendances de sévérité haute préexistantes restent\n"
    "signalées par `npm ci`.\n",
    "Deux vulnérabilités de dépendances de sévérité haute préexistantes restent\n"
    "signalées par `npm ci`.\n\n"
    "Qualification FieldStock browser et contrôleur par défaut :\n\n"
    "- run GitHub Actions : `43353708964` ;\n"
    "- job : `131650593632` ;\n"
    "- commit : `400d9bcc1062130508d27e62f1508f82011d2ea7` ;\n"
    "- typecheck : réussi ;\n"
    "- régression complète : **332/332** ;\n"
    "- build de production : réussi ;\n"
    "- galerie : 100 jeux, 636 prévisualisations et 4 atlas ;\n"
    "- aucune ACTION6 inventée avec runtime FieldStock vide.\n",
    "progress qualification",
)
text = section(
    text,
    "## Limites ouvertes",
    "## Feuille de route actualisée",
    """## Limites ouvertes

- aucun mécanisme produit n’acquiert encore le prior FieldStock initial ;
- le runtime FieldStock du contrôleur par défaut reste donc vide ;
- aucune persistance de cette connaissance entre activations n’est revendiquée ;
- aucun contrat physique commun complet pour Region ;
- acquisitions passives multi-propriétaires non orchestrées dans le produit ;
- aucune sauvegarde/restauration d’une session Agent en attente ;
- aucun propriétaire OP31 ;
- performance C7 non close ;
- aucune publication Site dans cette tranche.""",
    "progress limits",
)
text = section(
    text,
    "## Feuille de route actualisée",
    "### Clôture C7",
    """## Feuille de route actualisée

### Étape immédiate : acquisition initiale FieldStock

1. identifier une observation publique qui justifie l’acquisition adressée ;
2. produire le prior compact sans utiliser d’état privé ;
3. conserver la provenance, les témoins et la qualification locale ;
4. injecter ce prior dans le runtime produit avant revalidation ;
5. démontrer la découverte, OP18, le retour et la décision suivante sur une vraie
   campagne navigateur.

### Étape suivante : élargissement symbolique

1. compléter le contrat physique Region ;
2. orchestrer les acquisitions passives sans double consommation ;
3. ajouter snapshot/restauration du propriétaire et de ses connaissances ;
4. identifier un propriétaire d’objectif réel avant OP31.""",
    "progress roadmap",
)
write(path, text)


# ---------------------------------------------------------------------------
# Canonical reconstruction status: replace stale common-owner section only.
# ---------------------------------------------------------------------------
path = "docs/recovery/site109-reconstruction-status.md"
text = read(path)
text = section(
    text,
    "## Propriétaire commun OP18/OP28",
    "## Progression Lot 9 — reprise 9B",
    """## Propriétaire commun OP18/OP28

Le produit navigateur possède maintenant un contrôleur Agent unique et borné.
Il instancie le seam browser direct ; le Worker commun reste qualifié mais n’est
pas instancié par `main.ts`.

### Chaîne produit active

`BrowserAgentController` possède une seule session, une limite de 64 actions et
un transfert Agent → Manual gracieux après règlement d’un retour déjà en vol.
Il s’arrête sans fallback sur `none`, `ambiguous`, `pending`, `blocked`, terminal,
obsolescence, erreur ou limite.

Le mode Manual conserve son dispatch historique et ne traverse aucune campagne
Agent.

### OP28

Le propriétaire public strict reste actif lorsque l’observation expose une seule
action simple complète. La chaîne traverse autorité Logos, dispatch physique,
retour corrélé au même `needId`, acquisition et présentation.

### FieldStock / OP18 dans le browser

`BrowserFieldStockOwnerTransport` est maintenant enregistré avec OP28 dans
l’hôte par défaut.

Il reste inerte lorsque le runtime est vide. Un prior explicitement fourni doit
être revalidé uniquement depuis la scène publique 64×64 avant toute proposition
OP18. Un stock provenant d’une autre session est rétrogradé en prior et ne peut
pas contourner cette revalidation.

Le retour sélectionné est consommé par `afterStock()` et `recordStock()` avant
la frontière locale et avant la présentation.

Scénario qualifié : prior public revalidé, ACTION6 vers `(22,20)`, réécriture
conjointe observée, puis rétention correcte lors d’une frontière officielle.

Le produit ne possède toutefois encore aucun mécanisme d’acquisition initiale
du prior. Le runtime créé par défaut est donc vide et ACTION6 seule produit
`none` sans coordonnées inventées.

### Qualification combinée

- run GitHub Actions : `43353708964` ;
- job : `131650593632` ;
- commit qualifié : `400d9bcc1062130508d27e62f1508f82011d2ea7` ;
- Node `22.18.0` ;
- typecheck réussi ;
- **332/332 tests réussis** ;
- build Vite réussi ;
- 100 jeux, 636 prévisualisations et 4 atlas générés.

Preuves :

- `docs/recovery/op01-op31-common-campaign-owner-20261112.md` ;
- `docs/recovery/op01-op31-browser-campaign-host-20261112.md` ;
- `docs/recovery/op01-op31-worker-common-campaign-20261112.md` ;
- `docs/recovery/op01-op31-browser-agent-controller-20261112.md` ;
- `docs/recovery/op01-op31-browser-field-stock-context-20261112.md`.

Limites :

- acquisition initiale du prior FieldStock absente ;
- Region commun, acquisition passive et snapshot/restauration ouverts ;
- OP31 sans propriétaire d’objectif produit ;
- performance officielle STCK/SMLP encore à mesurer.

Statut Lot 5 :

**5B, le propriétaire commun, le contrôleur browser, OP28 active et le transport
FieldStock/OP18 depuis un prior fourni sont fonctionnellement qualifiés ;
acquisition initiale, restauration et performance officielle restent à
confirmer.**""",
    "status common owner",
)
write(path, text)


# ---------------------------------------------------------------------------
# Browser host contract: add post-acquisition hook and replace stale tail.
# ---------------------------------------------------------------------------
path = "docs/recovery/op01-op31-browser-campaign-host-20261112.md"
text = read(path)
text = replace_once(
    text,
    "3. appeler `CommonCampaignOwner.acquire()` avec le même `sessionId`, le même\n"
    "   propriétaire, la même proposition et le même `needId` ;\n"
    "4. mettre à jour l’observation courante de l’hôte ;\n"
    "5. seulement ensuite présenter le résultat à l’interface.\n",
    "3. appeler `CommonCampaignOwner.acquire()` avec le même `sessionId`, le même\n"
    "   propriétaire, la même proposition et le même `needId` ;\n"
    "4. mettre à jour l’observation courante de l’hôte ;\n"
    "5. appeler le hook propriétaire facultatif `afterAcquire()` ;\n"
    "6. seulement ensuite présenter le résultat à l’interface.\n",
    "browser host order",
)
text = replace_once(
    text,
    "Cette fabrique démontre la couture produit. Elle ne constitue pas un\n"
    "planificateur général et n’est pas présentée comme le SRA complet.\n",
    "Cette fabrique démontre la couture produit. Elle ne constitue pas un\n"
    "planificateur général et n’est pas présentée comme le SRA complet.\n\n"
    "## Hôte combiné OP18/OP28\n\n"
    "`createPublicAndFieldStockBrowserCampaignHost()` enregistre FieldStock et le\n"
    "fallback OP28. FieldStock reste inerte sans prior, mesure les composants\n"
    "publics uniquement pour une revalidation nécessaire et produit OP18 seulement\n"
    "après applicabilité courante. L’ambiguïté entre propriétaires reste conservée.\n\n"
    "Le hook `afterAcquire()` permet à FieldStock d’appliquer la frontière et la\n"
    "rétention seulement après consommation spécialisée du retour, sans acquérir\n"
    "d’autorité de dispatch.\n",
    "browser combined host",
)
text = section(
    text,
    "## Performance",
    "## Dispositions OP",
    """## Activation et performance

Le contrôleur produit canonique instancie désormais l’hôte combiné OP18/OP28.
Son runtime FieldStock est vide par défaut : le chemin actif demeure OP28 tant
qu’aucun prior réel n’a été acquis et revalidé.

Qualification combinée : run `43353708964`, job `131650593632`, typecheck,
**332/332 tests** et build Vite réussis.

Le mode Manual ne traverse pas la campagne. Le coût des sessions Agent actives
reste néanmoins à qualifier sur A/STCK, A/SMLP, B/STCK et B/SMLP, avec une
médiane strictement sous +10 % pour chaque jeu.""",
    "browser performance",
)
text = section(
    text,
    "## Dispositions OP",
    "## Prochaine étape",
    """## Dispositions OP

- **OP18** : contexte browser, revalidation publique, ACTION6 mesurée, retour
  spécialisé et frontière post-acquisition qualifiés lorsqu’un prior est fourni ;
  acquisition initiale encore absente.
- **OP28** : seam produit/browser complet conservé pour le fallback public strict.
- **OP29/OP30** : consommateurs spécialisés FieldStock conservés sans appel
  générique redondant.
- **OP31** : toujours sans propriétaire d’objectif produit.
- **Autres OP** : aucune activation artificielle.""",
    "browser dispositions",
)
text = re.sub(
    r"## Prochaine étape\n.*\Z",
    """## Prochaine étape

Construire l’acquisition initiale honnête du prior FieldStock :

1. identifier les témoins publics suffisants ;
2. produire un prior compact avec provenance ;
3. l’injecter dans le runtime produit sans le rendre directement applicable ;
4. laisser le transport actuel le revalider dans la scène courante ;
5. démontrer une vraie campagne OP18 jusqu’à la décision suivante ;
6. qualifier ensuite le coût C7.

GitHub reste la source canonique. Aucune publication Site n’est incluse.
""",
    text,
    count=1,
    flags=re.DOTALL,
)
write(path, text)


# ---------------------------------------------------------------------------
# Browser controller report: update default scope and current qualification.
# ---------------------------------------------------------------------------
path = "docs/recovery/op01-op31-browser-agent-controller-20261112.md"
text = read(path)
text = section(
    text,
    "## Périmètre réellement actif",
    "## Tests ajoutés",
    """## Périmètre réellement actif

Le host créé par défaut enregistre deux propriétaires :

- FieldStock/OP18 ;
- l’action publique simple unique/OP28.

Le runtime FieldStock est neuf et vide à chaque création par défaut. Son
inscription ne lui donne donc aucun pouvoir :

- aucun prior → aucun composant mesuré pour FieldStock ;
- aucune revalidation → aucune proposition OP18 ;
- ACTION6 seule → `none`, sans coordonnées inventées ;
- une action simple unique → OP28 comme avant ;
- plusieurs propositions complètes → `ambiguous` sans classement.

Lorsqu’un prior est explicitement fourni à une fabrique contrôlée, le transport
browser le revalide depuis les pixels publics avant OP18. Cette capacité est
qualifiée, mais le produit ne découvre pas encore le prior initial.

Le produit dispose donc d’une vraie boucle Agent et d’un transport OP18 prudent,
sans prétendre encore une acquisition ou planification générale.""",
    "controller active scope",
)
text = replace_once(
    text,
    "- message public borné ;\n"
    "- absence de fallback caché.\n",
    "- message public borné ;\n"
    "- absence de fallback caché.\n\n"
    "### FieldStock par défaut\n\n"
    "`tests/v6-browser-agent-controller-field-stock-default.test.ts` vérifie la\n"
    "fabrique combinée et l’arrêt `none` sans dispatch lorsque seule ACTION6 est\n"
    "disponible mais qu’aucun prior FieldStock n’existe.\n",
    "controller tests",
)
text = section(
    text,
    "## Qualification",
    "## Performance",
    """## Qualification

Qualification historique du contrôleur : run `43351836350`, job
`131644500100`, **325/325 tests** et build réussis.

Qualification actuelle avec le transport FieldStock enregistré par défaut :

- run : `43353708964` ;
- job : `131650593632` ;
- commit : `400d9bcc1062130508d27e62f1508f82011d2ea7` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck : réussi ;
- régression complète : **332/332 tests réussis** ;
- build Vite : réussi ;
- 100 jeux, 636 prévisualisations et 4 atlas générés.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées. Cette tranche ne les introduit ni ne les corrige.""",
    "controller qualification",
)
text = section(
    text,
    "## Dispositions OP affectées",
    "## Limites ouvertes",
    """## Dispositions OP affectées

- **OP28** : activation produit réelle conservée sous le contrat mono-action
  strict.
- **OP18** : propriétaire et transport navigateur enregistrés ; revalidation,
  ACTION6 et retour qualifiés lorsqu’un prior réel est fourni ; acquisition
  initiale absente du produit.
- **OP29/OP30** : consommation spécialisée et frontière post-acquisition
  conservées sans appel générique redondant.
- **OP31** : toujours sans propriétaire d’objectif produit.
- **Autres OP** : aucune activation artificielle.""",
    "controller dispositions",
)
text = section(
    text,
    "## Limites ouvertes",
    "## Prochaine étape",
    """## Limites ouvertes

- aucun mécanisme produit n’acquiert encore le prior FieldStock initial ;
- le runtime FieldStock par défaut reste vide ;
- Region ne possède pas encore le contrat physique commun complet ;
- les acquisitions passives multi-propriétaires ne sont pas orchestrées ;
- les sessions et connaissances Agent ne disposent pas encore d’une sauvegarde
  et restauration produit ;
- aucun propriétaire OP31 n’est raccordé ;
- la performance officielle C7 reste ouverte ;
- aucune publication Site n’est effectuée.""",
    "controller limits",
)
text = re.sub(
    r"## Prochaine étape\n.*\Z",
    """## Prochaine étape

La prochaine tranche doit acquérir le prior initial à partir d’un besoin public
réel, puis utiliser le transport déjà qualifié :

1. détecter les témoins publics d’un champ adressé ;
2. produire un prior local avec provenance et limites ;
3. le conserver comme hypothèse non applicable ;
4. laisser la scène courante le revalider ;
5. démontrer OP18 jusqu’à la décision suivante en campagne réelle ;
6. poursuivre ensuite Region, restauration, OP31 et C7.

GitHub reste la source canonique. Toute publication Site future devra pointer
vers un commit canonique intégré et vérifié.
""",
    text,
    count=1,
    flags=re.DOTALL,
)
write(path, text)


# ---------------------------------------------------------------------------
# Historical combined controller qualification: append later evolution.
# ---------------------------------------------------------------------------
path = "docs/recovery/op01-op31-browser-agent-controller-combined-qualification-20261112.md"
text = read(path)
text = replace_once(
    text,
    "## Performance\n",
    "## Évolution postérieure : FieldStock browser\n\n"
    "Le contrôleur qualifié par le présent rapport utilise désormais la fabrique\n"
    "combinée FieldStock/OP28. Le runtime FieldStock reste vide par défaut et ne\n"
    "produit aucune ACTION6 sans prior réel. Avec un prior fourni, le contexte est\n"
    "revalidé depuis les pixels publics avant OP18.\n\n"
    "Qualification postérieure : run `43353708964`, job `131650593632`,\n"
    "**332/332 tests**, typecheck et build réussis. Rapport :\n"
    "`docs/recovery/op01-op31-browser-field-stock-context-20261112.md`.\n\n"
    "## Performance\n",
    "combined qualification evolution",
)
write(path, text)
