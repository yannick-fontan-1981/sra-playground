# OP01–OP31 — raccord Worker du propriétaire commun

Date : 12 novembre 2026

Branche de travail :
`recovery/lot5b-worker-common-campaign-20261112`

Baseline canonique intégrée :
`8cc510e0a0d09704eb508b3aa2216b4d63482af4`

Commit de réconciliation avec la baseline :
`3ad3328df6b85f4fc0e1f534fd4bf138efbca359`

Commit fonctionnel qualifié :
`08a04a9da59b0f385d080acf6091d4acdcf800c6`

Document parent :
`docs/recovery/op01-op31-common-campaign-owner-20261112.md`

## Objectif

Raccorder le `CommonCampaignOwner` déjà qualifié au Worker V6 reconstruit sans
ajouter de classement arbitraire, de perception cachée, de coordonnées ACTION6
inventées ni de faux prior FieldStock.

La chaîne obtenue est :

**AgentObservation publique → mesure publique → retour de l’action précédente →
frontière officielle → revalidation éventuelle → propositions propriétaires →
sélection neutre → OP18 ou OP28 → action → observation suivante corrélée au même
`needId`.**

## Composants raccordés

### `v6-public-observation-measurement.ts`

La couche de mesure :

- copie l’observation publique du Worker ;
- vérifie l’image exacte 64×64 ;
- refuse les valeurs de palette hors `[0, 15]` ;
- construit une identité déterministe à partir de la session et de la séquence ;
- conserve niveau, progression, état et actions publiques ;
- ne matérialise les composants 4-connexes que lorsqu’un prior FieldStock doit
  être revalidé.

Cette matérialisation différée évite d’imposer le coût de segmentation au chemin
OP28 simple. Aucun masque engine, rôle caché, fixture privée ou coordonnée non
publique n’est utilisé.

### `v6-common-campaign-decision-port.ts`

Le port persistant du Worker :

- possède le `CommonCampaignOwner` canonique ;
- enregistre les owners OP18 FieldStock et OP28 action publique unique ;
- accepte des owners supplémentaires sans les classer ;
- acquiert le retour en attente avant toute nouvelle proposition ;
- conserve le même `needId` de la release au retour ;
- franchit ensuite la frontière officielle ;
- revalide le prior FieldStock uniquement dans une scène non terminale ;
- demande enfin la proposition suivante ;
- renvoie `undefined` pour `none`, `ambiguous` ou `blocked`.

Le port par défaut ne reçoit aucun prior FieldStock artificiel. ACTION6 seule ne
produit donc aucune action tant qu’une connaissance retenue explicite n’a pas été
revalidée dans la scène courante.

### `v6-agent-worker-core.ts`

Le contrat `AgentDecisionPort` possède maintenant un hook facultatif
`observe()` distinct de `decide()`.

Le cœur Worker consomme toute observation publique validée avant :

- l’arrêt terminal `WIN` ;
- l’arrêt pour budget non positif ;
- la demande d’une nouvelle décision.

Cette séparation ferme un défaut important : le dernier retour d’une action
OP18 ou OP28 n’est plus perdu lorsque l’observation suivante est terminale ou
lorsqu’aucun budget de décision ne reste. Le retour est réglé, mais aucune
nouvelle action n’est demandée.

### `v6-agent-worker.ts`

Le port par défaut du Worker reconstruit est maintenant
`V6CommonCampaignDecisionPort`.

Révision déclarée :
`reconstruction-common-campaign-op18-op28`.

Le Worker reste prudent :

- action publique simple unique → chemin OP28 possible ;
- ACTION6 → uniquement via FieldStock explicitement revalidé ;
- plusieurs propositions → ambiguïté, aucune OP ni action ;
- aucune proposition → aucun appel artificiel.

## Chaîne OP28 démontrée

1. Une observation publique expose exactement une action simple admise.
2. L’owner OP28 produit la proposition.
3. Le propriétaire commun constate l’unicité.
4. `releaseBundle()` produit le besoin et appelle OP28.
5. `operationAdmission()` consomme le résultat.
6. Le Worker retourne l’action.
7. L’observation suivante est consommée avant la décision suivante.
8. Le retour est acquis avec le même `needId`.
9. Une observation `WIN` règle également ce retour, puis le Worker s’arrête sans
   nouvelle décision.
10. Un budget de décision nul règle également le retour, puis s’arrête sans
    nouvelle décision.

## Chaîne OP18 démontrée

Le scénario de test possède un FieldStock courant revalidé :

1. le premier appel produit ACTION6 vers `(3,1)` ;
2. OP18 est appelée et l’action reste corrélée au `needId` ;
3. l’observation suivante montre le matériau déplacé en `(3,1)` ;
4. `afterStock()` confirme le résultat ;
5. `recordStock()` enregistre le déplacement typé ;
6. la proposition suivante produit ACTION6 vers `(4,1)`.

Le résultat est donc consommé avant la décision suivante et modifie cette
décision.

## Cas négatifs préservés

- aucune connaissance retenue → aucune ACTION6 inventée ;
- prior en attente → composants publics matérialisés puis revalidation ;
- plusieurs owners proposant une action → `ambiguous`, aucune OP ;
- retour sans besoin en attente → rejet par le propriétaire canonique ;
- `needId` différent → rejet ;
- observation déjà consommée directement par le port → traitement idempotent ;
- erreur du hook `observe()` → erreur Worker explicite, aucun appel à
  `decide()` ;
- observation terminale → retour consommé, aucune nouvelle proposition.

## Qualification finale

GitHub Actions :

- run : `43348904523` ;
- job : `131634904435` ;
- commit qualifié : `08a04a9da59b0f385d080acf6091d4acdcf800c6` ;
- baseline canonique intégrée :
  `8cc510e0a0d09704eb508b3aa2216b4d63482af4` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **304/304 tests réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0`.

Le workflow temporaire de qualification est retiré avant intégration canonique.

## Limites conservées

- `main.ts` ne crée pas encore une campagne SRA live autour du Worker ;
- aucun dispatch produit complet ne relie encore la décision Worker à
  `BrowserGameRuntime` puis son retour au même Worker ;
- l’acquisition initiale d’un prior FieldStock depuis une vraie campagne
  navigateur reste absente ;
- Region n’est pas enregistré dans ce port tant qu’il ne produit pas un candidat
  public complet `AgentAction + CompositionBundle + état + identity` ;
- l’acquisition passive par des owners non sélectionnés n’est pas orchestrée ;
- le snapshot/restauration du port, de l’observation courante et de la décision
  en attente reste absent ;
- OP31 n’a toujours pas de propriétaire d’objectif produit ;
- la performance officielle A/B × STCK/SMLP strictement sous `+10 %` par jeu
  n’est pas encore mesurée ;
- aucune équivalence exacte avec Site 109 / native 0.68 n’est revendiquée.

## Statut

**Le propriétaire commun est maintenant raccordé au Worker V6 reconstruit. Les
chaînes OP18 et OP28 possèdent une observation publique, une autorisation Logos,
une action, un retour corrélé au même `needId`, y compris en terminaison, et un
consommateur réel.**

**Le raccord produit live, l’acquisition initiale FieldStock, Region commun, la
restauration et la performance officielle restent ouverts.**
