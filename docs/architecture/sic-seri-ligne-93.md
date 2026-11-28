# SERI, ligne 93 — poursuivre sur les retours visuels acquis

## Critères préenregistrés

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Catalogue
`8ce7ee35`, SERI N1/T1 ACTION6, `visual_sequences /
public_visual_sequence`. Départ N1, graine 0, plafond 16.

- Rejouer la première soumission et les étapes visuelles jusqu'à
  l'acceptation officielle. Distinguer l'option inférée dans la
  rangée, le remplissage observé et la conservation des autres cartes.
- Dans le niveau suivant, identifier les preuves réellement lues
  par `proposeContinuation`. À même vue, retirer une preuve en
  gardant le minimum, puis ramener les complétions sous ce minimum
  et comparer aux mêmes options. Jouer les reprises quand elles
  sont disponibles et rattacher leurs retours.
- Présenter un retour incomplet après la même soumission sur la
  première rangée. Mesurer ce que l'enregistreur refuse de créditer,
  le rejet de la resoumission identique et la suite choisie.
- Garder les deux plateaux réels, les interventions et le plafond
  de la campagne distincts. Attribuer au gel les décisions déjà
  présentes. Un défaut causal éventuel sera préenregistré avant
  modification du moteur.

## Les rangées, le passage de niveau et la reprise

Les moteurs du catalogue et du gel concordent sur les neuf
tickets et leurs retours. Les huit occurrences de la ligne 93
sont les T1 à T8. Les T4 et T8 valident respectivement les deux
premiers niveaux. Au T9, le jeu atteint un autre type de question
et le moteur s'arrête après ce retour dans la fenêtre étudiée.
Premier rejeu du gel à 00:53:05 UTC−3 le 28 novembre, 35 s.

`VisualSequences.measure` délimite la rangée active et ses
cartes. `infer` compare les options visibles aux lois de
traits et de couleurs compatibles avec les cartes remplies.
`select` choisit une seule option soutenue et un point strictement
intérieur à sa boîte. Le garde compare le point, le raster
de l'option et l'observation du ticket.

| Moment | Décision et retour | Ce que le retour conserve pour la suite |
| --- | --- | --- |
| N1/T1 | Rangée 0, rang manquant 5, ACTION6(41,54). Le vrai paquet remplit la case [53,1,61,9]. | Le raster rempli correspond à l'option. Les autres cartes sont conservées. `observed_row_completion` cite le retour. |
| N1/T2–T4 | Trois nouvelles rangées choisissent leurs options à partir des cartes visibles. Le T4 donne le premier gain officiel. | Trois complétions locales et un événement officiel distinct. |
| N2/T5 | `proposeContinuation` consomme deux complétions distinctes et l'événement officiel, révisions 3, 4 et 5. La nouvelle rangée conduit au clic (46,54). | Le vrai retour remplit la nouvelle case. L'historique justifie la méthode de reprise et le raster N2 détermine l'option. |
| N2/T6–T8 | Les témoins de complétion se renouvellent, avec la même limite officielle en référence. Une autre combinaison de traits justifie la dernière option. | Le T8 donne le deuxième gain officiel. Les huit retours laissent `matched:null`. |

`record` compare le contenu de la case choisie et la
conservation du reste de la grille. Le statut officiel
corrobore la soumission finale indépendamment du test local
de remplissage.

## Contre-épreuves

Au vrai N2/T5, retirer la dernière complétion seule laisse deux
questions antérieures complétées. Le service conserve la reprise
au même clic et remplace les références 3, 4, 5 par 2, 3, 5.
Retirer deux complétions suspend cette justification. La proposition
directe de `visual_sequences` réanalyse le plateau courant,
choisit le même clic et ne cite plus de témoins de continuation.
Les deux tickets sont joués et remplissent la case attendue.

Au T1, le test présente un retour stationnaire construit après
la soumission (41,54). Les autres cartes sont conservées mais la
case attendue reste vide. Le reçu `answer_acceptance_unconfirmed`
rend l'essai identique indisponible pour cette grille. Le service
libère ACTION1 par `observed_frontier`, joué sur le départ officiel
compatible avec la vue stationnaire. Aucun niveau n'est acquis
dans cette variante.

Le gel contient la réutilisation conditionnelle de la méthode
et la reprise sur le raster courant. Les preuves ci-dessus portent
sur les huit occurrences de SERI sur deux niveaux.

## Reproduction

Node 24. `SIC_SERI_GAME_ROOT` désigne les actifs et Pyodide.
`SIC_SERI_ENGINE_ROOT` sert à répéter les assertions sur un autre SHA.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-seri-line-93.test.ts tests/v6-visual-sequences.test.ts
```

[Test du service](../../tests/sic-seri-line-93.test.ts) ·
[Choix et qualification du retour](../../src/logos-engine/v6-visual-sequences.ts) ·
[Raccord de la continuation](../../src/logos-engine/v6-native-runtime.ts) ·
[Catalogue](sic-v8-strategies-observees.md#L119)
