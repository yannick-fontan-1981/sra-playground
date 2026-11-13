# SK48 : comparaison de la source sur le journal public acquis

## Résultat

Le rejeu indépendant depuis une mémoire propre vide retrouve **les cinq propositions et les douze acquisitions de la session native**, sans différence dans leur couche RootedLine. Les gardes, états propres, suffixes de digest et restauration concordent également : **126 contrôles sur 126** dans [sk48-public-parity.json](sk48-public-parity.json).

La session réelle native s'arrête après douze actions, zéro niveau résolu et cinq préfixes, avec le motif commun `frontier_unknown`. Le rejeu de la couche propre, aussi bien Python originale que TypeScript native, retourne ensuite :

```json
{
  "status": "unknown",
  "reason": "conditional_contact_model_refuted",
  "block_unrelated_probe": true
}
```

Le résultat établit la fidélité du port sur ce trajet observé et localise un contre-exemple du modèle conditionnel hérité. Il ne clôt pas l'objectif de résolution SK48 et ne certifie pas l'appelant original complet.

## Première divergence entre prédiction et observation

Les quatre premières actions acquièrent les effets de commandes : translations verticales de −6 et +6 pixels, extension et retrait de 6 pixels. La source et le natif proposent ensuite le même plan conditionnel de onze commandes, issu de la même recherche de 282 nœuds. Le préfixe exécute huit de ces commandes : les sept premières projections concordent ; la huitième, **action globale 12**, les contredit. Les trois commandes suivantes du plan ne sont pas exécutées.

La commande contredite est celle dont l'effet acquis est la translation verticale de +6 pixels (`ACTION2`). La racine et la pointe suivent exactement la prédiction ; le matériau `8` aussi. Les deux autres matériaux se déplacent davantage que prévu.

| Pièce mesurée | Déplacement vertical prédit | Déplacement vertical observé | Écart final |
| --- | ---: | ---: | ---: |
| `material:8` | +6 px | +6 px | 0 px |
| `material:9` | +4 px | +6 px | +2 px |
| `material:14` | +2 px | +6 px | +4 px |

Les trois pièces conservent ainsi leurs espacements dans l'observation alors que le calcul nominal les réduit au contact. La sortie de la chaîne de transport/poussée conditionnelle est contredite pour cette transition. Cette seule observation ne suffit pas à choisir une autre loi générale de contact, de support, de voisinage ou de mouvement couplé. Aucun correctif lié au code de jeu ni modèle de remplacement n'est introduit.

La garde de retour ferme le préfixe, l'acquisition efface `current` et conserve le contre-exemple dans `refuted` pour l'époque courante. La proposition suivante refuse de poursuivre ce même modèle. Cette conduite est exactement celle de la source inchangée.

## Méthode et portée

[replay-rooted-public.py](replay-rooted-public.py) lit uniquement le rapport et les treize paquets déjà capturés dans [la session réelle](../final/sk48-rooted-session/sk48-campaign.json.gz). Les observations complètes proviennent des arguments consignés par le témoin d'inventaire ; leurs références, frames, états, scores et commandes disponibles sont vérifiés contre le journal public. La mémoire source est créée vide et évolue uniquement par `RootedLineAccess.record` sur ces retours. **Aucun état provenant de `proposal.memory` natif n'amorce le rejeu.**

Chaque proposition est recalculée par Python avant le retour correspondant. Les sorties propres sont comparées exactement aux sorties capturées : plan complet, identités, actions, recherches, preuves, questions et événements. Les champs ajoutés par l'appelant commun sont conservés séparément ; seul `expected_before`, ajouté à chaque étape par cette enveloppe, est exclu de la comparaison de l'étape propre. Les différences ne sont pas masquées dans `rooted_line_plan` ni dans les événements.

Les bornes source de profondeur, de nœuds et de micro-étapes, ainsi que le budget d'actions restant, sont conservés. L'échéance de temps de machine est omise pour ce rejeu du travail déjà terminé ; ce diagnostic n'est pas une mesure de coût. Les **1 786 originaux** sont vérifiés par empreinte avant et après les appels. Les sorties Python complètes figurent dans [sk48-public-source-replay.json.gz](sk48-public-source-replay.json.gz).

[check-rooted-public-parity.mjs](check-rooted-public-parity.mjs) reprend une mémoire native vide sur les mêmes observations et retours, puis compare les propositions, les douze gardes avant/après, les projections, les événements, les états et le refus terminal. Il vérifie également la reconstruction depuis les seuls événements réellement produits. Pour le digest propre, le digest d'ancêtre original reste une frontière opaque explicitement fournie ; aucune équivalence du digest hérité complet n'est déduite.

Aucun jeu, moteur, niveau, spécification ou solution n'est ouvert par ces deux scripts. Ils ne créent aucune action ni session nouvelle. CWSE reste exclu. Le diagnostic SK48 est clos sur ce contre-exemple conservé, sans nouvelle tentative.
