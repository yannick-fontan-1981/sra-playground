# Banc SIC après les 98 lignes

**Référence commune** `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`, arbre `src` `97a68f338d0ea96875cd915f65839db021595d95`. Les parcours protégés démarrent en N1 sur AS66 et G50T, avec le service et le jeu natifs, `sic`, cible `auto`, un travailleur, graine 0 et les plafonds par niveau du gel. AS66 et G50T sont rejoués en série et chaque capture lance son propre processus. [Feuille de route](https://github.com/yannick-fontan-1981/sra-playground/blob/0448216a3e01554391c30ecc7b5b7f667bee4a3f/docs/architecture/sic-chantier-strategies-composables.md) · [Budgets historiques](sic-107-4a546a13-20261126/expected-budgets.json)

## Reproduire la référence et comparer un candidat

Depuis la racine du checkout du banc, utiliser Python 3.11 et Node 24.22.3. `$m` est un checkout propre du SHA de référence et `$c` un checkout propre du candidat. `$sha` contient son SHA complet. Le banc vérifie les actifs de jeu, le SHA, l'arbre du moteur et les paramètres de capture.

```powershell
$a = 'artifacts/sic-after-98/reference-0aef4289'
py -3.11 scripts/sic-after-98.py --state $a reference --checkout $m
py -3.11 scripts/sic-after-98.py --state "artifacts/sic-after-98/candidat-$sha" candidate --checkout $c --sha $sha --reference-state $a
```

Ajouter `--node <exécutable>` avant `reference` ou `candidate` si Node 24.22.3 est disponible par chemin explicite. Le candidat réutilise A après vérification du rapport A/A′ et des empreintes des fichiers. Répéter la même commande reprend les captures déjà terminées. Une capture interrompue reste dans son dossier local et repart dans un dossier neuf. Le rapport est écrit à `<état>/report.json` avec le verdict par jeu, le premier chemin JSON divergent, ses deux valeurs et le jeu, niveau, tour et événement. Un écart ou un parcours incomplet donne un code de sortie 1. Pour relire deux traces indépendamment du lanceur, utiliser `node scripts/compare-sic-decisions.mjs GAUCHE.jsonl DROITE.jsonl`. Les traces de décision, correspondances de graphes et journaux restent dans `artifacts/`.

## Portée des comparaisons

Le comparateur ordonné du premier lot est réutilisé. Il conserve les observations et les retours, les familles effectivement visitées, l'offre retenue et son besoin, les preuves et les motifs de garde lorsqu'ils sont émis, le ticket, la commande et ses coordonnées, puis l'arrêt. Les refus explicites sont comparés comme des événements ou des champs natifs. Une famille visitée renseigne la consultation. Le détail d'une offre et la cause de son rejet restent inconnus lorsque le service ne les publie pas. Les empreintes du graphe de décision neutralisent le seul champ `created` des entrées du journal de raisonnement. [Contrat de trace et contrôles](sic-comparaison-decisions.md#ce-que-le-banc-compare)

La campagne historique `46109199284` qualifie la continuité des 107 jeux au grain des reçus. Les captures AS66 et G50T contrôlent la continuité des décisions détaillées pour l'articulation « mesurer un contrôle → chercher un accès ». La qualification de l'agenda ou d'une composition demande en plus le contrat préenregistré du candidat et la liste réelle de ses offres, gardes, motifs et critères de classement sur la même observation. Pour un essai `shadow`, conserver le choix et le ticket natifs, rapprocher séparément l'évaluation des offres sans les jouer et joindre le premier désaccord motivé. Lorsqu'un changement d'action est attendu, relier l'écart préenregistré à sa preuve et au retour du vrai moteur. Le transfert vers une mécanique réservée et les contrôles d'abstention auront leurs propres reçus. [Campagne historique](sic-coexistence-0aef4289.md#campagne-historique)
