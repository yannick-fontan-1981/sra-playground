# Banc SIC après les 98 lignes

**Référence commune** `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`, arbre `src` `97a68f338d0ea96875cd915f65839db021595d95`. Les parcours protégés démarrent en N1 sur AS66 et G50T, avec le service et le jeu natifs, `sic`, cible `auto`, un travailleur, graine 0 et les plafonds par niveau du gel. AS66 et G50T sont rejoués en série et chaque capture lance son propre processus. [Feuille de route](https://github.com/yannick-fontan-1981/sra-playground/blob/0448216a3e01554391c30ecc7b5b7f667bee4a3f/docs/architecture/sic-chantier-strategies-composables.md) · [Budgets historiques](sic-107-4a546a13-20261126/expected-budgets.json)

## Verdict chronologique A/A′

| Jeu | A | A′ | Premier écart |
|---|---|---|---|
| AS66 | 9/9 niveaux, 161 commandes | 9/9 niveaux, 161 commandes | Aucun sur 1 613 événements. La trace du gel concorde aussi. |
| G50T | 5/7 niveaux, 253 commandes | 7/7 niveaux, 301 commandes | Événement 2522, arrêt de A après N6/T46 face à la proposition native de A′ au N6/T47. |

Une reprise indépendante du seul A de G50T conserve les trois captures terminées. Elle retrouve le même préfixe jusqu'au N6/T47 et s'arrête à 254 commandes, au même plafond mural de **47 s**. L'événement 2532 oppose cet arrêt à la proposition N6/T48 de A′. Les cinq niveaux terminés et les événements précédant l'arrêt concordent dans les deux essais. La capture complète A′ concorde sur ses **3 004 événements** avec G50T A du gel. Ces mesures établissent un écart de temps de calcul observable et bornent la parité locale G50T à son préfixe commun. Les préfixes natifs à quota d'actions du lot P05 ont leur propre verdict. [Témoins P05](sic-banc-p05-shadow-189b96ee.md)

Les reçus originaux restent dans `artifacts/sic-after-98/reference-0aef4289/report.json` et la reprise dans `artifacts/sic-after-98/reference-0aef4289-reprise/report.json`. Un essai AS66 lancé avant l'isolation du checkout a été écarté après le contrôle de propreté final. Le changement de checkout pendant la capture interdit son rattachement au SHA.

## Reproduire la référence et comparer un candidat

Depuis la racine du checkout du banc, utiliser Python 3.11 et Node 24.22.3. `$m` est un checkout propre du SHA de référence et `$c` un checkout propre du candidat. `$sha` contient son SHA complet. Le banc vérifie les actifs de jeu, le SHA, l'arbre du moteur et les paramètres de capture.

```powershell
$a = 'artifacts/sic-after-98/reference-neuve-0aef4289'
py -3.11 scripts/sic-after-98.py --state $a reference --checkout $m
py -3.11 scripts/sic-after-98.py --state "artifacts/sic-after-98/candidat-$sha" candidate --checkout $c --sha $sha --reference-state $a
```

Ajouter `--node <exécutable>` avant `reference` ou `candidate` si Node 24.22.3 est disponible par chemin explicite. Le candidat réutilise A après vérification du rapport A/A′ et des empreintes des fichiers. Répéter la même commande reprend les captures déjà terminées. Une capture interrompue reste dans son dossier local et repart dans un dossier neuf. Le rapport est écrit à `<état>/report.json` avec le verdict par jeu, le premier chemin JSON divergent, ses deux valeurs et le jeu, niveau, tour et événement. Un écart ou un parcours incomplet donne un code de sortie 1. Pour relire deux traces indépendamment du lanceur, utiliser `node scripts/compare-sic-decisions.mjs GAUCHE.jsonl DROITE.jsonl`. Les traces de décision, correspondances de graphes et journaux restent dans `artifacts/`.

Le contrôle `candidate` exige la parité complète des deux jeux en A/A′. Les deux rapports locaux G50T conservent leur arrêt et ne franchissent pas cette garde. Pour un diagnostic local, la trace A′ complète peut être comparée directement à une nouvelle capture avec le même comparateur. Une telle comparaison s'appuie sur la capture complète unique. Les contrôles du shadow et du P05 actif reposent sur des préfixes appariés à quota d'actions indépendant du plafond mural. [Couverture de l'assemblage expérimental](sic-banc-coexistence-apres-98.md)

## Portée des comparaisons

Le comparateur ordonné du premier lot est réutilisé. Il conserve les observations et les retours, les familles effectivement visitées, l'offre retenue et son besoin, les preuves et les motifs de garde lorsqu'ils sont émis, le ticket, la commande et ses coordonnées, puis l'arrêt. Les refus explicites sont comparés comme des événements ou des champs natifs. Une famille visitée renseigne la consultation. Le détail d'une offre et la cause de son rejet restent inconnus lorsque le service ne les publie pas. Les empreintes du graphe de décision neutralisent le seul champ `created` des entrées du journal de raisonnement. [Contrat de trace et contrôles](sic-comparaison-decisions.md#ce-que-le-banc-compare)

Sur la trace AS66 de la référence commune, le contrôle établi retrouve l'écart de preuve au N1/T2, événement 16, puis l'écart de commande au N1/T3, événement 26, et la fin manquante à l'événement 26. Trois altérations isolées au N1/T1 ont aussi été détectées aux positions attendues, la garde `admitted` à l'événement 3, l'indice du ticket à l'événement 6 et le résultat `matched` à l'événement 9. Ces altérations sont des contrôles du comparateur sur copie.

Le témoin de passage au N4 de G50T est visible dans les deux captures chronologiques. Aux tours 11 et 12, le même ACTION2 fait passer la justification de P07 à P05 au sein de `sic_verify_remote_replay`. Le T11 confirme la contribution enregistrée. Le T12 demande de comparer les images successives du retour et porte `matched:null`. Les décisions concernées sont les événements 1334 et 1344.

La campagne historique `46109199284` qualifie la continuité des 107 jeux au grain des reçus. Les captures AS66 et G50T contrôlent la continuité des décisions détaillées pour l'articulation « mesurer un contrôle → chercher un accès ». La qualification de l'agenda ou d'une composition demande en plus le contrat préenregistré du candidat et la liste réelle de ses offres, gardes, motifs et critères de classement sur la même observation. Pour un essai `shadow`, conserver le choix et le ticket natifs, rapprocher séparément l'évaluation des offres sans les jouer et joindre le premier désaccord motivé. Lorsqu'un changement d'action est attendu, relier l'écart préenregistré à sa preuve et au retour du vrai moteur. Le transfert vers une mécanique réservée et les contrôles d'abstention auront leurs propres reçus. [Campagne historique](sic-coexistence-0aef4289.md#campagne-historique)

## Troisième mécanique P05

Les 107 reçus de la référence contiennent 295 décisions `sic_verify_remote_replay`, toutes dans G50T, dont 13 portent P05. Ils couvrent le mode SIC. La fixture native de cavité couvre AS66. Le périmètre raccordé au shadow ou à l'activation explicite n'apporte donc aucun troisième témoin attesté par ces sources.

Le prochain raccord proposé est `createSicPairedPassage`, à la garde `switchContact`. Le moteur y présente déjà à `qualifyControlTrial` une commande et une observation, les preuves du contact et l'historique local de l'essai. La trace détaillée historique de `3c2d6bcf` atteste deux contacts suivis du retour natif `passage_connections_rewritten_at_landing`. Le fichier propriétaire de ce raccord a le même blob sur `0aef4289`. Le nouvel agenda devra émettre son propre reçu à ce raccord pour qualifier le transfert. Les paramètres du parcours de réserve restent scellés au Banc. Un contrôle indépendant sur observations construites, exécuté contre `09b9a509`, a vérifié huit assertions sur la sélection et ses abstentions.
