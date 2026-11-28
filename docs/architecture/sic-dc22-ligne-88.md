# DC22, ligne 88 — accès par support reconfigurable

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.
Ligne 88 du catalogue, `support_navigation / reconfigurable_support`,
DC22 N1/T2, ACTION2. Reproduire le départ de N1 avec les budgets de
l’inventaire SIC. Isoler au T2 le besoin exact, le savoir déjà acquis,
la commande admise et la preuve effectivement produite à son retour.

1. Dans la suite officielle, suivre la route de support et un exemple
   d’intervention sur la configuration. Relier chaque déplacement à la
   pose, au pas et aux surfaces observées. Distinguer la réponse à une
   intervention de l’utilité de son résultat, qui dépend du contexte.
2. Rejouer une seconde configuration et contrôler le ticket et le retour.
   À préfixe et commande comparables, altérer la preuve de support ou son
   rattachement. Contrôler le premier refus ou changement d’offre avant
   de tirer une conclusion d’accès. Séparer les variantes construites des
   faits du jeu officiel.
3. Si les mesures, la qualification du préfixe et la reprise du gel
   suffisent, livrer des tests et le dossier sans modification de moteur.
   Un éventuel changement devra correspondre à une lacune causale
   reproduite. Compter la ligne 88 une seule fois.

## Départ et réutilisation au gel

Le service natif repart de N1 avec un budget de 16 gestes. À T1,
`acquire_control_for_target` envoie ACTION1. Son retour montre une
translation unitaire du corps, un carré 2×2 de couleur 14, et permet
de réidentifier son homologue fixe. Le fond de couleur 2 est mesuré
sous le corps. T2 est le premier ticket `support_navigation /
reconfigurable_support`. ACTION2 vise un déplacement encore inconnu,
avec une arrivée non prédite. Le corps passe de (10,38) à (10,40).
`recordExisting` acquiert le déplacement `[2,0]` en ordre
ligne-colonne, un pas de support, et lie le reçu à la paire
d'observations. T3 et T4 étalonnent les autres entrées.

| Gestes | Ce qui qualifie le préfixe | Retour et décision suivante |
|---|---|---|
| T5–T6 | Les empreintes et surfaces rectangulaires sont alignées sur la maille 2×2. La surface sous le porteur provient des pixels observés lors d'une translation. Le parcours accessible améliore la distance à la cible. | ACTION1 puis ACTION4 atteignent (10,38) puis (12,38). Les positions prédites sont confirmées. Le trajet complet reste ouvert. |
| T7–T8 | Le front est bloqué. Le clic ACTION6 (48,19) est lié à un homologue du contrôle et aux motifs des cellules du contexte. La même commande est admissible une seconde fois avec une autre clé de contexte. | Le corps reste à (12,38). Le premier clic révèle notamment 80 pixels de couleur 5. Les deux modifient la répartition des couleurs 4 et 8 et produisent des reçus distincts. Le reçu d'intervention ferme sa question exacte avec une utilité encore inconnue. |
| T9 | Le contrôle à (48,36) ouvre un nouveau ticket. Le résultat prévu du corps porte encore sur sa pose inchangée. | Le retour échange notamment huit pixels 4→9 et huit pixels 9→4. Le nouveau calcul de support permet l'approche T10 par ACTION3 vers (10,38), puis T11 par ACTION1 vers (10,36). |
| T11–T16 | La case d'arrivée porte quatre pixels 9 avant T11. La garde contrôle encore la pose, l'époque, la commande disponible et la présence de la case dans les supports mesurés. | T11 confirme l'entrée dans la case. Les nouvelles poses rendent les pas suivants admissibles. Le préfixe observé n'établit pas l'arrivée à la cible finale. |

`SupportNavigation.propose` et `make` enchaînent l'étalonnage,
la tentative d'approche et le contrôle distant. Le calcul
`measureSupportNavigationDomain` est réellement appelé, avec les
mesures disponibles, mais ne livre pas de témoin complet pour cet
extrait. T5 et T10 prennent le parcours partiel construit par
`SupportNavigation.propose` sur les cellules de `geometry`.
`before` remesure les supports avant l'autorisation des pas. La
fermeture de l'expérience de contrôle vient de `recordExisting`,
avec un reçu daté de `measureRemoteSupportTransition`. La reprise
d'accès à T10 lit les nouvelles surfaces visibles. Elle ne nécessite
pas d'inférer une règle générale de transformation du matériau.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L128)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L114)
· [Acquisition](../../src/logos-engine/v6-support-navigation.ts?plain=1#L79)
· [Géométrie et proposition](../../src/logos-engine/v6-support-navigation.ts?plain=1#L113)
· [Calcul du domaine](../../src/logos-engine/v6-support-navigation-domain.ts?plain=1#L15)
· [Garde et reçu de position](../../src/logos-engine/v6-support-navigation.ts?plain=1#L217)

## Contre-épreuve physique et refus de l'ancien trajet

Deux parties officielles démarrent à N1. Dans la seconde, les gestes
T1 à T8 sont reproduits. On omet ensuite le clic (48,36) et on joue
ACTION3, comme dans l'approche nominale. Le corps retrouve (10,38),
tandis que la destination (10,36) porte [4,9,9,4], en ordre de lecture.
Avec le clic, la même destination porte [9,9,9,9]. Le pas ACTION1
recouvre les quatre pixels dans la partie nominale. Dans la seconde
partie soumise directement au jeu, il laisse le corps et la case en
place. Le test isolé de la garde présente ce second raster officiel
au préfixe nominal et obtient `support_binding_changed`. Ce contrôle
distingue le refus d'admission dans le moteur du refus de mouvement
dans le jeu. Le billet du scénario nominal conserve sa propre
observation.

## Reproduction

Sur la branche de caractérisation, depuis la racine du dépôt, avec
Node 24 et les actifs de jeu et Pyodide préparés sous `public/` :

```powershell
node --test tests/sic-dc22-line-88.test.ts
node --test tests/v6-support-navigation.test.ts
```

`SIC_DC22_GAME_ROOT` permet de lire les actifs depuis un autre
checkout. `SIC_DC22_ENGINE_ROOT` désigne le moteur du gel dans un
checkout distinct. Les deux tests utilisent le jeu officiel. Le
rejeu depuis N1, la comparaison du catalogue et la contre-épreuve
portent sur la ligne 88 seulement. Le dossier ajoute des assertions
sur le comportement déjà présent.

Les 16 premières décisions du rejeu de `8ce7ee35` concordent avec le
gel sur les tickets, le retour de décision et l'image publique.
La métadonnée `palette` diffère entre révisions. Les 15 occurrences
catalogue de T2 à T16 sont retrouvées. Les tests de caractérisation
passent 2/2 sur le jeu réel, les contrats de navigation 102/102.
Premier préfixe complet à 23:06:05, critères figés à 23:06:10 et
verdict local à 23:09:34 (UTC−3). Le transfert et le verdict du Banc
restent à établir.
