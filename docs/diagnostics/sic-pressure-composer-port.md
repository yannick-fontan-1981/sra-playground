# Portage du composeur d’effets sur la réserve de pression

## Contrat avant modification

Base moteur `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`. Pilote `145b8c764477fe913709e999747a0f8db125d060`. Le premier appelant est `choosePressureReserve`, utilisé par le fournisseur natif `createSicPublicInputExploration`. La recherche de réserve/bâtissage/sortie est le seul raccord. La première commande justifiée et sa projection restent l’interface du fournisseur.

Les retours publics distinguent l’ouverture et la fermeture du passage, l’occupation de la marque par une charge et le changement d’une charge en appui. Les commandes de déplacement proviennent des vecteurs déjà acquis. Une route de sortie garde le poids sur sa marque. Le moteur confronte au retour la position de l’acteur, les charges et les appuis. Une divergence refuse seulement le couple position/commande documenté. Les preuves des autres relations restent utilisables.

### Attendus préenregistrés

| Cas | Attendu |
| --- | --- |
| SS05 et SS11 depuis L1, même mode `sic`, un travailleur et budgets historiques | Même première offre et même trajectoire enregistrée que sur la base pour les décisions exercées. Comparer les commandes, l’attribution, les retours enregistrés et les fins de niveau. |
| SS05, deux préfixes publics qui apprennent la fermeture et l’appui dans des ordres opposés | Le retour de fermeture borne l’ouverture après le départ de l’acteur. Après la récupération et avec les mêmes preuves, le trajet réserve une charge, bâtit l’appui et traverse en conservant le poids. Retirer la preuve de fermeture retient la route de récupération. |
| SS05, retour de mouvement réel comparé à une projection changée | La projection initiale est confirmée par le retour. La projection altérée est contredite, et seule la transition à cette position est refusée. Il s’agit d’une perturbation de l’entrée de décision avec le retour réel comme témoin. |
| Fixture de projection à fenêtre finie | La traversée admise à temps reste possible. Une ouverture qui expire avant ou pendant la commande ne suffit pas. Ce délai explicite est un contrôle construit. |
| Limites de recherche | Le premier préfixe suit l’ordre des commandes du fournisseur. La recherche examine au plus 7 500 positions distinctes comme sur la base. Un but déjà vrai au départ ne crée pas de commande. |

Une différence sur les sorties nominales demande une localisation avant de pouvoir être attribuée au portage. Les cas construits et les cas natifs obtiennent des verdicts distincts.

## Raccordement et API

Le pilote installe le composeur sur plusieurs recherches natives. Le moteur commun a poursuivi séparément les modifications des passages appariés et du transport de charge, notamment `1f5f03f0`, `604ebad0` et `4708a860`. Le portage s’appuie sur la projection et les gardes du fichier `src/sic/observed-pressure-reserve.ts` à `0aef4289`. Son seul remplacement est la file de recherche dans `choosePressureReserve`. La priorité des fournisseurs, la branche d’essai de fermeture, l’acquisition, les refus et l’autorisation native restent ceux du moteur commun.

`composePlan<State, Action>(problem)` prend un état initial, une clé, un but nommé, un générateur d’effets en ordre de préférence et deux bornes. Un effet décrit la commande, l’état projeté, des préconditions `requires`, des conditions à maintenir `maintains`, des postconditions `ensures` et les références disponibles. Les éventuels échantillons `during` sont fournis par l’appelant. La recherche en largeur contrôle les conditions avant de dédupliquer par clé et renvoie le premier plan minimal, son état final et le nombre d’états examinés. La clé doit donc conserver les variables qui changent les suites possibles, par exemple la durée restante dans le cas construit. Le premier raccord n’utilise ni dominance de ressources ni énumération de plans supplémentaires.

Dans SS05, la condition de pression doit être satisfaite en sortie de chaque déplacement de bâtissage et de traversée. Elle devient un invariant lorsque la charge tient déjà la marque. La recherche conserve le cas historique où le premier déplacement la place sur la marque. Elle transmet uniquement le premier effet au fournisseur sous la forme `PressurePlan` existante. Le fournisseur ferme la décision après son retour et l’acquisition refuse la transition sur la pose considérée si le retour la contredit. Le test de seuil vérifie sur une petite borne que la dernière position examinée peut encore satisfaire le but. L’adaptateur fixe cette borne à 7 500 et conserve l’ordre des quatre directions.

## Résultats appariés

| Parcours | Base | Portage | Portée du constat |
| --- | --- | --- | --- |
| SS05 depuis L1, agenda complet | 1 niveau, 36 commandes, arrêt sur cible | identique | Effets, attribution et trajectoire identiques. L’agenda prend son chemin de portage local plutôt que la réserve ciblée. |
| SS11 depuis L1, agenda complet | 0 niveau, 80 commandes, plafond de session | identique | Effets et trajectoire identiques au plafond. |
| SS05, appui T6 puis porte fermée T14 | 32 commandes après reprise, gain L1 | identique | Les projections et leurs preuves concordent, sur les couleurs natives. |
| SS05, porte fermée T6 puis appui T12 | 32 commandes après reprise, gain L1 | identique | Les projections et leurs preuves concordent, avec permutation de palette pour la perception. |

Les deux préfixes guidés jouent des commandes publiques sur le moteur de SS05. Ils apprennent les faits sur les retours réels, puis reprennent le fournisseur natif `createSicPublicInputExploration.propose` avec l’état appris et jouent ses commandes. Dans ce contrôle ciblé, le retour de fermeture atteste la fin de l’ouverture quand l’acteur libère la marque. Après récupération, retirer seulement cette preuve rend la route de récupération indisponible. Le cas de projection contraire garde le vrai paquet en retour et change seulement la pose attendue. Le fournisseur répond `pressure_projection_contradicted` et clôt la décision. La route cesse de proposer la même transition sur cette pose en conservant les autres preuves.

La fenêtre exprimée en nombre de tours est testée sur un état construit. Les échantillons projetés au début, pendant et après une commande montrent la frontière du contrat. Aucune durée chronométrée n’est inférée sur SS05. Les deux préfixes SS05 exercent un même mécanisme, avec ordre des acquisitions et palette différents. Les résultats bornent le portage à ce fournisseur et ne qualifient pas un transfert sur une nouvelle mécanique.

## Rejouer

Node 24 depuis la racine du checkout candidat pour les tests. Pour rejouer les deux préfixes sur le gel, recopier le fichier de test du candidat dans un checkout figé à `0aef4289` et exécuter le même test de fournisseur. Comparer les deux diagnostics `projectionsSHA256`.

```powershell
node --test tests/sic-effect-composer.test.ts tests/sic-observed-pressure-reserve.test.ts
```

Pour la partie autonome, utiliser la même commande dans chaque checkout avec un chemin de sortie neuf, puis comparer depuis le candidat. Le budget inclut le plafond documenté pour le niveau cible. Le comparateur retient les effets ordonnés, les résultats, les récupérations, les séries et les empreintes de trajectoire.

```powershell
$env:SIC_REPLAY_REFERENCES = 'docs/architecture/sic-replay-reference-levels-20261126.json'
node scripts/check-sic-chronological.mjs SS05,SS11 1 $receipt 1 sic
node scripts/compare-sic-pressure-composer.mjs $referenceReceipt $candidateReceipt
```
