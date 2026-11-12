# Lot 10D — contrat TemporalSelection reconstruit

Date : 2026-11-12

Ce document décrit le **premier composant de code reconstruit** du Lot 10D depuis la baseline GitHub canonique.

Il ne prétend pas être une copie de l'ancien `v6-temporal-selection.ts` perdu avec le runtime Site 109.

## Sources durables utilisées

### `compiled_selection_tree.py`

Chemin :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/runtime/compiled_selection_tree.py`

Invariants repris :

- l'exécuteur de sélection est fail-closed ;
- il compile un arbre borné à 1..8 étapes ;
- une exécution directe exige l'autorité exacte du registre Source ;
- une non-sélection DRM reste une non-sélection, sans activité inventée ;
- une référence sélectionnée doit appartenir au domaine canonique projeté ;
- les alternatives déclarées restent préservées ;
- les gros retours de coordination restent chez leur propriétaire Source ;
- une sélection ne crée pas par elle-même une action.

### `continue_after_information_probe.src`

Chemin :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/continue_after_information_probe.src`

Invariants repris :

- un retour courant est consommé avant une reprise dégradée ;
- un retour est consommé une seule fois ;
- les autres stratégies admises restent disponibles ;
- l'épuisement est limité aux prémisses exactes ;
- une réentrée ne libère jamais ACT.

### `release_action.src`

Chemin :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/release_action.src`

Invariant retenu pour la séparation des responsabilités :

- la sélection n'est pas une autorité ACT ;
- la libération d'une action appartient à une chaîne distincte de commitment, viabilité, contrôle courant, mémoire, continuité parentale et sécurité.

## Fichiers reconstruits

- `src/logos-engine/v6-temporal-selection-contract.ts`
- `tests/v6-temporal-selection-contract.test.ts`

Le composant actuel valide une enveloppe de sélection et projette un résultat déjà produit par un propriétaire Source/DRM.

Il **ne contient aucune politique qui choisit elle-même un candidat**.

## Comportements verrouillés par les tests

1. refus d'une autorité Source incohérente ;
2. conservation du domaine complet des alternatives ;
3. refus des identités de candidats dupliquées ;
4. refus de consommer deux fois le même retour ;
5. non-sélection explicite en cas de résultat non résolu ;
6. refus d'une référence extérieure au domaine Source ;
7. projection de la référence sélectionnée avec ses preuves, sans autoriser ACT.

## Test exécuté

Commande locale de qualification :

`node --experimental-strip-types --test tests/v6-temporal-selection-contract.test.ts`

Résultat :

- 7 tests ;
- 7 réussis ;
- 0 échec.

Le premier essai sans `--experimental-strip-types` a échoué avant chargement du test car Node 22.16 ne reconnaissait pas directement l'extension `.ts`. Cette erreur d'environnement est conservée comme diagnostic ; elle ne constitue pas un échec du contrat.

## Ce qui n'est toujours pas reconstruit

- la politique TemporalSelection historique ;
- les états historiques `measurement/edit/pending/response` ;
- le mécanisme exact de proposition point/lateral/launch ;
- le raccord au caller/runtime natif ;
- le worker navigateur ;
- les fixtures et captures historiques 10D ;
- le harness officiel de coût.

Ces éléments seront reconstruits seulement lorsqu'un donneur ou contrat durable permet d'établir leur sémantique.

## Prochaine borne

La prochaine étape doit définir **l'état minimal de mémoire temporelle** à partir de preuves durables.

Avant d'ajouter un champ, il faut pouvoir répondre :

1. quel producteur l'acquiert ;
2. quel retour ou observation le justifie ;
3. sa portée épisode/niveau/observation ;
4. sa règle de restauration ;
5. quel consommateur le lit ;
6. quel effet il peut avoir sur une proposition ;
7. quelle autorité distincte libère éventuellement l'action.

Tant que ces réponses ne sont pas établies, le champ n'est pas ajouté au port.
