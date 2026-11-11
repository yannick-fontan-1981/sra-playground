# Pré-déclaration de validation 6B après intégration de Site 103

## Portée de cette préparation

Plan établi par lecture des sources et des déclarations de validation. **Aucun test,
audit, rejeu, import natif, calcul d’empreinte de fixture ou jeu n’a été exécuté pour
ce plan. Aucune observation ou donnée de jeu KLOT n’a été ouverte.** La fusion est
en cours ; cette note ne certifie pas son résultat.

Le prédécesseur effectivement publié est Site 103 / native 0.62, source
`4afcbfe6a25bd3a88223be543e443bc53b9c8814`. La clôture finale 6B restera liée au
prédécesseur 5C / 0.63 effectivement publié lorsque celui-ci sera disponible.

## Vérification ciblée immédiate de l’horloge

Après résolution des conflits, la commande minimale porte sur deux fichiers :

```bash
node --test --test-concurrency=1 --test-reporter=tap tests/v6-native-runtime.test.ts tests/v6-selected-rigid-integration.test.ts
```

La faire enregistrer par le wrapper d’exécution habituel avec ses entrées et sa
sortie complètes. Aucun filtre de nom ne remplace l’exécution entière de ces deux
modules.

Le premier fichier conserve les deux cas publiés de conversion entre origines
d’horloge, dans les deux sens : budget initial de 50 ms, 40 ms restant à la garde,
refus après expiration et absence de renouvellement du délai expiré par `resume`.
L’identité du signal d’annulation et de la fonction de coopération est contrôlée.
Le second doit vérifier le même contrat à travers le véritable adaptateur
SelectedRigid, puis conserver le scénario de longue pause inactive, la limite de
temps actif et l’acquisition unique lors du scellement du préfixe. Un cas générique
qui passe ne dispense pas du cas du propriétaire réellement raccordé.

## Budget et capture à préserver

Le contexte transmis doit conserver la formule publiée :
`runtimeNow + min(remainingActiveMs, callerDeadline - callerNow)`, avec saturation
à zéro, et porter le quota courant d’actions du niveau. Le quota de niveau et la
longueur de préfixe restent deux valeurs distinctes.

Le rafraîchissement `setCurrentBudget` doit rester dans l’adaptateur de famille,
**avant** l’appel au `before` du propriétaire brut. Le journal existant capture
alors un setter racine suivi de la garde ; il conserve les deux formes imbriquées
admises, `propose → setCurrentBudget` et `before → bind`. Ajouter un setter dans le
`before` brut changerait le contrat de capture et serait refusé par
`scripts/verify-selected-rigid-presence.py` et le lecteur froid actuel.

Le collecteur `tests/helpers/capture-selected-rigid.ts` ne lit aucune horloge : il
conserve le descripteur du setter et les lectures déjà consommées par le
propriétaire. Le lecteur `scripts/compare-selected-rigid-public-parity.py` réutilise
le délai converti capturé et ancre son horloge Python écoulée sur la première
lecture observée. L’intégration 0.62 ne justifie donc ni nouvelle normalisation des
horloges ni modification rétroactive des rapports. Il faut vérifier dans la nouvelle
capture : aucun appel d’horloge non rattaché, aucun défaut d’observation, continuité
des contextes et refus effectif lorsque le délai courant est épuisé.

## Périmètre de tests déclaré avant exécution

Pour l’intégration Site 103, le périmètre déterministe comprend **139 fichiers** :

1. Les 133 chemins exacts de `testFiles` dans
   `docs/migration/lot7b-evidence/followup-recovery/contract/test-scope-final.json`.
2. L’union avec les 44 chemins réellement exécutés de `testFiles` dans
   `docs/migration/lot10b-evidence/recovery-20261111/integrated-final-02/validation/delta-tests-run.json`.
   Cette union ajoute seulement `tests/v6-window-question-reference.test.ts` et
   `tests/v6-window-question-kernel.test.ts`.
3. Les quatre modules SelectedRigid : `v6-selected-rigid-native.test.ts`,
   `v6-selected-rigid-reference.test.ts`, `v6-selected-rigid-integration.test.ts` et
   `v6-selected-rigid-capture.test.ts`, tous sous `tests/`.
