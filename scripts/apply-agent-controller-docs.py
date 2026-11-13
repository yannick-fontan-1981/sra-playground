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
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def replace_regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return updated


# ---------------------------------------------------------------------------
# Consolidated OP01-OP31 progress
# ---------------------------------------------------------------------------
path = "docs/migration/op01-op31-progress.md"
text = read(path)

text = replace_regex_once(
    text,
    r"- Baseline canonique intégrée avant la qualification combinée :\n"
    r"  `edb19e247c409941af35165cdf37a0440cbe6adf`\n"
    r"- Branche de travail finale :\n"
    r"  `recovery/lot5b-worker-common-campaign-final-20261112`\n"
    r"- Commit combiné qualifié :\n"
    r"  `a79aa291bd61cbbfd8c7a3579ca5df8afee06e90`\n",
    "- Baseline canonique avant activation produit :\n"
    "  `4bf27669ce8f2945aa7672f134ffe1cefcac35ae`\n"
    "- Canonique réconcilié avant qualification finale :\n"
    "  `67602172665b79e2b282b37b63f80dc24feff3b0`\n"
    "- Commit de réconciliation de la branche :\n"
    "  `d8c5e2bd3595798031d07611b4de7992834ef679`\n"
    "- Branche de travail :\n"
    "  `recovery/op01-op31-agent-mode-controller-20261112`\n",
    "progress references",
)

text = replace_once(
    text,
    "- Hôte Worker :\n"
    "  `docs/recovery/op01-op31-worker-common-campaign-20261112.md`\n",
    "- Hôte Worker :\n"
    "  `docs/recovery/op01-op31-worker-common-campaign-20261112.md`\n"
    "- Contrôleur produit Agent explicite :\n"
    "  `docs/recovery/op01-op31-agent-mode-controller-20261112.md`\n",
    "progress controller reference",
)

text = replace_once(
    text,
    "- `src/runtime/v6-browser-common-campaign-host.ts` : couture directe entre\n"
    "  campagne commune, dispatch physique, acquisition du retour et présentation.\n",
    "- `src/runtime/v6-browser-common-campaign-host.ts` : couture directe entre\n"
    "  campagne commune, dispatch physique, acquisition du retour et présentation ;\n"
    "- `src/runtime/v6-agent-mode-controller.ts` : propriétaire produit d’un seam\n"
    "  Agent unique, campagne bornée, arrêt explicite et séparation Manual/Agent.\n",
    "progress runtime architecture",
)

text = replace_once(
    text,
    "| C1 | **campagne commune, hôte browser et hôte Worker qualifiés** | collecte bornée, ambiguïté, release, attente, même `needId`, acquisition browser et Worker, y compris retour terminal | activer un contrôleur Agent explicite et unique dans le produit |",
    "| C1 | **contrôleur Agent produit explicite activé sur le seam browser OP28 strict** | un seul seam, campagne bornée, séparation Manual, arrêt sans fallback, même `needId` jusqu’au retour | raccorder les producteurs réels puis qualifier le coût d’activation |",
    "progress C1 row",
)

text = replace_once(
    text,
    "Les clics Manual ne traversent pas ces hôtes. `main.ts` n’en instancie aucun.\n"
    "L’onglet Agent ne revendique donc pas prématurément une boucle SRA active.\n\n"
    "Les deux hôtes ne doivent pas contrôler simultanément la même session sans un\n"
    "contrôleur produit explicite.\n",
    "`main.ts` sélectionne maintenant explicitement le seam browser OP28 strict par\n"
    "`V6AgentModeController`. La campagne ne démarre qu’après action volontaire sur\n"
    "le bouton Agent et reste bornée à 64 actions. Le Worker commun reste qualifié\n"
    "mais n’est pas instancié dans le produit.\n\n"
    "Les clics Manual conservent leur chemin historique et appellent toujours\n"
    "`dispatchProductAction()` sans traverser le contrôleur Agent. Le passage au\n"
    "mode Manual ou un changement de jeu annule la seule campagne Agent autorisée.\n",
    "progress activation truth",
)

text = replace_once(
    text,
    "Preuves combinées :\n",
    "### Contrôleur Agent produit explicite\n\n"
    "Qualification avec activation volontaire du seam browser OP28 strict :\n\n"
    "- run : `43351837880` ;\n"
    "- job : `131644504939` ;\n"
    "- commit qualifié avant réconciliation finale :\n"
    "  `1ac5067d58adede51443da270b2f2b75ef6f0c9b` ;\n"
    "- `npm run typecheck` : réussi ;\n"
    "- régression complète : **325/325 tests réussis** ;\n"
    "- `npm run build` : réussi ;\n"
    "- échecs, annulations, tests ignorés et TODO : `0`.\n\n"
    "La qualification finale après réconciliation canonique est enregistrée dans\n"
    "`docs/recovery/op01-op31-agent-mode-controller-20261112.md`.\n\n"
    "Preuves combinées :\n",
    "progress controller qualification",
)

