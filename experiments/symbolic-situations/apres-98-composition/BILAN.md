# Premier essai de composition après les 98 · verdict opérateur

Candidat `909e584adb498f7d92cd46e8b9b1ba53e93d2fd2`, parent `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`. Le lot exerce le simulateur du candidat et ses deux politiques. Réserve scellée avant lecture du code, SHA-256 `52a10e1154bc672e2c380c1aa4e9929eacb004cb3842a4b98848c9af626f65b8`. Les empreintes du fichier, du vérificateur et des critères concordent après rejeu. Le reçu brut conservé par l’opérateur a pour SHA-256 `64a8f52fcd97ffea8e4cd6c3d89d4ca58654ac3d5c2dadce439188a38579bad2`.

| Sur les mêmes 10 départs | Procédure figée | Composition en ligne |
| --- | ---: | ---: |
| Victoires officielles du simulateur | 6 | 7 |
| Gestes, tous départs | 84 | 49 |
| Gestes, six victoires communes | 51 | 38 |
| Abstentions justifiées par la cible indiscernable | 2 | 2 |
| Épuisements du quota de gestes | 2 | 0 |
| Arrêts faute de plan justifié dans le quota de gestes | 0 | 1 |
| Pertes, gestes illégaux, dépassements de budget | 0 | 0 |

Les 10 premières décisions différentes se répartissent entre T1 (3 cas), T2 (5) et T3 (2). Les deux mondes indiscernables produisent le même historique dans chaque politique. Le figé s’arrête après huit gestes par monde, la composition dès l’entrée, avec le même fait manquant explicite. La composition développe 7 017 états cumulés dans les 10 départs, au plus 4 020 sur un départ. Le figé ne lance aucune recherche. Les limites individuelles de gestes et de recherche sont respectées, transferts compris.

**Transfert.** Les quatre sources réussissent avec composition. Une seule isole la commande et fournit l’acquis exporté. Sur cette paire, le bénéficiaire change son premier essai à public identique. Le premier retour dans chaque bras est `{position:0, open:false, target:null, outcome:null}`. Il gagne en six gestes avec ou sans acquis. La recherche passe de 1 001 à 988 états. Les trois autres relectures conservent leurs décisions et résultats. Le contrôle à commande changée fait partie des trois sources sans acquis exporté. Le rejeu réservé laisse donc la revalidation du rappel non mesurée.

**Plus petit arrêt reproductible observé au bras composable.** Cas `130e341140a6bd`, à charge unique. Au T2, même entrée fermée en position 0, la procédure figée attend et la composition essaie un autre code. Les vrais retours coïncident : porte ouverte en position 0 et cible encore inconnue. Au T5, le vrai retour d’`inspect` est `{position:2, open:false, target:"right", outcome:null}`. La fenêtre expirée et la charge dépensée, la composition s’arrête après cinq gestes. La procédure figée poursuit jusqu’à huit gestes, avec un essai de commande après fermeture et aucun second armement. Le contre-rejeu causal obtient une victoire en cinq gestes dans ce monde en avançant au T2 pendant le délai. Dans un second monde encore compatible après T1, le même geste laisse la porte fermée et quitte définitivement le point d’armement. L’alternative favorable dépend du monde.

**Vérifications indépendantes.** Un modèle de terrain à compteurs, écrit hors du candidat, concorde sur 2 937 états atteignables et 11 276 transitions légales, dont 746 terminales. Les 24 exécutions distinctes du reçu ont ensuite été reproduites intégralement, un processus Node restreint neuf par exécution. Chaque décision reçoit les règles publiques, l’observation courante, les hypothèses calculées depuis les retours et le quota restant. Le transfert reçoit uniquement le code attesté, l’alphabet et le tour source. Les deux sondes de lecture de la réserve et du reçu brut sont rejetées par la restriction de fichiers. Toutes les traversées ont une cible révélée et une porte ouverte. Les douze exécutions de la mécanique à charge, transferts compris, ont chacune un seul armement effectif. Les cinq tests du candidat passent également.

Le jeu réservé, les traces brutes et les vérifications détaillées restent dans le dossier privé de l’opérateur. La commande publiée s’exécute depuis le code du SHA exact et crée un fichier de sortie neuf.

```powershell
node experiments/sic-composition-inconnue/rejouer.mjs --cases <réserve-privée> --report <nouveau-reçu>
```
