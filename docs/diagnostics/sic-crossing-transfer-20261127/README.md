# Continuation d’une interface de lignes croisées — 27 novembre 2026

## Première perte observée

La capture publique part du niveau 1, dans une seule session SIC, sur le commit
`0a87f48af56a7d3ad72983b9fa15cfbeb4621cee`. Ses 33 commandes et le préfixe du score
du niveau 1 sont identiques au bilan complet de référence `4a546a13`.

Le niveau 1 établit deux commandes d’axes et une relation de croisement, puis
marque le score en 27 commandes. Au niveau 2, les quatre premiers gestes de
`sic_verify_crossing_rows` sélectionnent une ligne, en remplissent deux cases,
puis observent une commande sans effet. La famille n’est pas réfutée et sa
dernière référence est encore exactement celle de l’observation courante.

À la commande globale 32, la re-proposition du programme natif offre `ACTION2`
pour la troisième case. L’arbitrage choisit pourtant le preview `ACTION1`.
Celui-ci remplit réellement la case, mais la mémoire de lignes conserve le
progrès 2 et sa référence précédente. Le geste suivant s’appuie donc sur une
progression devenue obsolète. `diagnostic-report.json` fournit les références
exactes et les compteurs avant et après cette perte.

## Correction bornée

L’entrée de continuation précède le preview seulement lorsque le rôle de
croisement a été conservé au score officiel précédent, que le scope, l’époque
et le score correspondent, qu’un progrès a déjà été observé dans l’interface
courante, et que la dernière preuve est l’observation actuelle. La référence,
l’unicité des contrôles, la couleur et la position du contrôle sélectionné,
ainsi qu’une commande apprise disponible sont re-mesurées. La proposition
existante choisit ensuite le geste et en contrôle le retour. L’acquisition
ordinaire reste disponible lorsque ce rôle manque.

La correction ne modifie ni le modèle de croisement, ni les plafonds. Les preuves
des paires et de la frontière officielle accompagnent les propositions
transférées. Un retour contradictoire retire cette priorité sans effacer les
connaissances antérieures.

## Preuves et limites

`baseline-public.json.gz` conserve tous les rasters publics avant/après, leurs
animations, les commandes et les états du rôle concerné. Les listes d’entités
dérivées des pixels, les traces globales redondantes et les mémoires des autres
familles sont omises ; cette projection est signalée dans le fichier. Le rapport
conserve les SHA-256 de la capture originale, de la projection décodée et du
collecteur. `capture-crossing-edges.mjs` est la copie exacte du collecteur de ce
diagnostic, avec ses chemins locaux d’origine conservés.

La capture s’arrête volontairement après six commandes du niveau 2. Le refus
de dispatch qui matérialise cette borne apparaît comme un état `error` dans
l’agent ; il ne constitue pas un verdict de campagne. Cette capture n’est ni
une qualification chronométrique, ni une victoire complète du jeu.

Les tests du rôle utilisent deux interfaces natives indépendantes : formes,
mailles, palettes, positions, côtés et commandes changent. Elles acquièrent les
relations dans leur premier niveau puis les réemploient au suivant, avec le
véritable ordre de groupes. Des interfaces ambiguës, une commande absente, une
référence absente et un retour contradictoire doivent refuser la continuation.
Une contre-épreuve sur la vraie capture vérifie aussi l’absence du rôle, les
preuves étrangères, l’époque, le score et la référence périmée.

Les 7 tests ciblés passent et le contrôle TypeScript se termine avec le code 0.
Les journaux et les empreintes des fichiers concernés sont conservés dans ce lot.

## Rejeu strict du candidat

Le runner standard a rejoué le commit local `d9a296b1`, identique par son arbre
au commit GitHub `667ddb2a`, depuis le niveau 1 en une session SIC et un worker.
Le jeu reste **incomplet : 2 niveaux gagnés sur 6**, en 84 commandes exécutées,
autorisées par SIC et réconciliées. Aucun reset ni undo n’a été utilisé.

| Niveau | Commandes | Plafond commandes | Score mesuré | Plafond temps | Résultat |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 27 | 33 | 6 399 ms | 16 000 ms | Gagné, préfixe identique au témoin |
| 2 | 28 | 34 | 8 157 ms | 18 000 ms | Gagné |
| 3 | 29 | 29 | absent | 18 000 ms | Arrêt au plafond de commandes |

Les niveaux 4 à 6 ne sont pas atteints. La première différence avec le témoin
est exactement la commande globale 32, celle du diagnostic. Le troisième niveau
perd de nouveau la priorité après une sélection de pastille alternative ; aucune
cause supplémentaire n’est qualifiée sans sa capture publique.

`strict-report.json` résume le résultat ; les bruts, le miroir des niveaux, les
empreintes de source et le reçu de fin sont archivés. Le miroir correspond
exactement aux trois niveaux du résultat. La source est restée propre et inchangée.
La capture initiale utilisait une borne totale de 67 commandes, supérieure au
budget nécessaire à chaque appel : les plafonds transmis au planificateur étaient
bien 33 puis 34, sans réduction de `remaining`.

La continuité complète, l’intégration et la vérification dans le viewer restent
à effectuer pour ce lot. Il ne fait pas partie des jeux entièrement corrigés.
