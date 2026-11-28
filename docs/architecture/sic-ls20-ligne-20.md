# LS20, ligne 20 — essai morphologique

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. La ligne 20 du
catalogue désigne `morphology / morphology_probe`, LS20 N1/T7,
`ACTION3`. Repartir de N1 par la qualification SIC standard
(`strategy-inventory`, 16 gestes), puis suivre le retour et la reprise
dans une prolongation identifiée séparément.

- Vérifier sur les observations du gel quelle comparaison de formes est
  mesurée, quel fait décide de la voie admissible et quelles références
  bornent sa validité. Distinguer le déplacement du porteur de l'effet sur
  la paire et du point marqué.
- Retirer la preuve d'orientation à observation identique, puis présenter le
  même chemin sous une autre observation. Vérifier le résultat de la
  politique et la décision du service. Si un repli émet lui aussi ACTION3,
  attribuer son retour à son propre ticket.
- Chercher un second contexte dans le rejeu sur le même moteur. Relever la
  différence mesurée, le nouveau besoin, le trajet, le retour physique et
  la décision qui suit.
- Attribuer les résultats au gel si ses articulations suffisent. Le verdict
  local requiert la concordance des occurrences historiques, un retour
  mesuré dans les deux contextes et une contre-épreuve qui change
  l'admission. Une extraction éventuelle doit correspondre à un maillon
  causal manquant.

## Témoin du catalogue et reproduction

