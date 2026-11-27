# Qualification SNAR après la campagne des 107 jeux

Le [rejeu GitHub 46050383195](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46050383195) a vérifié le candidat `efd29d975aa7d74c5444908398d5db53c3df4f00`, arbre `49baa21be9d3ed370ba1dd30831bbe723ebd6235`, sur Ubuntu 24.04 et Node 24. La session SIC a commencé au niveau 1 avec un seul worker. Les 163 commandes ont été autorisées par SIC, sans reset ni undo. Les six victoires sont réconciliées au cumul exact des commandes.

| Niveau | Commandes | Plafond de commandes | Score officiel | Plafond de temps |
| --- | ---: | ---: | ---: | ---: |
| 1 | 16 | 21 | 4 701 ms | 16 000 ms |
| 2 | 24 | 29 | 5 728 ms | 24 000 ms |
| 3 | 23 | 28 | 6 447 ms | 15 000 ms |
| 4 | 36 | 44 | 12 287 ms | 24 000 ms |
| 5 | 35 | 42 | 14 723 ms | 28 000 ms |
| 6 | 29 | 35 | 11 265 ms | 17 000 ms |

La [campagne de référence 46047191373](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46047191373), sur `0fe417b2`, s'était arrêtée à 5/6. Le watchdog de L6 avait interrompu le jeu à 17 002 ms, après 27 commandes sur 35 et un dernier ticket à 16 040 ms. Les budgets complets, le nombre de commandes et les empreintes de parcours des cinq premiers niveaux concordent entre les deux reçus. Le candidat a marqué au niveau 6 avec 5 735 ms de marge sur ce runner.

Le candidat accélère l'encodage du graphe pour les valeurs immuables dont la provenance est attestée par le runtime. Les entrées de l'appelant gardent la vérification par descripteurs. Le profil local sur 161 retours publics enregistrés reproduit les mêmes commandes et les cinq mêmes frontières. Le temps échantillonné dans `splitNativeState` passe de 3 713 à 3 225 ms. Les 48 tests natifs ciblés couvrent aussi l'égalité des fragments entre entrées brutes et détenues, l'ordre Unicode, les flottants et les tableaux gelés par l'appelant.

`manifest.json` consigne les plafonds et les arguments. `source.txt` et `source.sha256` lient le reçu aux objets Git exacts. `result.json`, `strict.jsonl.gz` et `strict.jsonl.levels.gz` conservent le verdict et les mesures. Le résultat brut décompressé a l'empreinte SHA-256 `9303876280d37436c0a6d059253e86a9273b6852a6c41aca4a481d01651180e5`.
