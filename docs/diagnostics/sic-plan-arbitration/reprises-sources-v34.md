# Reprendre une occasion créée par d’autres actions

## Ce que permet le raccord de deux parcours

Deux politiques historiques, celle des six partitions de traces originales et v31, ont joué les mêmes L1. Pour ce premier travail, les 25 jeux officiels et la famille de HANO sont réservés. Sur les 74 autres jeux, le banc choisit le premier retour de la seconde politique à une image également atteinte par la première, avec des entrées et des commandes suivantes différentes. Le choix ignore les scores et les effets ultérieurs. Il authentifie ensuite les deux parcours dans le moteur, puis joue la suite de chacun depuis le préfixe de l’autre. Un témoin part du dernier état antérieur d’image différente, lorsqu’il existe.

Douze jeux présentent un tel raccord. Les **24 suites sur 24** reproduisent toutes les images restantes. Les 17 suites provenant d’une victoire conservent le score. Sept font gagner le parcours initialement perdant. Depuis les positions décalées, seules 2 des 22 suites disponibles reproduisent toutes les images, et six gagnent. Sur deux entrées sources de niveau 3 appariées, GRAV présente un raccord. Ses deux suites de 35 coups reproduisent leur victoire. Ses deux témoins décalés échouent. Ces interventions fournissent la suite à l’agent expérimental extérieur. Elles mesurent sa validité physique.

## Une conséquence choisie sans recevoir la suite

Le prototype suit aussi les transitions produites par les autres familles de SIC. Si deux gestes ordinaires A et B produisent ailleurs les deux modifications locales d’un ancien exemple, il recherche une observation de B seul depuis la configuration antérieure. Il prévoit C seulement si la comparaison distingue l’effet de B préparé, que le site de C correspond et que C y reste inédit. Il peut conserver cette occasion pendant un détour, la reconnaître à l’image de retour et la consommer quelle que soit la famille qui exécute C. Chaque proposition cite les deux observations de la préparation actuelle, la leçon et le contrôle. La mémoire des occasions appartient au niveau courant.

Sur les trajectoires ci-dessous, le banc ferme la prévision avant la prochaine commande historique. Il joue C depuis l’état atteint puis, depuis l’origine de A, compare C seul, A-C et B-C. Une prévision contrôlée exige l’effet annoncé dans le premier bras et son absence dans les trois autres.

| Parcours | Entrées | Décisions disponibles | Prévisions | Effets conformes | Conformes avec les trois témoins | C aussi choisi par la politique historique |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Premières traces L1 | 74 | 1 855 | 47 | 40 | 40 | 33 |
| Cohorte v31 L1 | 74 | 1 088 | 34 | 32 | 32 | 19 |
| Sept entrées supérieures de la série checked28 | 7 | 490 | 2 | 2 | 2 | 2 |

Les deux preuves supérieures sont sur MOTO L2. Les deux cohortes L1 se recouvrent en jeux. Les 32 effets contrôlés sur la cohorte v31 se répartissent sur CGWL, SWCH, FUIT, KEYD, PORT, ESCT et GABA. Le prototype peut donc reconnaître une capacité créée incidemment sur plusieurs familles. La valeur de son usage pour gagner demande une autre intervention.

## Le coût d’une priorité immédiate

Le premier prototype, inséré dans l’arbitrage haut des effets vérifiés de la branche v33, conserve VOIS L1 en 57, KEYD L1 en 35 et SKBN L1 en 22. Il perd SWCH et GABA au plafond de 60. Sur SWCH L1 la première commande différente de v31 arrive au coup 17. Sur KEYD L2 précédé de la leçon publique de 35 coups, il échoue à 90. L’hypothèse « une prévision de C appuyée par A et B mérite une priorité immédiate » échoue à la préservation, malgré la précision du banc. Le prochain essai doit conditionner l’usage à une limite locale observée et séparer l’effet de cette règle de la simple reconnaissance de la capacité.

## Reproduction sur les sources

Utiliser Node 24, le moteur public employé pour les six partitions originales et les fichiers complets des deux cohortes. Le séparateur `--` distingue les bras de la première commande. Passer les chemins JSONL explicitement au shell.

```text
node scripts/audit-source-continuation-joins.mjs <moteur> <résultat.json> <partitions-originales...> -- <partitions-v31...>
node scripts/audit-source-incidental-use.mjs <moteur> <résultat.json> <partitions-d’une-cohorte...>
```

Les deux outils exécutent les commandes dans le moteur public. Le premier vérifie les empreintes des deux parcours sélectionnés avant substitution. Le second vérifie les transitions de chaque bande entière lue. Les expériences utilisent uniquement les jeux sources. [Mesures, interventions et contrôles par jeu](reprises-sources-v34.json)
