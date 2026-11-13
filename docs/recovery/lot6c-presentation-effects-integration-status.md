# Lot 6C — raccordement réel des effets de présentation dans `main.ts`

Branche finale de travail :
`recovery/lot6c-presentation-effects-integration-rebased-20261112`

Baseline de rebase :
`recovery/site109-reconstruction-20261112` à `6c56a4e4fda6459019e4164f2cbd01ca329de208`.

## Objectif

Raccorder le chemin produit réel de `src/main.ts` au séquenceur d'effets déjà qualifié :

`present() → presentProductObservation() → ports DOM/état réels`

Le raccordement remplace le corps impératif dupliqué sans modifier les règles déjà qualifiées de frames, timing, stale-check, feedback ou propriété de `busy`.

## Raccordement produit

`main.ts` fournit désormais les propriétaires et effets réels suivants :

- génération de sélection courante ;
- génération de présentation courante ;
- incrément de la génération de présentation ;
- code du jeu sélectionné ;
- adoption de l'observation ;
- remise à zéro de `loading` et `failed` ;
- synchronisation `game` / `level` dans l'URL ;
- `updateInterface()` ;
- `paint()` ;
- attente via `window.setTimeout()` ;
- écriture de `busy` ;
- feedback dans `#game-feedback` ;
- propagation de `fallbackPalette` et de `releaseBusy`.

Le chemin dispatch conserve `releaseBusy=false` afin que `dispatchProductAction()` reste propriétaire de la libération finale de `busy`.

## Qualification

### Première qualification de raccordement

Après une première tentative rejetée à cause d'une ancienne assertion structurelle et du mode TypeScript strip-only, le protocole a été corrigé sans modifier le comportement du port.

Run GitHub Actions réussi : `43345328500`.

Résultats :

- typecheck : PASS ;
- suite Lot 6C ciblée : **46/46 PASS** ;
- régression TypeScript complète : **273/273 PASS** ;
- `git diff --check` : PASS ;
- commit automatique du vrai `main.ts` : `de54d0174585b93e7fcd8c25bfbd0d41b2138c78`.

### Rebase sur la baseline canonique courante

Pendant la première qualification, la branche canonique a avancé de 14 commits. La comparaison a montré que ces commits ne modifiaient aucun des trois fichiers Lot 6C concernés.

Les blobs qualifiés ont été reportés sur une branche neuve issue de `6c56a4e4fda6459019e4164f2cbd01ca329de208` :

- `src/main.ts` ;
- `tests/main-product-dispatch-integration.test.ts` ;
- `tests/main-product-presentation-effects-integration.test.ts`.

Commit de report : `94a5b3d78d0494f5505fab0e4ce5db0764dbe440`.

Run de qualification rebasée réussi : `43345846614`.

Résultats rebasés :

- typecheck : PASS ;
- suite Lot 6C ciblée : **46/46 PASS** ;
- régression TypeScript complète : **273/273 PASS** ;
- dépôt propre et `git diff --check` : PASS.

L'outillage GitHub Actions temporaire et le script de transformation temporaire ont été supprimés avant intégration canonique.

## Preuves structurelles nouvelles

Quatre gardes vérifient que :

1. `main.ts` délègue à `presentProductObservation()` ;
2. les propriétaires réels de génération et de jeu sont transmis ;
3. les effets DOM et d'état historiques sont préservés ;
4. `main.ts` ne duplique plus les règles déterministes de frames, durée, stale-check et feedback.

L'ancien contrat dispatch a également été actualisé pour vérifier la propriété de `busy` à travers le nouveau port.

## Limites

- aucun vrai jeu n'a été démarré ;
- aucun payload GABA ou KLOT n'a été rouvert ;
- aucune session navigateur réelle n'a été lancée dans cette étape ;
- aucune publication Site ;
- aucune mesure officielle STCK/SMLP.

`npm ci` signale deux vulnérabilités de dépendances de sévérité élevée déjà présentes dans l'arbre installé ; elles ne sont pas corrigées dans ce lot fonctionnel et doivent être traitées séparément avec revue d'impact.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

## Prochaine étape

Qualifier le raccordement dans un navigateur compilé ou un hôte DOM contrôlé, puis restaurer le protocole officiel de performance avant toute décision de publication.