4. Exclusion explicite des quatre modules fermés :
   `tests/v6-ranked-workshop-reference.test.ts`,
   `tests/v6-ranked-workshop-kernel.test.ts`,
   `tests/v6-symbol-transactions-kernel.test.ts` et
   `tests/v6-framed-transfer-reference.test.ts`. Le dernier charge son corpus au
   niveau du module ; un filtre de noms ne suffit pas à l’exclure. Ces quatre
   chemins sont absents de l’union de 139 fichiers ; ils ne sont pas comptés comme
   des tests ignorés ou réussis.

Le gel final devra matérialiser cette liste ordonnée et ses empreintes avant la
commande `scripts/verify-native-delta.py GEL --tests ...`. Après intégration du
5C réellement publié, ajouter préalablement ses modules nouveaux ou modifiés
nécessaires, avec un amendement explicite et un nouveau compte ; **139 est la base
Site 103 déclarée ici, pas un effectif final anticipé de 0.64**. Conserver les tests
synthétiques Workshop et Window inclus dans les déclarations précédentes. Les
résultats historiques ne deviennent pas des réussites du nouveau gel.

Restaurer au préalable les fixtures exactes requises avec
`python -B scripts/evidence-byte-parts.py restore tests/fixtures` si elles manquent.
Les cinq contrôles habituels restent distincts : TypeScript, audit des entrées,
audit de migration, vérification du diff et build. L’audit de migration doit sortir
en échec sur ses erreurs sémantiques, conformément au garde corrigé de 6B.

## Rejeux de non-régression déclarés

Conserver les **11 lignes exactes** de
`docs/migration/lot7b-evidence/followup-recovery/contract/regression-cases-final.json`.
Ses dix lignes communes sont identiques à celles de
`docs/migration/lot10b-evidence/recorded-regression-cases.json` : CATR, RSWP, FOGW,
VOIS, CONN, MIND, WEAV, TRIA, CRAF et ISOS. La onzième ligne est KATA, avec ses
références publiées 6A inchangées et son libellé historique de provenance conservé.
Le comparateur garde **17 contrôles par cas, soit 187 contrôles attendus**.

Une seule exécution à la fois (`--workers 1`) et le plafond existant de 1 536 Mio
pour les rejeux préservent le mode ayant réussi. Ce plafond n’est pas transféré aux
mesures officielles. Utiliser le driver déclaré, de nouveaux chemins de sortie et
le gel effectivement exécuté ; conserver tout arrêt et toute différence. Ces
rejeux consomment des retours archivés, ne constituent pas de nouvelles victoires,
ne rouvrent pas LKEY et ne prouvent pas à eux seuls l’état du propriétaire ajouté.
Le lecteur de présence SelectedRigid et la fidélité source restent des contrôles
supplémentaires sur les rapports réellement produits. Les réserves HPDL partielles
de 10B restent historiques ; ce plan n’autorise aucune nouvelle campagne HPDL.

## Ancienne preuve KLOT et preuve du candidat intégré

Les résultats KLOT antérieurs restent attribués à leur gel de développement. Ils
ne prouvent pas que Site 103 contient SelectedRigid et ne deviennent pas des
résultats du candidat fusionné. Le lecteur Python vérifie le composant et les
observations capturées ; il ne compare pas les fichiers TypeScript actuels au
manifeste natif du rapport.

La clôture intégrée exige donc une capture liée au gel final, ses budgets courants,
la chaîne sélection → commande → retour → acquisition → restauration, les faits
`null` conservés, puis le lecteur original froid et ses deux qualifications
négatives. Toute réutilisation d’une preuve antérieure exige une identité explicite
des entrées pertinentes ; aucune équivalence d’horloge n’est présumée. Toute
activité fondée sur KLOT, y compris les diagnostics et la QA, doit être débitée du
même registre cumulatif existant. Pour limiter les reprises, terminer la préparation
statique et les tests ciblés avant d’engager la qualification du gel final.

Le coût officiel attend le prédécesseur effectivement publié et une nouvelle
fenêtre isolée : médiane de session complète strictement sous +10 % pour chacun des
jeux déclarés ; les dépassements de phase restent visibles et ne se compensent pas
entre jeux.