text = replace_once(
    text,
    "Les deux hôtes restent inactifs dans `main.ts`. Ils n’ajoutent donc pas de coût\n"
    "au chemin utilisateur courant. Le coût d’activation reste à mesurer sur les\n"
    "quatre runners C7.\n",
    "Le seam browser OP28 est maintenant activable uniquement sur commande explicite\n"
    "dans l’onglet Agent. Le chemin Manual ne crée ni session ni cycle Agent. Le coût\n"
    "des campagnes Agent actives reste à mesurer sur les quatre runners C7.\n",
    "progress performance activation",
)

text = replace_regex_once(
    text,
    r"## Limites encore ouvertes\n.*?\n## Feuille de route actualisée\n.*\Z",
    "## Limites encore ouvertes\n\n"
    "- seul le propriétaire public OP28 strict est activé dans le produit ;\n"
    "- le Worker commun reste inactif dans `main.ts` afin d’éviter deux autorités\n"
    "  concurrentes sur une même session ;\n"
    "- FieldStock n’a pas encore de constructeur initial de contexte browser ;\n"
    "- aucun prior FieldStock réel n’est acquis par l’interface ;\n"
    "- Region n’a pas encore de candidat physique commun complet ;\n"
    "- les acquisitions passives multi-owners ne sont pas orchestrées ;\n"
    "- les campagnes et actions en attente n’ont pas de snapshot/restauration\n"
    "  complet ;\n"
    "- aucun propriétaire OP31 n’est raccordé ;\n"
    "- les états non représentables par le protocole Agent restent refusés ;\n"
    "- la performance officielle C7 reste ouverte ;\n"
    "- aucune publication Site n’est effectuée.\n\n"
    "## Feuille de route actualisée\n\n"
    "### Étape immédiate : producteurs symboliques réels\n\n"
    "1. construire `FieldStockCampaignContext` depuis les observations publiques et\n"
    "   une connaissance réellement acquise ;\n"
    "2. reconstruire l’acquisition initiale honnête du prior FieldStock ;\n"
    "3. raccorder FieldStock au seam browser sans étendre artificiellement OP28 ;\n"
    "4. compléter le candidat physique Region avant son enregistrement commun ;\n"
    "5. maintenir l’arrêt `none`/`ambiguous` tant qu’aucun producteur n’est unique.\n\n"
    "### Étape suivante : restauration et objectifs\n\n"
    "1. ajouter snapshot/restauration des campagnes et décisions en attente ;\n"
    "2. orchestrer les acquisitions passives utiles sans double consommation ;\n"
    "3. identifier un vrai propriétaire d’objectif avant toute activation OP31.\n\n"
    "### Performance et publication\n\n"
    "1. exécuter les régressions fonctionnelles et campagnes browser réelles ;\n"
    "2. compléter le manifeste des quatre runners ;\n"
    "3. mesurer A/STCK, A/SMLP, B/STCK et B/SMLP séparément ;\n"
    "4. conserver strictement moins de +10 % de médiane par jeu ;\n"
    "5. intégrer sur la branche canonique GitHub ;\n"
    "6. publier le Site seulement lorsque le code correspondant est durablement sur\n"
    "   GitHub ;\n"
    "7. vérifier ensuite GitHub ↔ Site.\n\n"
    "Aucune publication Site n’appartient à la tranche courante.\n",
    "progress roadmap",
)

write(path, text)


# ---------------------------------------------------------------------------
# Canonical reconstruction status — preserve the newer Lot 9 corpus evidence.
# ---------------------------------------------------------------------------
path = "docs/recovery/site109-reconstruction-status.md"
text = read(path)

text = replace_once(
    text,
    "- `docs/recovery/op01-op31-worker-common-campaign-20261112.md`.\n",
    "- `docs/recovery/op01-op31-worker-common-campaign-20261112.md` ;\n"
    "- `docs/recovery/op01-op31-agent-mode-controller-20261112.md`.\n",
    "status proof reference",
)

