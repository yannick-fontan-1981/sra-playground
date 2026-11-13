# OP01–OP31 — contrôleur produit explicite du mode Agent

Date : 12 novembre 2026

Branche de travail :
`recovery/op01-op31-agent-mode-controller-20261112`

Baseline canonique de départ :
`4bf27669ce8f2945aa7672f134ffe1cefcac35ae`

Canonique réconcilié avant qualification finale :
`67602172665b79e2b282b37b63f80dc24feff3b0`

Commit de réconciliation sur la branche :
`d8c5e2bd3595798031d07611b4de7992834ef679`

Documents associés :

- `docs/migration/op01-op31-verification-plan.md` ;
- `docs/migration/op01-op31-progress.md` ;
- `docs/recovery/op01-op31-common-campaign-owner-20261112.md` ;
- `docs/recovery/op01-op31-browser-campaign-host-20261112.md` ;
- `docs/recovery/op01-op31-worker-common-campaign-20261112.md`.

## Objectif

Activer dans le produit un seul seam Agent explicitement choisi, sans modifier
le chemin Manual et sans faire exécuter simultanément l’hôte browser et le
Worker sur la même session.

Le seam produit retenu pour cette première activation est :

`browser-common-campaign`

Il instancie uniquement
`createPublicSingleActionBrowserCampaignHost()` et donc le propriétaire public
OP28 strict. Le Worker commun reste qualifié mais inactif dans `main.ts`.

Cette activation est volontairement présentée comme un aperçu borné, pas comme
le SRA complet.

## Composant ajouté

### `src/runtime/v6-agent-mode-controller.ts`

`V6AgentModeController` possède la session Agent du produit et impose :

- un seul seam déclaré à la construction ;
- une seule campagne en cours ;
- une borne d’actions, fixée à 64 dans `main.ts` ;
- des phases explicites `idle`, `ready`, `running`, `stopped`, `disposed` ;
- l’arrêt sur `none`, `ambiguous`, `blocked`, terminal, game over, refus de
  dispatch, obsolescence, erreur ou borne atteinte ;
- aucun fallback lorsqu’aucune proposition n’existe ;
- l’annulation sur retour au mode Manual ;
- l’annulation lors d’un changement de jeu ou de niveau ;
- la protection de la propriété `busy` lorsqu’une nouvelle génération de jeu a
  remplacé l’ancienne ;
- la conservation de la première cause réelle d’arrêt ;
- la destruction explicite au `pagehide`.

Une seconde demande d’exécution pendant qu’une campagne possède déjà la session
retourne `busy` sans lancer une autre boucle.

## Raccord produit

`src/main.ts` instancie maintenant :

```ts
new V6AgentModeController({
  seam: 'browser-common-campaign',
  host: createPublicSingleActionBrowserCampaignHost(),
  maxSteps: 64,
})
```

La campagne ne démarre jamais automatiquement au changement d’onglet. Elle
requiert le bouton explicite **Run bounded agent**.

Ordre produit :

1. le jeu est chargé normalement ;
2. l’utilisateur sélectionne le mode Agent ;
3. l’utilisateur démarre la campagne bornée ;
4. une session unique est créée pour le jeu et la génération courants ;
5. l’hôte OP28 strict prépare au plus une action simple publiquement unique ;
6. `AgentProductDispatch` exécute l’action ;
7. le retour est acquis avant présentation ;
8. le contrôleur recommence seulement si la campagne reste applicable ;
9. il s’arrête sans deviner dès que le domaine n’est plus unique.

Le bouton est désactivé lorsque :

- le mode Agent n’est pas actif ;
- le produit est occupé, en chargement ou en échec ;
- l’observation est terminale ;
- une campagne possède déjà la session.

## Séparation Manual / Agent

Le chemin Manual historique reste inchangé :

- les clics et boutons humains passent toujours par `run()` puis
  `dispatchProductAction()` ;
- `run()` refuse toujours toute action lorsque `mode !== 'manual'` ;
- aucune action Manual ne traverse le contrôleur Agent.

Inversement :

