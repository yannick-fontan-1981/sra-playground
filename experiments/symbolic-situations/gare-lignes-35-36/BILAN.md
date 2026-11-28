# GARE · deux qualifications sur le gel

**Les deux sous-questions ont déjà une sélection remplaçable sur `d0e7527c`.** La révision de preuve `c3f24fb8` possède le même arbre moteur. Chaque SHA a été soumis à dix départs depuis N1, pour 44 gestes exécutés dans le jeu. Le parcours catalogue fournit 16 tickets, 17 observations publiques vérifiées, le pack par défaut et une limite globale de 16. [Présélection opérateur](CONTRAT.md) · [Reçu vérifié](recu.json)

| Ligne | Ce qui autorise la décision | Substitution et retrait |
|---|---|---|
| **35 — transfert de cadre** | Au T1, une paire unique de bandes parallèles justifie la question d’interface en (4,23). Le clic réel fournit une mesure de déplacement. Enlever une bande rend ce point inéligible et laisse un autre transfert possible en (44,13). **Sept occurrences sur GARE**, sur onze réparties dans le catalogue. | À plateau intact, retirer les seuls faits d’éligibilité du point (4,23) libère **(44,13)** sous la même sous-question. Après son vrai retour, T2 choisit (54,13). Retirer toute l’entrée 35 donne la question d’information en **(19,13)**. Après son retour, le service redemande le transfert en (4,23). |
| **36 — analogie entre cadres** | T4 vise (9,13). La source et le marqueur sont distincts, partagent leur masque, et trois références de mesures antérieures soutiennent la projection. Le retour physique fournit des mesures de déplacement et de remplacement. Modifier un pixel du marqueur au retour T3 écarte l’analogie et donne le rappel d’occurrence en (13,23). **Neuf occurrences sur GARE**, sur neuf au catalogue. | Retirer à T4 le point (9,13) ou l’entrée 36 entière donne le service de champ en **(39,13)**. Son retour lui appartient. T5 reprend l’analogie en (9,13). Sur le préfixe nominal, retirer le point (34,23) à T5 conserve l’entrée 36 avec une autre projection en **(59,13)**. Après ce vrai retour, T6 sélectionne le service de champ en (44,13). |

**Réserve indépendante, deux départs par SHA.** Les images servies gardent le changement près du point cliqué et reprennent l’image d’avant le geste partout ailleurs. Après T1, 29 des 94 pixels modifiés sont conservés. La mesure de déplacement disparaît, tandis que T2 garde le transfert en (44,13). Après T4, 43 des 248 pixels modifiés sont conservés. Les mesures nominales de déplacement et de remplacement disparaissent. T5 passe de l’analogie en (34,23) au transfert de cadre en **(59,13)**. Dans les deux départs, le vérificateur rejette un reçu qui attribue à l’observation tronquée les mesures du vrai retour. Les 16 clics nominaux ont `matched:null` et sont suivis de leurs propres acquisitions.

Les deux groupes de résultats opérateur sont identiques entre révisions. Les huit tests de l’auteur ont aussi été exécutés avec le jeu actif sur le candidat. Les commandes de substitution ont effectivement été jouées. Les scènes à bande effacée, marqueur modifié et retours tronqués sont des contrôles construits.

### Rejeu

Depuis ce dossier avec Node 24, `$jeu` désigne la racine du Banc contenant les répertoires Pyodide et Python. Écrire dans un dossier de reçus neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','c3f24fb80a39604bf99686f7c0725b175c2628dd')) {
  foreach ($g in @('nominal','transfert','analogie')) {
    node qualifier.mjs $sha $g $jeu "$reçus/$($sha.Substring(0,8)).$g.json"
  }
  node qualifier.mjs $sha réserve $jeu "$reçus/$($sha.Substring(0,8)).réserve.json" $sélection
}
node qualifier.mjs c3f24fb80a39604bf99686f7c0725b175c2628dd auteur $jeu "$reçus/c3f24fb8.auteur.txt"
node verifier.mjs $reçus
```

Le fichier `$sélection` est conservé chez l’opérateur. Les trois groupes de développement sont autonomes.
