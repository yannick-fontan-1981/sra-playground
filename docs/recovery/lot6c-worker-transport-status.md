# Lot 6C — qualification du transport Worker navigateur

Branche de travail :
`recovery/lot6c-worker-transport-20261112`

Baseline de départ :
`recovery/site109-reconstruction-20261112` à `e082f05ae2d7ce9d539aec0df80f01c6e89388eb`.

## Travail

Cette étape qualifie le transport asynchrone réel de `BrowserGameRuntime` sans démarrer de jeu.

### Runtime

`BrowserGameRuntime` conserve ses valeurs de production par défaut mais accepte désormais des dépendances optionnelles pour :
- créer le Worker ;
- programmer/annuler les timeouts ;
- régler la durée de timeout.

Cette injection sert uniquement à rendre le transport déterministe et testable. Le constructeur sans argument conserve :
- le Worker `./game-worker.ts` ;
- le nom `sra-games` ;
- les timers navigateur ;
- le timeout historique de 120000 ms.

Le traitement des réponses rejette désormais explicitement tout résultat sans `code` ni `gameCode`.

## Correspondance avec le worker réel

`src/runtime/game-worker.ts` consomme :
`{ id, request }`

et retourne :
- `{ id, result }`, ou
- `{ id, error }`.

Les tests sont alignés sur cette enveloppe existante ; aucun protocole fictif n'a été introduit.

## Tests exécutés localement

### Mapping action — 3/3 PASS

- action simple sans `data` ;
- ACTION6 avec coordonnées ;
- ACTION6 avec coordonnées zéro.

### Transport Worker — 9/9 PASS

- enveloppe `{id, request}` et normalisation `code → gameCode` ;
- réponses hors ordre corrélées au bon identifiant ;
- identifiant inconnu ignoré ;
- erreur applicative rejetée seulement pour la requête correspondante ;
- réponse sans résultat ni erreur rejetée ;
- `messageerror` rejette tous les pending, annule les timers et termine le Worker ;
- timeout rejette les pending, termine le Worker et ignore une réponse tardive ;
- `dispose()` rejette les pending, annule le timer et interdit les requêtes futures ;
- après une erreur Worker, une nouvelle requête crée un Worker neuf ;
- un résultat sans identité de jeu est rejeté comme invalide.

Total frais sur le runtime concerné : **12/12 PASS**.

## Typecheck

Typecheck strict de `src/runtime/browser-games.ts` : **PASS**.

## Portée

- aucun vrai jeu démarré ;
- aucun payload GABA/KLOT rouvert ;
- aucun changement du protocole `game-worker.ts` ;
- aucune publication Site ;
- aucune mesure officielle STCK/SMLP.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.


## Rebase canonique

Pendant la qualification, la baseline canonique a avancé de quatre commits, de `e082f05ae2d7ce9d539aec0df80f01c6e89388eb` à `d8dad121f6563aabc6b5b08ee65c606c4889a94e`.

La comparaison montre que ces quatre commits ne touchent que :
- `docs/migration/op01-op31-progress.md` ;
- `docs/recovery/op01-op31-core-coverage-status.md` ;
- `tests/v6-operations.test.ts`.

Aucun fichier Lot 6C n'est en conflit. Les fichiers qualifiés ont donc été reportés sans modification sur la nouvelle branche dérivée du head canonique :

`recovery/lot6c-worker-transport-rebased-20261112`.

La qualification 12/12 + typecheck reste applicable car le code Lot 6C reporté est byte-identique au code testé.
