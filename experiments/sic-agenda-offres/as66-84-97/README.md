# AS66 · glissade vers la cavité et accès horlogé

La ligne **84** conduit le corps à un arrêt calculé sur la surface courante. La ligne **97** autorise un accès dont certains gestes laissent le corps immobile pendant que le masque se déplace. Les deux offres visent la même cavité. Les preuves qui les autorisent et les contrôles de retour sont différents.

## Provenance des deux parcours

Le catalogue de `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` et le gel des 107 jeux `d0e7527ca8033bd805a6d7a8bb021eff62e87021` constituent les deux références d’exécution. L’inventaire publié à `2a17e14b` donne les tickets, les résultats et les nombres d’occurrences. Il laisse l’URL et le budget de la session ciblée d’origine inconnus. Le Banc a reproduit séparément les deux réglages à `47ae8531`. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Préparation du Banc](https://github.com/yannick-fontan-1981/sra-playground/blob/47ae8531/docs/diagnostics/sic-preparation-as66-84-97.md)

| Parcours depuis L1, ouverture native | Résultat et attribution |
|---|---|
| Catalogue avec plafond de session de 16, 600 par niveau | 16 gestes, deux niveaux terminés. Sept tickets de 84 aux T5 et T8–13. Au T14, la frontière essaie `ACTION2`. |
| Entrée publique `qualifyActionCoverage`, pack par défaut, boucle de trois niveaux, 600 par niveau, plafond de session omis | Trois niveaux terminés en 19 gestes. Six tickets de 97, dont le premier provient d’une nouvelle offre et les cinq suivants continuent le plan. |

Le pilote de couverture s’arrête après trois niveaux. Le service de navigation reçoit les neuf plafonds du jeu. Sans maximum de session explicite, il utilise leur somme puis applique le plafond du niveau courant. Le réglage du worker ajoute l’agenda de familles par défaut `active` au pack natif. Le service reçoit la même configuration dans l’opérateur hors ligne. Les paquets issus du jeu et les commandes des deux parcours concordent pour T1–13. [Pilote historique](https://github.com/yannick-fontan-1981/sra-playground/blob/8ce7ee35/tests/helpers/sic-qualification.ts) · [Service](../../../src/runtime/v6-agent-service.ts) · [Worker](../../../src/runtime/v6-agent-worker.ts)

## Ligne 84 · accéder à l’arrêt calculé

| Pré-événement ou variation | Offre locale, ticket et retour |
|---|---|
| N1/T5. Le mouvement d’`ACTION2` au T2 établit le sens [1,0] et une loi d’arrêt. `ACTION3` donne [0,−1]. Le corps se trouve en (24,26), la cavité en (24,38) et la mesure lie leur surface. | `sliding_cavity_access / ACTION2`, indice 0. Arrêt prévu en (24,38). Le jeu termine N1. Le reçu donne `matched:null / official_boundary` et scelle le pas. |
| Même observation T5, retrait du sens d’`ACTION2` sur une copie de la mémoire. | La famille s’abstient. Retirer le sens d’`ACTION3` conserve l’accès. Retirer seulement la mémoire des arrêts conserve aussi l’accès ici, car la mesure courante fournit encore un chemin. |
| Même service, retrait de la seule offre d’accès T5 sur le candidat. | La frontière essaie `ACTION3`. La famille réémet un accès au T6. Sur le gel, le point de retrait de l’offre statique complète n’existe pas. |
| N2/T8. Les observations des sondes T6/T7 ont renseigné les sens d’`ACTION1` et d’`ACTION4`. | Une nouvelle offre projette quatre gestes. `ACTION1` vise (40,30), la comparaison réussit et le service poursuit à l’indice 1. Effacer le sens d’`ACTION4` redonne une question sur cette commande. Effacer les arrêts mémorisés suspend l’offre dans ce contexte. |

**Part du gel.** `measureOpenCavityStopGeometry` produit la géométrie et la route, `advanceCavitySlide` calcule les arrêts. Le service émet le ticket et confronte son retour. Ces comportements sont déjà observables au gel. **Part du candidat.** `SlidingCavity.proposeAccess` sépare l’offre statique complète de la question de direction et de l’offre temporelle. Le retrait natif de la seule offre au T5 et sa réutilisation au T8 éprouvent ce raccord. Les tickets de direction des T6 et T7 relèvent du dossier 83. [Famille](../../../src/logos-engine/v6-sliding-cavity.ts) · [Mesure](../../../src/logos-engine/v6-cavity-measurements.ts) · [Projection](../../../src/logos-engine/v6-cavity-kinematics.ts)

## Ligne 97 · utiliser la phase avant le mouvement

Les accès statiques T12 et T13 donnent chacun `matched:false`. Les mêmes retours apportent pourtant deux mesures positives du masque de 12 × 12. Après `ACTION2` puis `ACTION3`, il occupe (16,6) puis (20,6). Le motif est identique et sa translation de (+4,0) précède le déplacement de l’acteur dans les deux animations. Les références sont celles des révisions 13 et 14. Le producteur contrôle les pixels du masque actuel et maintient deux hypothèses de rebond. [Acquisition et prévision](../../../src/logos-engine/v6-cavity-clock.ts)

| Variation ou retour | Décision vérifiée |
|---|---|
| N3/T14, mêmes mesures et plateau, restant de 3 au catalogue ou de 598 sans plafond global explicite | La famille s’abstient au catalogue. À horizon suffisant, elle propose `ACTION1, ACTION1, ACTION1, ACTION1, ACTION4, ACTION1`. Sur une copie du même pré-événement, les horizons 1 à 5 échouent et 6 suffit. |
| Garder une seule mesure, attribuer les deux à la même commande ou décaler d’un pixel la dernière position mesurée | Chacune des trois variations suspend l’offre horlogée. |
| Retirer seulement le sens d’`ACTION1` au T14 du parcours de couverture | La famille propose encore `ACTION1`, cette fois comme `cavity_direction_question` avec effet inconnu. Le nom de commande seul confondrait acquisition et accès horlogé. |
| Retirer le producteur temporel pour un tour dans le service | Au T14, la frontière choisit `ACTION2`. Au T15 la famille propose un nouvel accès horlogé, indice 0. |
| Retour réel du préfixe | Cinq comparaisons de plateaux réussissent. Après T16, seule la seconde hypothèse de rebond est encore compatible. Le retour T19 termine N3 et donne `matched:false`, puis le plan est scellé. |
| Après le vrai ticket T14, présenter au service le plateau précédent au lieu du résultat visible du jeu | Le reçu perd les deux hypothèses et scelle immédiatement le pas. Le service propose à nouveau `ACTION1` au T15, indice 0. Le fichier conserve les empreintes distinctes du plateau reçu du jeu et de celui présenté. |

**Attribution 97.** Le gel appelle et consomme déjà `CavityClock.propose` avant l’accès statique. Son résultat peut être retiré isolément. La garde du plateau complet, la comparaison après exécution et l’interruption de la suite sont natives. Le candidat 84 conserve les six tickets ainsi que leurs retours. [Comparaison des projections](../../../src/logos-engine/v6-sliding-cavity.ts)

## Rejeu opérateur

Depuis la racine du checkout, avec Node 24+, Git, tar et le paquet Pyodide local du Banc :

```powershell
$d = 'experiments/sic-agenda-offres/as66-84-97'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/as66-qualification.json"
& "$d/lancer.ps1" operateur --moteur gel --fiche "$d/public/couverture.json" --pyodide $py --recu "$env:TEMP/as66-couverture.json"
```

Le vérificateur exerce douze préfixes du vrai jeu dans le service natif. Les fiches `sic.as66/1` indiquent le plafond de session, la coupure de lecture, les tours à examiner localement et une éventuelle intervention opérateur. Le jeu renvoie ses paquets publics après réception de chaque ticket. Les variantes locales partent de copies indépendantes de `SlidingCavity.state()`. Le reçu sépare la mémoire avant l’appel (empreinte vérifiée), l’offre de la famille, la commande autorisée et le retour. Les références de mesure des directions sont relevées par l’opérateur au moment de leur acquisition. Les résultats attendus résident dans le vérificateur. [Critères préenregistrés](ATTENDUS.md) · [Corpus modifiable](public) · [Opérateur](operateur.mjs) · [Assertions](verifier.mjs)

Le contrôle indépendant de 83 peut être exécuté avec Node 24 par `node experiments/sic-agenda-offres/as66-84-97/compatibilite83.mjs`. Il charge les tests et les deux fixtures de `1aaafe36` contre les sources de ce checkout. Les tests de base des deux producteurs se rejouent avec `node --test tests/v6-sliding-cavity.test.ts tests/sic-cavity-animation.test.ts`.

