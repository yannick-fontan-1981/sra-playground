# Campagne SIC des 107 jeux sur 0fe417b2

Le [run 46047191373](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46047191373) a reçu un verdict pour chacun des 107 jeux de la campagne de référence. Les 24 lots GitHub Actions ont utilisé Ubuntu 24.04 et Node 24.22.3. Ils ont exécuté le runner canonique du commit `0fe417b2e91bb8ca15573e82b79b7081157aeb37`, arbre `359b57d62ee36110cfb349496eabe13d4ebfb13a`, depuis le premier niveau avec un worker SIC par jeu et les plafonds d’origine.

**105/107 jeux sont complets. 689/692 niveaux ont un score et une réconciliation attestés.** L’audit indépendant confirme zéro résultat manquant ou erreur d’infrastructure. Il confirme aussi les 103 victoires complètes avec zéro reset et zéro undo attestés. SS01 et SS04 ont effectué chacun un reset, comme dans la campagne de référence. Aucun undo n’est enregistré sur les 106 parcours dont les compteurs sont renseignés. Le watchdog a rendu le verdict de SNAR avec un compteur de récupération inconnu.

| Jeu | Niveaux gagnés | Arrêt | Commandes au niveau | Temps au niveau | Commandes cumulées |
| --- | ---: | --- | ---: | ---: | ---: |
| HOLE | 4/6 | Plafond de commandes au L5 | 24/24 | 11 950/29 000 ms | 54 |
| SNAR | 5/6 | Plafond de temps au L6 | 27/35 | 17 002/17 000 ms | 161 |

La [campagne de référence](../sic-107-4a546a13-20261126/README.md) sur `4a546a13` comptait 80 jeux complets et 605 niveaux gagnés. Vingt-six anciens jeux incomplets sont désormais complets. SNAR passe de 3/6 à 5/6 sur cette campagne, et HOLE passe de 6/6 à 4/6. Les deux scénarios d’arrêt et le détail du changement de verdict sont conservés dans la [comparaison](baseline-delta.json).

## Durées

| Mesure | Durée |
| --- | ---: |
| Du lancement GitHub au dernier job | 12 min 19 s |
| Du lancement GitHub à la mise à jour finale | 12 min 20 s |
| Du début du premier rejeu à la fin du dernier rejeu | 10 min 06 s |
| Somme des durées des 24 jobs de rejeu, installation comprise | 2 h 10 min 45 s |
| Somme des durées des 24 étapes de rejeu | 1 h 44 min 24 s |
| Du lancement du contrôle local au dernier job GitHub | 14 min 25,490 s |

Le [reçu horaire](timing.json) conserve les heures UTC du run, des jobs et des étapes. Le pic observé est de 20 jobs GitHub simultanés et de 20 étapes de rejeu simultanées.

## Vérifications et pièces

Le [contrôle local complémentaire](local-cross-check.json) a réussi les 16 jeux sélectionnés, soit 94 niveaux et 840 commandes, avec zéro récupération attestée. Sous Windows, deux lots ont pris 248,686 s en temps mural et 495,706724 s en temps cumulé. Les empreintes des reçus locaux figurent dans ce contrôle. Le bilan des 107 jeux s’appuie sur les reçus Ubuntu.

L’[index d’intégrité](receipt-index.json) lie les 26 artefacts GitHub et les fichiers archivés à leurs empreintes SHA-256. Le [rapport CI](aggregate/summary.json) conserve les verdicts du run. L’[audit indépendant](independent-audit.json), produit par le [vérificateur 157fec6e](https://github.com/yannick-fontan-1981/sra-playground/blob/157fec6e64781708069e1c557a1037023e7ad1f1/scripts/audit-sic-107-receipts.py), confirme le catalogue, les références, les plafonds, l’autorité et les réconciliations.
