# STCK · édition, exécution et ordre des répondants

**Les lignes 52, 57 et 58 passent chacune leur contrôle sur le gel et sur `39e32b1f`.** Une seule ouverture de STCK L1 a fourni les 16 tickets nominaux et les trois replis de la branche. Les 14 premières observations concordent avec la trace publique v39, animations incluses. Chaque repli a reçu sa vraie réponse du jeu avant restauration du plateau par undo. [Protocole indépendant](https://github.com/yannick-fontan-1981/sra-playground/blob/72ab79a3598084d63d155eb5c35b108aa9010be1/experiments/symbolic-situations/stck-lignes-52-57-58/CONTRAT.md).

| Ligne | Ce qui a été mesuré | Contre-épreuve et retrait sur branche |
|---|---|---|
| **52 — collection marquée, 3/3** | T1 clique (4,50) et retire le dernier membre de [14,11,9,10]. T2 insère en (46,56). T3 exécute [8,14,11,9] avec ACTION5 et franchit la limite de niveau. Chaque acquisition cite son ticket et son retour. | Renvoyer le plateau inchangé après T1 réfute le retrait et fait passer à `observed_frontier`. Retirer l’offre T1 donne aussi une expérience ordinaire ACTION5. Avec son vrai retour, le service redemande l’édition marquée. |
| **57 — composition, 8/8** | En N2, T4 clique (16,56) pour préparer la liaison avec un seul opérateur. T5…T8 éditent le mot. T9 exécute [8,8,14,9,9], avec position finale vérifiée sur les pixels en (44,21). T10 exécute ce mot depuis cette nouvelle base. La position (48,23) est visible dans l’avant-dernière image de T10. La dernière image est en N3 et le reçu de transition a `matched:null`. T11 ouvre une nouvelle liaison en N3. | Rendre indisponible le modèle appris au choix T4, sur les mêmes pixels, fait perdre la composition. Le retrait de l’offre T4 libère `animated_contact` en (33,24). Le vrai retour est reçu, puis le service s’arrête à `frontier_unknown`. |
| **58 — sonde des répondants, 2/2** | T12 édite en (36,56), T13 exécute [11,9]. Le porteur revient en (38,37). Le programme observe le déplacement de [11,8] depuis (38,13) vers (34,15) à l’indice 12. Le mot [10,8,8] devient entièrement visible en (58,23) à l’indice 23, avec une seule origine partiellement visible compatible, (62,25). | Retirer la sonde au T12 libère ACTION5 de `containment`, puis une expérience ordinaire. Réduire le retour du T13 à sa dernière image conserve le porteur final et le déplacement visible de [11,8]. L’excursion intermédiaire du porteur manque, aucun ordre n’est acquis et le service s’arrête. |

### Pourquoi la dernière image ne tranche pas l’ordre

Deux paquets construits de 52 images commencent sur la même observation de N3 et finissent pixel pour pixel sur le retour réel de T13. Les mouvements des deux régions de l’écran sont présentés successivement. Le reste de l’épisode est commun.

| Paquet T13 | Premier déplacement de [11,8] | Première apparition complète de [10,8,8] | Ordre acquis par le service |
|---|---:|---:|---|
| Animation réelle, 26 images | 12 | 23 | [11,8] puis [10,8,8] |
| Première région avancée | 12 | 49 | [11,8] puis [10,8,8] |
| Seconde région avancée | 38 | 23 | [10,8,8] puis [11,8] |
| Image finale seule | Déplacement compatible | Mot visible | Aucun ordre acquis |

L’évaluateur reconstruit les pixels des mots sur leurs supports de départ et d’arrivée dans chaque image. Il retrouve les indices indépendamment de l’événement d’ordre du moteur. Sur les trois animations ordonnées, il rejette l’échange de mots, de destination ou d’indice entre répondants. Les indices commencent à zéro. L’ordre mesuré est conditionnel à ce paquet.

**Décompte.** Sept départs par SHA : parcours nominal, édition sans changement, modèle indisponible, image finale seule, deux chronologies alternatives, permutation des couleurs. Trois retraits supplémentaires sur branche. Les trois familles de reçus ont les mêmes empreintes entre révisions. La permutation de réserve 9↔11 conserve les commandes et renomme les mots dans les 3, 8 et 2 occurrences. La géométrie du jeu est commune aux variantes. [Reçu comparatif](recu.json).

### Rejeu

Depuis ce dossier avec Node 24, employer un répertoire de reçus neuf, le chemin absolu de Pyodide et, pour la réserve, le fichier de sélection de l’opérateur.

```powershell
node jeu.mjs $pyodide "$reçus/jeu.json" "$reçus/observations.gz"
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','39e32b1f0218d53f41c27b7140c925e8e929e705')) {
  foreach ($g in @('décisions','ordre','réserve')) {
    node qualifier.mjs $sha $g "$reçus/$($sha.Substring(0,8)).$g.json" $reçus $selection
  }
}
node verifier.mjs $reçus
```
