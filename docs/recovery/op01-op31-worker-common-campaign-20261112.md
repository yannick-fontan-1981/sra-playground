# OP01–OP31 — raccord Worker du propriétaire commun

Date : 12 novembre 2026

Branche finale de travail :
`recovery/lot5b-worker-common-campaign-final-20261112`

Baseline canonique incluant l’hôte browser/product :
`edb19e247c409941af35165cdf37a0440cbe6adf`

Commit Worker précédemment qualifié :
`08a04a9da59b0f385d080acf6091d4acdcf800c6`

Commit combiné qualifié :
`a79aa291bd61cbbfd8c7a3579ca5df8afee06e90`

Documents associés :

- `docs/recovery/op01-op31-common-campaign-owner-20261112.md` ;
- `docs/recovery/op01-op31-browser-campaign-host-20261112.md` ;
- `docs/migration/op01-op31-progress.md`.

## Objectif

Raccorder le `CommonCampaignOwner` au Worker V6 reconstruit sans remplacer ni
dupliquer l’hôte browser/product déjà intégré.

Les deux hôtes ont des responsabilités différentes :

- `BrowserCommonCampaignHost` possède la couture directe produit/browser autour
  du propriétaire commun et de `AgentProductDispatch` ;
- `V6CommonCampaignDecisionPort` possède la couture Worker, le contrat
  `initialize/observe/decide/cancel` et la consommation des retours même lorsque
  l’observation suivante est terminale ou sans budget de décision.

Aucun des deux n’est encore activé dans `main.ts`.

La chaîne Worker qualifiée est :

**AgentObservation publique → mesure publique → retour de l’action précédente →
frontière officielle → revalidation éventuelle → propositions propriétaires →
sélection neutre → OP18 ou OP28 → action → observation suivante corrélée au même
`needId`.**

## Mesure publique

`src/runtime/v6-public-observation-measurement.ts` :

- copie l’observation publique ;
- exige une image exacte 64×64 ;
- refuse les valeurs de palette hors `[0, 15]` ;
- conserve uniquement session, séquence, pixels, actions, état, niveau et
  progression publics ;
- construit des identités et digests déterministes ;
- ne matérialise les composants monochromes 4-connexes que lorsqu’un prior
  FieldStock attend une revalidation.

Le chemin OP28 simple ne paie donc pas systématiquement le coût de segmentation.
Aucun masque engine, fixture, rôle caché ou coordonnée privée n’est utilisé.

## Port Worker commun

`src/runtime/v6-common-campaign-decision-port.ts` :

- possède le `CommonCampaignOwner` canonique ;
- enregistre l’owner FieldStock/OP18 et l’owner public unique/OP28 ;
- accepte des owners supplémentaires sans les classer ;
- acquiert le retour en attente avant toute nouvelle proposition ;
- conserve le même `needId` de la release au retour ;
- franchit ensuite une éventuelle frontière officielle ;
- revalide un prior FieldStock dans une scène non terminale ;
- demande enfin la proposition suivante ;
- renvoie `undefined` pour `none`, `ambiguous` ou `blocked`.

Le port par défaut ne reçoit aucun prior FieldStock artificiel. ACTION6 seule ne
produit aucune action tant qu’une connaissance retenue explicite n’a pas été
revalidée.

## Observation avant arrêt

`src/runtime/v6-agent-worker-core.ts` étend `AgentDecisionPort` avec un hook
facultatif `observe()` distinct de `decide()`.

Toute observation validée est consommée avant :

- l’arrêt terminal `WIN` ;
- l’arrêt pour budget non positif ;
- la demande d’une nouvelle décision.

Cela ferme le cas où le dernier retour OP18/OP28 serait perdu parce que la
campagne se termine ou ne dispose plus de budget de décision. Le retour est
réglé, mais aucune nouvelle action n’est demandée.

Une erreur dans `observe()` est propagée comme erreur Worker et empêche
`decide()`.

## Worker par défaut

`src/runtime/v6-agent-worker.ts` utilise désormais
`V6CommonCampaignDecisionPort` par défaut.

Révision :
`reconstruction-common-campaign-op18-op28`.

Comportement prudent :

- une action publique simple unique peut suivre OP28 ;
- ACTION6 ne peut venir que d’un FieldStock explicitement revalidé ;
- plusieurs propositions restent ambiguës ;
- aucune proposition ne déclenche aucun appel artificiel.

## OP28 démontrée

