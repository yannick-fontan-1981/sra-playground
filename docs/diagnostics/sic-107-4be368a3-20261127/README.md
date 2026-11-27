# Campagne SIC des 107 jeux sur 4be368a3

Le [run 46051058377](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46051058377) a livré 107 verdicts complets sur le commit `4be368a365a6347fb551bb4c73dd5756413bb34e`, arbre `dcaf029b1f31ae15d9a1be62b705e93ce58d4ca1`. Les 24 lots Ubuntu 24.04 ont exécuté le runner canonique sous Node 24, depuis le premier niveau avec un worker SIC par jeu et les plafonds d’origine.

**107/107 jeux complets. 692/692 niveaux gagnés et réconciliés.** L’audit indépendant a vérifié l’ensemble du catalogue, les sources et plafonds, l’autorité et les scores. Il a observé zéro erreur d’infrastructure, résultat manquant ou dépassement de temps scoré.

| Source | Jeux complets | Niveaux gagnés |
| --- | ---: | ---: |
| `4a546a13`, référence historique | 80/107 | 605/692 |
| `0fe417b2`, campagne précédente | 105/107 | 689/692 |
| `4be368a3`, cette campagne | **107/107** | **692/692** |

**105 jeux ont gagné sans récupération attestée.** SS01 et SS04 ont effectué chacun un reset, comme sur les deux sources précédentes. Les 107 compteurs de récupération sont renseignés et zéro undo est enregistré.

| Jeu | Campagne précédente | Cette campagne | Niveau précédemment incomplet |
| --- | ---: | ---: | --- |
| HOLE | 4/6, 54 commandes | 6/6, 78 commandes | L5 gagné en 21/24 commandes et 11 734 ms sous 29 000 ms |
| SNAR | 5/6, 161 commandes | 6/6, 163 commandes | L6 gagné en 29/35 commandes et 12 090 ms sous 17 000 ms |

Les deux jeux ont gagné avec zéro reset et zéro undo. HOLE termine son L6 en 27 commandes et 17 326 ms. SNAR retrouve les comptes par niveau de 16, 24, 23, 36, 35 et 29.

## Durée GitHub

Le run a commencé à 18:39:08 UTC et le dernier contrôle a pris fin à 18:53:38 UTC. La mise à jour finale suit à 18:53:39 UTC.

| Mesure | Cette campagne | Campagne précédente |
| --- | ---: | ---: |
| Du lancement au dernier contrôle | 14 min 30 s | 12 min 19 s |
| Fenêtre entre le premier et le dernier rejeu | 12 min 16 s | 10 min 06 s |
| Somme des 24 jobs de rejeu | 2 h 12 min 49 s | 2 h 10 min 45 s |
| Somme des 24 étapes de rejeu | 1 h 44 min 29 s | 1 h 44 min 24 s |
| Pic de jobs simultanés | 16 | 20 |
| Pic d’étapes de rejeu simultanées | 14 | 20 |

Le [reçu horaire](timing.json) conserve les intervalles des 24 jobs, de leurs étapes et du dernier contrôle.

## Reçus

L’[index d’intégrité](receipt-index.json) recense les 26 artefacts et les empreintes SHA-256 des fichiers. Les verdicts CI et le détail des 24 lots sont conservés avec le [rapport](aggregate/summary.json) et l’[audit indépendant](independent-audit.json), produit par le [vérificateur 157fec6e](https://github.com/yannick-fontan-1981/sra-playground/blob/157fec6e64781708069e1c557a1037023e7ad1f1/scripts/audit-sic-107-receipts.py).

La [comparaison au run précédent](previous-run-delta.json) conserve les deux changements de complétion. La [comparaison à la référence](baseline-delta.json) conserve les 27 complétions retrouvées. Les archives historiques sont consultables sur [4a546a13](../sic-107-4a546a13-20261126/README.md) et [0fe417b2](https://github.com/yannick-fontan-1981/sra-playground/tree/fca904de931a4c0a299635c54570779d8f4add3e/docs/diagnostics/sic-107-0fe417b2-20261127).
