# KEYD, ligne 38 — de la ressource visible à l'accès acquis

## Critères du lot nominal

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Rejeu depuis
N1, graine 0 et maximum 16 gestes. La ligne 38 est
`public_observed_inventory / observed_inventory_composition /
public_inventory_composition`. Le premier [témoin SKBN](https://github.com/yannick-fontan-1981/sra-playground/blob/fa126d653aa5e123f9de78c220e9e6129a6436a2/docs/architecture/sic-skbn-ligne-38.md)
montrait deux approches contredites à l'arrivée. Vérifier ce que KEYD
ajoute avec le même producteur.

- Suivre l'approche du matériau jusqu'au vrai essai T5, puis la
  signature détenue qui lie la proposition d'accès. Mesurer
  séparément le changement du support, la position du corps et la
  disparition du signe affiché.
- Identifier la paire de références, l'époque, le sujet et l'objectif
  de l'accès acquis au T8. Suivre ce que ce reçu permet au T9, avec
  son plan et son retour.
- Retirer la seule preuve d'accès dans la vue réelle du T9 et suivre
  le vrai repli. Comparer les propriétaires et les justifications si
  le service libère encore la même direction.
- Traiter séparément les références présentes mais liées à une
  autre transition. Consigner la paire exacte, les préfixes égaux et
  la première décision à faire diverger avant tout correctif.

Le reçu de repérage partagé a l'empreinte
`0f41bf06f7d367c3bfd21193b44910cf24195c8fa744f29861028590d1d60a98`.
Il atteste 16 tickets de la ligne sur KEYD et deux sur SKBN, sur
31 occurrences de catalogue, dans leurs fenêtres respectives.

## Le vrai retour et sa reprise

Le gel et `8ce7ee35` retrouvent les 16 décisions et les 16 retours
de KEYD depuis N1 avec un plafond de 16. Les 17 observations
concordent hors métadonnées de palette. Sans score officiel à cette
borne, le trajet confirme tout de même un accès local.

| Moment | Preuve active | Suite dans le vrai service |
| --- | --- | --- |
| T1–T4 | Masque de source visible et complément compatible. `approach_candidate` rapproche le corps, avec quatre retours confirmés. | `acquisition_probe_candidate` prend la main à la source. |
| T5, ACTION5 | L'essai à la source compare une vraie réponse sans prédiction de pose vérifiée. | `CellProjection.record` mesure `unique_corresponding_transfer`. La signature projetée est une hypothèse de possession. |
| T6–T8 | `access_probe_candidate` revalide le signe détenu dans [43,58,47,61] et son complément unique en [24,6,28,10]. | Au T8, ACTION4 déplace le corps de [20,7,22,9] à [25,7,27,9], modifie onze pixels de la case en dehors du corps et fait disparaître le signe. |
| T9–T16 | La paire exacte de révisions 8→9 décrit un `local_access_return` pour `G_official_completion`, toujours en N1. `capacity_targets` utilise aussi une marque reliée visuellement à la jauge courante. | `capacity_probe_candidate` propose un nouvel essai. ACTION4 au T9 a un retour physique confirmé et amène le corps en [30,7,32,9]. Les capacités de la ressource, sa consommation universelle et sa règle terminale restent inconnues. |

`access_measurements` exige le corps avant et après, la présence
du signe courant, la destination exacte et les pixels du
compartiment. `ObservedInventory.recordSource` acquiert le reçu
seulement avec le retour confirmé d'un plan d'accès et
l'interprétation unique de la mesure. `ObservedInventory.project`
cherche ensuite un reçu actif dans l'époque courante.
`capacity_targets` exige une jauge de l'observation courante et
une marque rattachable à une unique case. Ce sont des preuves
distinctes de la destination locale acquise.

Sur le vrai N1/T9, le retrait du seul reçu conserve l'observation
et le propriétaire. La même ACTION4 est libérée, maintenant comme
`endpoint_approach_candidate` de rôle inconnu. Son vrai retour
relance le même déplacement. Le type de plan et la portée du
geste distinguent donc l'offre d'accès acquise du repli.

## Première divergence attendue du correctif

Le gel accepte la sonde de capacité au T9 avec une paire remplacée.
Le Banc substitue la seule fin, en remplaçant 8→9 par 8→6. L'opérateur
substitue la paire entière du déplacement précédent, 7→8, dont le
retour n'acquiert aucun accès. Les références sont authentiques.
Les variantes conservent le raster, l'observation courante, la
commande et le résultat physique du T9.

Le premier écart attendu porte sur le type de la proposition au T9.
Avec le vrai reçu 8→9, le service conserve `capacity_probe_candidate`
et ses références. Avec 8→6 ou 7→8, il doit reprendre
`endpoint_approach_candidate`, comme pour l'absence de reçu. Les
deux variantes doivent encore libérer ACTION4, déplacer exclusivement
le même corps jusqu'en [30,7,32,9] et conserver le score. Les
tickets 1 à 8 et le reçu authentique acquis au T8 doivent rester
identiques. Les 16 décisions et retours sans substitution sont
le contrôle de parité.

Une référence courante et une référence historique résoluble
sont nécessaires à plusieurs familles. Pour KEYD, l'événement
acquis doit être le retour du plan d'accès, avec la paire attestée
par le propriétaire et la preuve de position, de partition et de
disparition de la signature. Lire ces éléments dans le chemin
d'acquisition permet de conserver les autres règles de provenance du
moteur. [Contre-épreuve opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/4efefe02ae9b33bf811659c7a621505ea3f473d3/experiments/symbolic-situations/skbn-ligne-38/BILAN.md)

## Raccord candidat

Le moteur natif utilise l'événement `observed_inventory_event` déjà
consigné pour la révision antérieure par le propriétaire du ticket.
Il compare la référence postérieure à celle attachée à la
consignation. `ObservedInventory.project` conserve le reçu de
travail seulement s'il correspond au contenu de l'accès acquis et
à l'époque courante. La mémoire de transition, les formes de reçus
et la mesure d'accès restent celles du gel.

Les quatre tests du service exercent le parcours nominal, le
retrait et les deux substitutions. La comparaison intégrale des
captures KEYD retrouve les 16 offres, 16 retours et 17 observations
à l'identique. Sur SKBN, le préfixe des 16 mêmes gestes et ses
17 observations concordent également. Le statut d'une nouvelle
qualification indépendante reste distinct du constat local.

Le contrôle de provenance commun consiste à retrouver la transition
dont le propriétaire a acquis le fait. Ici il faut retrouver la
partition, la disparition du signe et le retour d'accès, avec le
corps déjà identifié par le plan. Pour ISOS, le contenu à corroborer
est le passage officiel et sa méthode. Pour WEAV, il s'agit de
l'événement de croisement précis. Chaque fournisseur conserve son
lecteur de contenu.

## Reproduction du nominal, du retrait et des substitutions

Node 24, avec `SIC_KEYD_GAME_ROOT` pour le checkout qui contient
Pyodide et les archives officielles. L'option
`SIC_KEYD_ENGINE_ROOT` rejoue contre un autre moteur.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-keyd-line-38.test.ts
```

[Test du service](../../tests/sic-keyd-line-38.test.ts) ·
[Propriétaire](../../src/logos-engine/v6-observed-inventory.ts) ·
[Accès et réemploi](../../src/logos-engine/v6-inventory-continuation.ts)