1. Une observation expose exactement une action simple admise.
2. L’owner OP28 produit la proposition.
3. Le propriétaire commun constate son unicité.
4. `releaseBundle()` appelle OP28.
5. `operationAdmission()` consomme le résultat.
6. Le Worker retourne l’action.
7. L’observation suivante est consommée avant la décision suivante.
8. Le retour est acquis avec le même `needId`.
9. Une observation `WIN` règle aussi ce retour puis s’arrête sans nouvelle
   décision.
10. Un budget nul règle aussi le retour puis s’arrête.

## OP18 démontrée

Avec un FieldStock courant revalidé :

1. la première proposition produit ACTION6 vers `(3,1)` ;
2. OP18 autorise l’action et conserve le `needId` ;
3. le retour montre le matériau déplacé en `(3,1)` ;
4. `afterStock()` confirme ;
5. `recordStock()` enregistre le déplacement ;
6. la proposition suivante produit ACTION6 vers `(4,1)`.

Le résultat change donc effectivement la décision suivante.

## Cas négatifs

- aucun prior → aucune ACTION6 inventée ;
- prior en attente → composants publics matérialisés puis revalidation ;
- plusieurs owners → `ambiguous`, aucune OP ;
- retour sans besoin en attente → rejet ;
- `needId` différent → rejet ;
- observation déjà consommée → traitement idempotent ;
- erreur d’observation → aucune décision ;
- observation terminale → retour consommé, aucune nouvelle proposition.

## Coexistence avec l’hôte browser/product

Le canonique contient aussi
`src/runtime/v6-browser-common-campaign-host.ts`, qui qualifie :

**GameObservation → AgentObservation → contextes owners → propriétaire commun →
Logos → AgentProductDispatch → BrowserGameRuntime → acquisition avant
présentation.**

Cet hôte direct conserve ACTION6 et ses coordonnées, annule les retours obsolètes
et refuse les observations produit périmées. Il reste inactif dans `main.ts`.

Le raccord Worker n’altère pas cet hôte et ne lui retire aucune responsabilité.
La prochaine architecture produit devra choisir explicitement le contrôleur
utilisé, sans faire exécuter deux propriétaires de campagne concurrents sur la
même session.

## Qualifications

### Qualification Worker sur la baseline précédente

Sur la baseline `8cc510e0` :

- run : `43348904523` ;
- job : `131634904435` ;
- commit : `08a04a9da59b0f385d080acf6091d4acdcf800c6` ;
- Node `22.18.0` ;
- `npm ci` réussi ;
- `npm run typecheck` réussi ;
- **304/304 tests réussis** ;
- aucun échec, annulation, test ignoré ou TODO.

### Qualification finale combinée

Sur la baseline canonique `edb19e24`, qui contient déjà l’hôte browser/product :

- run : `43349587061` ;
- job : `131637119489` ;
- commit qualifié : `a79aa291bd61cbbfd8c7a3579ca5df8afee06e90` ;
- Node `22.18.0` ;
- `npm ci` réussi ;
- `npm run typecheck` réussi ;
- régression TypeScript complète : **313/313 tests réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0`.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes, sont
signalées par `npm ci`. Cette tranche ne les introduit ni ne les modifie.

Le workflow temporaire de qualification est supprimé avant intégration
canonique.

## Limites conservées

- `main.ts` n’active ni l’hôte browser ni le Worker commun ;
- aucun contrôleur produit ne choisit encore explicitement entre ces deux seams ;
- l’acquisition initiale d’un prior FieldStock depuis une vraie campagne reste
  absente ;
- Region n’est pas enregistré dans le port Worker commun ;
- l’acquisition passive des owners non sélectionnés n’est pas orchestrée ;
- le snapshot/restauration du port Worker et de la décision en attente manque ;
- OP31 n’a toujours pas de propriétaire d’objectif produit ;
- la performance officielle A/B × STCK/SMLP sous `+10 %` par jeu n’est pas
  mesurée ;
- aucune parité exacte avec Site 109 / native 0.68 n’est revendiquée.

## Statut

**Le propriétaire commun est raccordé au Worker V6 reconstruit, en complément de
l’hôte browser/product canonique. Les retours OP18/OP28 sont corrélés au même
`needId`, y compris en terminaison, et FieldStock modifie la décision suivante.**

**Activation produit, choix d’un contrôleur unique, acquisition initiale,
Region commun, restauration et performance officielle restent ouverts.**