text = replace_regex_once(
    text,
    r"Les deux hôtes restent inactifs dans `main\.ts`\..*?"
    r"\*\*5B, OP18/OP28, le propriétaire commun et ses hôtes browser et Worker sont\n"
    r"fonctionnellement qualifiés ; activation produit, acquisition initiale,\n"
    r"restauration et performance officielle restent à confirmer\.\*\*\n",
    "`main.ts` sélectionne maintenant un seul seam produit : l’hôte browser OP28\n"
    "public strict, possédé par `V6AgentModeController`. La campagne démarre seulement\n"
    "sur commande explicite, reste bornée à 64 actions et s’arrête sur `none`,\n"
    "`ambiguous`, `blocked`, terminal, erreur ou obsolescence.\n\n"
    "Le Worker commun reste qualifié mais inactif dans `main.ts`. Le contrôleur\n"
    "empêche ainsi deux autorités de campagne de piloter la même session. Le mode\n"
    "Manual conserve son dispatch historique et annule la campagne Agent lorsqu’il\n"
    "reprend la propriété.\n\n"
    "Qualification produit initiale :\n\n"
    "- run `43351837880` ;\n"
    "- job `131644504939` ;\n"
    "- commit `1ac5067d58adede51443da270b2f2b75ef6f0c9b` ;\n"
    "- typecheck réussi ;\n"
    "- **325/325 tests réussis** ;\n"
    "- build Vite réussi.\n\n"
    "Limites :\n\n"
    "- seul OP28 public strict est activé dans le produit ;\n"
    "- l’acquisition initiale du prior FieldStock depuis une vraie campagne reste\n"
    "  absente ;\n"
    "- Region commun, acquisition passive et snapshot/restauration restent ouverts ;\n"
    "- OP31 n’a pas de propriétaire d’objectif produit ;\n"
    "- performance officielle STCK/SMLP encore à mesurer.\n\n"
    "Statut Lot 5 :\n\n"
    "**5B, OP18/OP28, le propriétaire commun, ses hôtes et le contrôleur produit\n"
    "borné OP28 sont fonctionnellement qualifiés ; acquisition FieldStock initiale,\n"
    "Region commun, restauration et performance officielle restent à confirmer.**\n",
    "status Agent activation",
)

write(path, text)


# ---------------------------------------------------------------------------
# Browser campaign host document
# ---------------------------------------------------------------------------
path = "docs/recovery/op01-op31-browser-campaign-host-20261112.md"
text = read(path)

text = replace_regex_once(
    text,
    r"## Performance\n.*?\n## Dispositions OP\n",
    "## Activation produit et performance\n\n"
    "Depuis la tranche contrôleur Agent, `main.ts` instancie cet hôte uniquement\n"
    "derrière `V6AgentModeController` et la fabrique\n"
    "`createPublicSingleActionBrowserCampaignHost()`.\n\n"
    "L’activation reste explicite : sélectionner l’onglet Agent ne lance rien ; le\n"
    "bouton **Run bounded agent** crée la session. Une seule campagne peut posséder\n"
    "la session et la borne produit est fixée à 64 actions. Le retour au mode Manual\n"
    "ou un changement de jeu annule la campagne en cours.\n\n"
    "Le chemin Manual n’exécute pas le contrôleur Agent. Le coût d’une campagne\n"
    "Agent active doit néanmoins être qualifié selon C7 : médiane strictement sous\n"
    "+10 % pour STCK et SMLP séparément sur les quatre runners.\n\n"
    "Qualification produit initiale : run `43351837880`, job `131644504939`,\n"
    "**325/325 tests**, typecheck et build réussis. Voir\n"
    "`docs/recovery/op01-op31-agent-mode-controller-20261112.md`.\n\n"
    "Ce qui reste volontairement inactif :\n\n"
    "- le Worker commun n’est pas instancié dans `main.ts` ;\n"
    "- FieldStock browser n’a pas encore de contexte initial réel ;\n"
    "- Region n’a pas encore de contrat physique commun complet ;\n"
    "- aucun owner OP31 n’est activé ;\n"
    "- aucune publication Site n’est effectuée.\n\n"
    "## Dispositions OP\n",
    "browser activation section",
)

text = replace_regex_once(
    text,
    r"## Prochaine étape\n.*\Z",
    "## Prochaine étape\n\n"
    "Étendre la campagne uniquement à partir de producteurs réellement qualifiés :\n\n"
    "1. construire un contexte FieldStock browser depuis l’observation publique et\n"
    "   une connaissance réellement acquise ;\n"
    "2. raccorder ce propriétaire sans retirer l’ambiguïté ni inventer ACTION6 ;\n"
    "3. compléter le candidat physique Region avant son inscription ;\n"
    "4. ajouter snapshot/restauration du contrôleur et des besoins en attente ;\n"
    "5. qualifier les sessions complètes et le coût officiel C7.\n\n"
    "GitHub reste la source canonique. Aucune publication Site n’est autorisée avant\n"
    "intégration durable, qualification et vérification GitHub ↔ Site.\n",
    "browser roadmap",
)

write(path, text)