- le passage Agent → Manual appelle `stop('manual')` ;
- un changement de jeu ou de niveau appelle `stop('game-change')` ;
- une réponse en vol de l’ancienne session devient obsolète ;
- l’ancienne boucle ne peut ni acquérir ni présenter un retour dans la nouvelle
  sélection.

Le Worker commun n’est pas instancié par `main.ts`. Il ne peut donc pas entrer en
concurrence avec le seam browser actif.

## Présentation honnête

`AGENT_STATUS` devient :

```ts
{
  available: true,
  name: 'SRA',
  status: 'browser-common-campaign-op28-preview',
}
```

L’interface indique explicitement que :

- seul le fallback public OP28 strict est actif ;
- il faut exactement une action simple publique unique ;
- ACTION6 n’est pas inventée ;
- plusieurs propositions ou aucune proposition arrêtent la campagne ;
- les producteurs symboliques plus larges restent en reconstruction.

## Tests ajoutés

### `tests/v6-agent-mode-controller.test.ts`

Les tests couvrent :

- propriété d’un seam unique ;
- arrêt `none` sans fallback ;
- borne dure du nombre d’actions ;
- refus d’une deuxième campagne concurrente ;
- annulation Manual d’une action en vol ;
- non-libération du `busy` appartenant à une génération plus récente ;
- arrêt terminal avant nouvelle demande ;
- attente réessayable lorsque le produit n’est pas prêt ;
- conservation de la vraie cause d’arrêt ;
- arrêt sur erreur ;
- destruction et refus d’une session tardive ;
- détection des états terminaux publics.

### `tests/main-agent-mode-controller-integration.test.ts`

Les tests statiques vérifient :

- un seul seam browser explicitement sélectionné ;
- absence du Worker commun dans `main.ts` ;
- démarrage uniquement depuis le bouton Agent ;
- aucune exécution automatique depuis `setMode()` ;
- annulation par Manual et changement de jeu ;
- conservation du dispatch Manual historique ;
- libellé public honnête de l’aperçu OP28.

## Qualification

Qualification avant la dernière réconciliation canonique :

- run GitHub Actions : `43351837880` ;
- job : `131644504939` ;
- commit qualifié : `1ac5067d58adede51443da270b2f2b75ef6f0c9b` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression complète : **325/325 tests réussis** ;
- `npm run build` : réussi ;
- échecs, annulations, tests ignorés et TODO : `0`.

Une qualification finale est exécutée après la réconciliation avec
`67602172665b79e2b282b37b63f80dc24feff3b0` et la consolidation documentaire.

Deux vulnérabilités de dépendances de sévérité haute déjà présentes restent
signalées par `npm ci`. Cette tranche ne les introduit ni ne les corrige.

## Performance

Le contrôleur est maintenant activable dans le produit, mais seulement sur
commande explicite dans l’onglet Agent. Le chemin Manual ne paie aucun cycle du
contrôleur tant que ce mode n’est pas lancé.

Cela ne clôt pas C7. Le coût officiel doit encore être mesuré sur les quatre
runners A/STCK, A/SMLP, B/STCK et B/SMLP, jeux séparés, avec une augmentation de
médiane strictement inférieure à 10 % pour chaque jeu.

## Limites conservées

- seul OP28 public strict est activé dans le produit ;
- le Worker commun reste inactif dans `main.ts` ;
- FieldStock browser n’a pas encore de constructeur de contexte initial ;
- aucun prior FieldStock réel n’est acquis par cette UI ;
- Region ne possède pas encore de candidat physique complet enregistré dans la
  campagne commune ;
- les acquisitions passives multi-owners ne sont pas orchestrées ;
- snapshot/restauration de la campagne produit en attente reste absent ;
- OP31 n’a pas de propriétaire d’objectif produit ;
- les états non représentables par le protocole Agent restent refusés ;
- la performance officielle C7 reste ouverte ;
- aucune publication Site n’est réalisée dans cette tranche.

## Statut

**Le produit possède maintenant un contrôleur Agent explicite, unique, borné et
séparé du mode Manual. Il active uniquement le seam browser OP28 public strict
et s’arrête au lieu d’inventer une décision.**

**FieldStock browser, Region commun, acquisition passive, restauration, OP31 et
performance officielle restent ouverts.**
