# OP01–OP31 — réconciliation Lot 5 et chaîne FieldStock → OP18

Date : 12 novembre 2026

Branche canonique relue :
`recovery/site109-reconstruction-20261112` au commit
`cb0006a80f3552eed9d4e5255feed94c83dc4fa0`.

Branche de travail :
`op01-op31-c1-c2-public-observation-op28-20261112`.

## Avancement canonique détecté

Pendant la tranche OP28, la branche canonique a avancé de 49 commits depuis
`b093f406c07b5e3e14124a4e99dfcd5ea9f34ffd`.

L'intégration principale est le Lot 5 « addressed material retention and
FieldStock ». La branche de travail a été réconciliée en conservant la branche
canonique comme premier parent, sans force ni écrasement.

## Nouveaux composants pertinents

### Runtime propriétaire

`src/runtime/observed-addressed-material-runtime.ts`

Il possède l'état de rétention adressée et impose la distinction entre :

- connaissance locale active ;
- connaissance retenue en attente de revalidation ;
- stock revalidé sur la scène courante ;
- connaissance retenue mais non applicable ;
- réfutation.

Aucune rétention seule ne donne d'autorité d'action. `proposeStock()`,
`beforeStock()`, `afterStock()` et `recordStock()` restent indisponibles tant
qu'un `FieldStock` courant n'a pas été revalidé.

### Producteur FieldStock

`src/logos-engine/field-stock.ts`

La chaîne spécialisée produit :

- des corps typés mesurés dans la frame publique ;
- des demandes et zones adressées ;
- des obligations de préservation ;
- un plan borné à 16 pas maximum ;
- une expérience fermée au premier rewrite inconnu ;
- des actions ACTION6 avec coordonnées mesurées ;
- une composition `information_question` ;
- un `bundle_template.operation_key = OP18` ;
- un outcome guard portant sur la composition produite.

Le producteur ne propose rien lorsque l'action adressée n'est pas disponible,
lorsque le stock courant n'est pas revalidé ou lorsque l'accès/rewrite reste
sans proposition admissible.

### Retour et révision spécialisés

Le même `FieldStock` fournit :

- `before()` : revalidation de l'époque, de l'observation, du stock et des corps
  attendus avant chaque pas ;
- `after()` : comparaison du stock stable attendu et observé, avec scellement du
  préfixe en cas d'inconnu, de divergence ou de frontière officielle ;
- `record()` : observation d'un déplacement ou rewrite, conservation de
  l'origine, confirmation de règle, enregistrement d'échec ou réfutation de la
  famille si le contexte observé change.

Ces fonctions assurent déjà une partie des besoins OP29/OP30 sous forme
spécialisée. Aucun appel générique supplémentaire n'est ajouté pour dupliquer
ce travail.

## Chaîne OP18 qualifiée

### Besoin identifié

Un stock adressé a été retenu puis revalidé dans la scène courante. Une demande
typée manque dans une zone officielle et une action ACTION6 adressée est
publiquement disponible.

### Données produites

`FieldStock.propose()` produit :

- une question ouverte mesurable ;
- une composition non observée ;
- un plan borné ;
- des actions coordonnées ;
- les faits requis ;
- les preuves de scène et d'observation ;
- un bundle OP18 avec garde de résultat.

### Appel justifié

`releaseBundle()` reconnaît la composition comme question ouverte non observée,
émet le besoin `exploration-question` et appelle OP18.

### Résultat

OP18 retourne la référence de la composition lorsque la question, les preuves et
la composition sont cohérentes dans l'état fourni.

### Consommateur

`operationAdmission()` consomme réellement ce résultat et compare l'outcome
guard au résultat OP18.

### Effet sur la décision

La release des actions ACTION6 du plan FieldStock est autorisée uniquement si :

- le bundle est encore valide à la révision courante ;
- OP18 sélectionne la composition attendue ;
- la garde d'admission accepte le résultat.

Disposition OP18 :

**raccordable maintenant dans le runtime Lot 5 et consommée comme garde de
release ; raccord navigateur/worker général encore manquant.**

## Instrumentation C1 ajoutée

Nouveau test :
`tests/op01-op31-field-stock-op18-trace.test.ts`.

Il démontre :

1. besoin présent → `need` → OP18 exécutée → `consumption` par
   `operationAdmission` ;
2. même `needId` sur les trois événements ;
3. résultat OP18 consommé → `releaseAllowed = true` ;
4. action adressée absente → aucun proposal et aucun appel OP ;
5. révision d'observation modifiée → ancien bundle rejeté comme stale avant
   l'opération, avec seulement le besoin déjà identifié dans la trace.

Cette preuve complète le test Lot 5 existant qui vérifiait déjà l'admission du
bundle FieldStock par l'autorité OP18.

## Distinction avec la tranche OP28

Deux contrats réels et distincts sont maintenant présents :

- **OP18 / FieldStock** : exploration adressée produite par un mécanisme
  symbolique spécialisé, avec question, préservation, coordonnées et retour
  spécialisé ;
- **OP28 / action publique unique** : réalisation bornée d'une seule action
  simple complète dans le worker reconstruit.

OP18 est la chaîne symbolique la plus riche. La tranche OP28 reste utile pour
raccorder le worker public sans inventer de perception générale, mais ne remplace
pas FieldStock et ne justifie aucune activation lorsque plusieurs choix existent.

## Qualification GitHub Actions

Workflow temporaire de branche :
`.github/workflows/op01-op31-c1-c2-qualification.yml`.

Exécution réussie :

- run : `43342264179` ;
- commit qualifié : `6bf46db33eb238c432ace2179af43af7c95688c9` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **269/269 tests réussis**.

Le workflow temporaire a ensuite été supprimé de la branche. Il ne sera pas
intégré dans la branche canonique.

## Statut des OP prioritaires

| OP | Statut après réconciliation | Portée exacte |
| --- | --- | --- |
| OP18 | **raccordable maintenant** | producteur FieldStock réel → autorité → OP18 → garde → actions ; host worker/browser général absent |
| OP28 | **raccordable maintenant sous condition stricte** | contrat action publique simple unique → OP28 → garde → action worker |
| OP29 | **déjà assuré par fonction spécialisée** pour FieldStock et Region ; générique sans consommateur produit | comparaison avant/après spécialisée modifie la suite |
| OP30 | **déjà assuré par fonction spécialisée** pour FieldStock et Region ; générique persisted_only | règles, échecs ou réfutations modifient les propositions futures |
| OP31 | **appel existant sans consommateur démontré** | aucun propriétaire d'objectif produit |
| OP03/08/12/26 | **bloqué ou recouvert partiellement par fonctions spécialisées** | aucun appel générique runtime supplémentaire justifié |

## Performance

Aucun benchmark synthétique n'est promu comme officiel.

Statut :

**fonctionnellement qualifié, performance officielle à confirmer**.

La clôture exige toujours les runners natifs qualifiés A/STCK, A/SMLP, B/STCK
et B/SMLP, les jeux séparés et un global strictement inférieur à +10 % par jeu.

## Prochaine étape

Raccorder un propriétaire commun de campagne qui :

1. reçoit l'observation publique du jeu ;
2. alimente le runtime spécialisé pertinent ;
3. choisit entre propositions sans fusionner artificiellement leurs autorités ;
4. transmet le bundle sélectionné au worker/dispatch ;
5. corrèle le retour à la proposition et au `needId` ;
6. route le retour vers `after()/record()` ou le consommateur générique exact ;
7. montre l'effet sur la proposition ou décision suivante.
