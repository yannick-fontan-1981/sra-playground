# Coexistence de 75 lignes SIC sur le moteur bf1cbf24

**75 lignes doublement qualifiées coexistent sur `bf1cbf245055a60c4a253b9c6ee4be18ea9b8c2c`.** Les deux verdicts CATL/50 `89c4b05e` et `b0240e13` ont figé le périmètre. Les dix ajouts au-dessus des 65 sont **10, 24, 30, 33, 34, 37, 49, 50, 53 et 94**. L'assemblage descend directement de `674b0dd1`. Son seul nouvel exécutable est `src/logos-engine/v6-facet-examples.ts`, repris au blob exact `b190c5be06520bd365bcb08f93cc6e4edab8a75e` d'ISOS/10 sur `640bd882`. Les neuf autres lignes utilisent leur implémentation du gel. [Périmètre et SHAs](sic-coexistence-bf1cbf24/perimetre.json) · [Jalon 65](sic-coexistence-65-674b0dd1.md)

## Témoins sur l'assemblage

TypeScript et **113 tests de facettes, recherche et reprise d'état** passent. Cinquante scénarios et préfixes dans les dix groupes ci-dessous reproduisent leurs reçus individuels. L'index donne les empreintes des reçus détaillés locaux et l'archive conserve les contrôles légers. [Index](sic-coexistence-bf1cbf24/index.json) · [Reçus ciblés](sic-coexistence-bf1cbf24/temoins.zip)

| Ligne | Contrôle ciblé sur bf1cbf24 |
|---|---|
| 10 · ISOS | Six scénarios. Le gel acceptait au N2/T4 et au N3/T8 une référence étrangère au passage concerné. Le nouvel assemblage libère le vrai repli `ACTION6 (10,14)`. Les références authentiques gardent les trois passages nominaux. Un gain sans méthode porte le score sans produire de reçu de passage. [Banc](sic-qualification-isos-640bd882.md) |
| 24 · LP85 | Deux scénarios. Au même clic T3, retirer la preuve réduit le plan de cinq gestes à un. Le N2 discrimine les opérateurs. |
| 30 · CN04 | Un préfixe prolongé. Le corps bouge à T17. Les deux premières images du T18 montrent le contact puis la troisième ouvre N2. |
| 33 · POLA | Six préfixes. La mesure portable inverse le sens constaté au retour N2/T8. Les deux bras marquent au tour suivant. |
| 34 · GMAP | Six préfixes. Localisation ambiguë avec abstention ou premier pas commun selon les accès consultables. |
| 37 · CGWL | Sept préfixes. Le déplacement et l'attache sont rattachés à leurs retours. Le garde scelle la prédiction de T14 contredite et le moteur remesure le corps. |
| 49 · REWI | Quatre scénarios. La preuve fenêtre courante de T9 est réutilisée. Le même clic avancé d'un tour ne marque pas. |
| 50 · CATL | Sept préfixes. Les deux permutations isolent la propriété du mot. Le retrait des boutons force le repli. Le nominal confirme les passages à T8/T16. |
| 53 · GIGO | Cinq sessions dans quatre tests. La mesure mixte GIGO scelle. Le témoin VALV à mesure distante poursuit. |
| 94 · FT09 | Six préfixes. Retirer le modèle change la prédiction au même T3. La suppression du premier point autorise le second. |

## Campagne des 107

Une seule campagne sur le nouvel arbre moteur. La branche d'audit ajoute son seul fichier de workflow au SHA d'assemblage. Les 24 lots reprennent le catalogue du gel, le mode `sic`, le départ N1, un travailleur par parcours et les paramètres historiques. L'audit compare les reçus au gel et à `674b0dd1`, avec **107/107 jeux, 692 niveaux et 18 560 commandes**, sans écart pour les champs comparés. La reprise importe d'abord 3 reçus, complète les 104 restants puis réutilise 107 reçus sur 107. Durée de la campagne **11 min 37 s**. Les 107 résultats ont la granularité des reçus historiques. Les dix groupes ciblés contrôlent les décisions, leurs preuves et les vrais retours. [Campagne 46102900440](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46102900440) · [Reçus](sic-coexistence-bf1cbf24/recus.zip) · [Verdict par jeu](sic-coexistence-bf1cbf24/qualification.json)

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-bf1cbf24/recus.zip --candidate bf1cbf245055a60c4a253b9c6ee4be18ea9b8c2c --workflow 38008e359b917d2599f6609882026cc61f33cde6 --run 46102900440
```

Depuis le Banc avec Node 24, `$m` désigne le checkout propre d'assemblage avec Pyodide préparé. `$out` désigne un nouveau dossier de reçus.

```powershell
foreach ($jeu in 'ISOS-PROVENANCE','GIGO','REWI','LP85','CN04') {
  py -3.11 scripts/test-sic-coexistence-catalogue.py $jeu $m "$out/$jeu"
}
foreach ($jeu in 'CATL','FT09','POLA','GMAP','CGWL') {
  py -3.11 scripts/test-sic-coexistence-recall.py $jeu $m "$out/$jeu"
}
```

Le gel officiel et `main` distant restent à `d0e7527c`.