# ---------------------------------------------------------------------------
# Common campaign owner document
# ---------------------------------------------------------------------------
path = "docs/recovery/op01-op31-common-campaign-owner-20261112.md"
text = read(path)

text = replace_once(
    text,
    "Les deux hôtes restent inactifs dans `main.ts`. Ils ne doivent pas être exécutés\n"
    "simultanément sur la même session sans contrôleur produit explicite.\n",
    "Le produit sélectionne maintenant explicitement l’hôte browser OP28 strict via\n"
    "`V6AgentModeController`. Le Worker commun reste inactif dans `main.ts`, ce qui\n"
    "empêche deux autorités concurrentes sur la même session. Le mode Manual garde\n"
    "son chemin de dispatch séparé.\n",
    "common owner activation",
)

text = replace_regex_once(
    text,
    r"## Limites restantes\n.*\Z",
    "## Limites restantes\n\n"
    "- seul OP28 public strict est activé dans le produit ;\n"
    "- acquisition initiale du prior FieldStock depuis une vraie campagne absente ;\n"
    "- constructeur de contexte browser FieldStock absent ;\n"
    "- Region sans candidat physique commun complet ;\n"
    "- acquisition passive non orchestrée par le propriétaire commun ;\n"
    "- snapshot/restauration complet des campagnes en attente absent ;\n"
    "- OP31 sans owner produit ;\n"
    "- coût officiel A/B × STCK/SMLP non qualifié ;\n"
    "- aucune parité exacte Site 109 / native 0.68 revendiquée.\n\n"
    "## Statut\n\n"
    "**Le noyau commun, l’hôte browser/product OP28, l’hôte Worker OP18/OP28 et\n"
    "le contrôleur produit unique sont fonctionnellement qualifiés ensemble.**\n\n"
    "**FieldStock browser, acquisition initiale, Region commun, restauration, OP31\n"
    "et performance officielle restent ouverts.**\n",
    "common owner limits",
)

write(path, text)


# ---------------------------------------------------------------------------
# Worker campaign document
# ---------------------------------------------------------------------------
path = "docs/recovery/op01-op31-worker-common-campaign-20261112.md"
text = read(path)

text = replace_once(
    text,
    "Cet hôte direct conserve ACTION6 et ses coordonnées, annule les retours obsolètes\n"
    "et refuse les observations produit périmées. Il reste inactif dans `main.ts`.\n\n"
    "Le raccord Worker n’altère pas cet hôte et ne lui retire aucune responsabilité.\n"
    "La prochaine architecture produit devra choisir explicitement le contrôleur\n"
    "utilisé, sans faire exécuter deux propriétaires de campagne concurrents sur la\n"
    "même session.\n",
    "Cet hôte direct conserve ACTION6 et ses coordonnées, annule les retours obsolètes\n"
    "et refuse les observations produit périmées. Il est maintenant le seul seam\n"
    "sélectionné dans `main.ts`, derrière `V6AgentModeController`.\n\n"
    "Le raccord Worker n’altère pas cet hôte et ne lui retire aucune responsabilité.\n"
    "Le Worker commun reste volontairement inactif dans `main.ts`, évitant deux\n"
    "propriétaires de campagne concurrents sur la même session.\n",
    "worker coexistence",
)

text = replace_regex_once(
    text,
    r"## Limites conservées\n.*\Z",
    "## Limites conservées\n\n"
    "- `main.ts` active uniquement l’hôte browser OP28 strict ;\n"
    "- le Worker commun reste qualifié mais inactif dans le produit ;\n"
    "- l’acquisition initiale d’un prior FieldStock depuis une vraie campagne reste\n"
    "  absente ;\n"
    "- Region n’est pas enregistré dans le port Worker commun ;\n"
    "- l’acquisition passive des owners non sélectionnés n’est pas orchestrée ;\n"
    "- le snapshot/restauration du port Worker et de la décision en attente manque ;\n"
    "- OP31 n’a toujours pas de propriétaire d’objectif produit ;\n"
    "- la performance officielle A/B × STCK/SMLP sous `+10 %` par jeu n’est pas\n"
    "  mesurée ;\n"
    "- aucune parité exacte avec Site 109 / native 0.68 n’est revendiquée.\n\n"
    "## Statut\n\n"
    "**Le propriétaire commun reste raccordé au Worker V6 reconstruit, en complément\n"
    "du seam browser désormais sélectionné par un contrôleur produit unique. Les\n"
    "retours OP18/OP28 sont corrélés au même `needId`, y compris en terminaison, et\n"
    "FieldStock modifie la décision suivante.**\n\n"
    "**Activation Worker produit, acquisition initiale, Region commun, restauration,\n"
    "OP31 et performance officielle restent ouverts.**\n",
    "worker limits",
)

write(path, text)