Le catalogue rattache la ligne 20 à `morphology / morphology_probe`.
Le bouton de qualification SIC standard sur LS20 part de N1 en mode
`native` avec un budget de 16 gestes. Le rapport termine sur
`session_action_budget` après 16 observations et aucun niveau marqué.
Les six premiers gestes relèvent de `acquire_control_for_target`, puis
les dix occurrences historiques de la ligne 20 sont retrouvées de T7 à
T16. Le premier ticket est N1/T7, ACTION3, OP18,
`change_one_pattern_to_test_alignment`. Le gel et le rejeu de
`8ce7ee3563fa1d5eca1639c6ad03975cfc962460` concordent sur les
16 commandes, leurs propriétaires, leurs types et leurs résultats
comparables. La comparaison des observations exclut la métadonnée
`palette`, qui diffère entre les deux révisions. La prolongation jusqu'à
T18 est une mesure supplémentaire. [Ligne 20](sic-v8-composition-des-98-strategies.md?plain=1#L60)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L46)
· [Entrée d'inventaire](../../tests/helpers/sic-qualification.ts?plain=1#L175)

## Preuves consommées et reprises sur le gel

| Geste | Preuve, besoin et ticket | Retour et suite |
|---|---|---|
| T7–T9 | La paire présente des masques homologues à des échelles 1 et 2, la même couleur et une différence d'orientation non ambiguë (un seul quart de tour relatif admissible, index 3). Le porteur a une position et des commandes attestées. La route `modifier` est rattachée à la paire, à l'observation courante, à l'époque et aux extrémités mesurées. La décision demande de tester un changement sélectif. ACTION3 puis deux ACTION1. | T7 confirme le passage de (24,45) à (19,45). Les deux gestes suivants confirment l'approche. Le reçu de T7 porte sur la position du porteur. |
| T10 | Dernier ACTION1 de la route, vers (19,30). Le ticket laisse le retour terminal à mesurer. | La paire est réidentifiée. Une seule forme a changé, avec le pair stable à (33,9)–(39,15). `record` associe le résultat à la clé de paire, à l'époque et à l'observation officielle de retour. La comparaison suivante mesure `aligned`, rotation relative 0, couleur toujours égale. |
| T11–T13 | Le fait `single_pattern_contact_change` cite le reçu exact de T10. L'alignement et un accès à départager ouvrent `peer_access_probe`. ACTION1, ACTION4 puis une nouvelle sonde ACTION4 à T13. | T11 confirme (19,30) → (19,25). T12 et T13 terminent leurs préfixes sur un retour à mesurer. À T14 le porteur est réobservé à (29,25), la preuve sélective est toujours celle de T10 et une route directe est désormais liée. |
| T14–T18 | Le même sélecteur consomme le nouveau chemin `peer` avec la paire alignée et le retour sélectif. ACTION4 à T14, puis ACTION1 à T15–T17. | T14 confirme (29,25) → (34,25). Le jeu marque le niveau au retour de T17. T18 ouvre en N2 une acquisition de contrôle propre au nouveau contexte. |

`morphologyPairs` extrait la paire. `measureMorphologyRoutes` produit
les résidus des masques, compare la couleur et l'orientation, rattache
la preuve sélective à l'époque et à la clé de paire, puis mesure les
routes depuis le contrôle observé. `NativeMorphologyPolicy.evaluate`
consomme l'orientation et les conditions de chaque route. La couleur
reste égale dans les deux contextes. `NativeMorphologyFamily.propose`
rend le préfixe désigné disponible au service. Sa garde `before`
vérifie la commande, l'empreinte du porteur, la surface de destination
et la portée du ticket. `after` compare les positions intermédiaires.
`record` mesure les effets terminaux. L'avancement du niveau vient de
l'observation officielle. [Mesure](../../src/logos-engine/v6-morphology-measurements.ts?plain=1#L347)
· [Politique et portée](../../src/logos-engine/v6-morphology-policy.ts?plain=1#L26)
· [Offre](../../src/logos-engine/v6-morphology-family.ts?plain=1#L96)
· [Garde](../../src/logos-engine/v6-morphology-family.ts?plain=1#L188)
· [Acquisition](../../src/logos-engine/v6-morphology-family.ts?plain=1#L253)

## Contre-épreuves construites

Les deux mutations de T7 s'appliquent à l'entrée de la politique après
le même préfixe officiel. L'observation, le porteur et la commande du
chemin initial restent identiques.

| Mutation | Refus de la politique | Suite dans le service |
|---|---|---|
| Orientation ramenée à `ambiguous`, route toujours liée | `pose_not_discriminated` | Le ticket `view` ACTION2 prend la suite. Le vrai retour diffère de l'image de départ et de celle du T7 nominal, sans niveau marqué. |
| Référence d'observation du chemin remplacée par une référence périmée | `modifier_access_unbound`, liaison `stale_scope` | Le même repli `view` ACTION2 est admis et son retour est propre à `view`. |
| À T14, retirer le fait du changement sélectif tout en gardant l'alignement et le chemin | La politique conserve une route `peer` géométriquement liée et ne la sélectionne plus. | Contrôle isolé de la politique avec les faits acquis à T14. Le rejeu nominal est le témoin du ticket et de l'effet physique pour cette seconde situation. |

Le service du gel propose, arbitre et recompose déjà les deux accès sur
des preuves actives. La branche ajoute le contrat et les assertions.
Le constat est borné aux occurrences du catalogue et à la prolongation
N1 → N2 observée ici.

## Reproduction et limites du verdict

Dans un checkout avec les dépendances et actifs Pyodide préparés, servir
le moteur du gel avec Vite puis ouvrir
`/tests/sic-qualification.html?strategy-inventory&games=LS20&actions=16`
et cliquer sur **Compare strategy settings**.

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5198 --strictPort
node --test tests/sic-ls20-line-20.test.ts
```

Les tests réemploient le
[journal public existant](../../docs/migration/lot2c-evidence/final/ls20-method-continuation/ls20-public-trace.json.gz).
`SIC_LS20_GAME_ROOT` indique la racine disposant des actifs Pyodide et de
`public/python`. Avec cette variable, les tests rejouent le jeu officiel,
vérifient les retours nominaux par rapport au journal et exécutent les
deux replis sur le jeu. `SIC_LS20_ENGINE_ROOT` permet d'appeler les modules
depuis un checkout distinct du gel. En qualification locale, le moteur
chargé par les tests provient de ce checkout distinct.

Les six suites de contrats `v6-morphology-{entry,family,managed,measurements,methods-reference,preview}`
passent **284/284** sur les octets du gel. Sur le checkout Windows,
quatre fichiers de référence avaient des fins de ligne CRLF. Leur retour
temporaire aux blobs Git a rétabli les empreintes attendues pour le test.
Les fichiers du checkout ont ensuite été restaurés.

Préparation à 22:53:19, premier rejeu complet à 22:54:06,
critères figés à 22:57:06 et première série complète verte à 23:01:50
(UTC−3). La qualification indépendante reste ouverte.
