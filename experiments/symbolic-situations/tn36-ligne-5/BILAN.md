# TN36 · qualification indépendante de la ligne 5

**Le gel apprend deux opérateurs sur deux niveaux et exécute dans chaque niveau un programme dérivé de la preuve locale.** Les six départs produisent les mêmes décisions et retours sur `d0e7527c` et `0da75640`, dont les arbres moteur sont identiques. [Présélection scellée](CONTRAT.md) · [Reçu vérifié](recu.json)

| Étape | Preuve obtenue sur le vrai jeu |
|---|---|
| **N1/T1 · exploration** | Le ticket `code_program / learned_code_program` exécute le code visible `[3,0,3,0,0]` en (36,55). La table contient zéro opérateur et le ticket émet une prédiction nulle. |
| **N1/T1 · acquisition** | Sept images présentent des changements de colonne et de position. La lecture des pixels par colonne retrouve deux transitions portant le mot 3 et le vecteur (0,+1). Le corps part de (4,1) et revient à (4,1) sur la dernière image. L’opérateur 3 porte la référence du retour. |
| **N1/T2–T8 · réemploi** | L’opérateur 3 autorise une trajectoire de cinq pas de (4,1) à (4,6) par `physicalCodePaths`. T2 joue la première édition en (26,42) et confirme le code intermédiaire. T8 rejoue le même bouton d’exécution qu’au T1 avec `[3,3,3,3,3]`. Le vrai retour ouvre N2. |
| **N2/T9–T18 · nouvelle acquisition** | T9 repart d’une table active vide et démontre le premier exemple en (21,55). Le sujet du monde principal reste en (3,5). Le retour établit le mot 33 pour (0,−1) avec une référence propre à N2. T10 construit la cible `[33,33,33,33]`. T18 exécute le programme en (46,58) et ouvre N3. |

### Contrastes au même état

- **Image finale seule.** Le ticket T1, la dernière image et sa référence restent identiques. Aucun opérateur n’est acquis. Le vérificateur rejette un reçu qui attribuerait les deux transitions nominales à ce paquet. T2 édite en (21,42) et le jeu confirme `[1,0,3,0,0]`. Le retour réel de T3 établit les mots 1 pour (+1,0) et 3 pour (0,+1).
- **Retrait de l’opérateur 3.** Sur le retour T1 complet, la preuve a bien été acquise. Retirer seulement l’opérateur de la table consultée au T2, avec le même plateau et les mêmes références, donne la même édition exploratoire que dans le cas de l’image finale seule. Son vrai retour la confirme. Cela éprouve la dépendance du calcul de trajectoire à la table active.
- **Autre exemple en N2.** Marquer le premier exemple comme déjà tenté au début de l’époque permet au chemin natif de choisir la démonstration en (8,58). Le vrai retour laisse le sujet principal en place et fournit zéro opérateur. T10 essaye `[0,0,0,0]`. Son retour n’établit aucune mesure et T11 propose `[0,0,0,1]`. La substitution passe par la disponibilité de l’exemple dans la mémoire d’essais.
- **Réserve temporelle.** La paire scellée échange les troisième et quatrième images. Les colonnes 2 puis 1 apparaissent dans cet ordre dans le paquet servi. Les deux couples distincts colonne–position restent publics. Le moteur les exploite par indice de colonne et retrouve les deux déplacements associés à 3. T2 reste en (26,42). Ce départ éprouve la conservation de l’acquisition sous cette permutation précise.

### Décompte et vérification

Six départs et **52 gestes par SHA**, dont 16 pour le catalogue, 19 pour la prolongation et 17 pour les quatre variantes. Les deux budgets produisent les mêmes 16 tickets et retours. Les **16 occurrences catalogue** comprennent deux exécutions, treize éditions et une démonstration. L’une des deux exécutions est exploratoire. Les trois tests auteur ont été rejoués avec le jeu actif sur chaque SHA.

Le verdict a été vérifié **3 min 19 s** après le scellement. Le premier passage du vérificateur supposait que chaque acquisition interne arrivait dans l’appel du retour correspondant. Le service groupe plusieurs acquisitions d’édition à la clôture d’un préfixe. La vérification rattache maintenant chaque acquisition à sa référence d’observation et contrôle qu’elle apparaît une seule fois. Les reçus des parcours ont été conservés pour cette reprise du vérificateur.

### Rejeu

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de sortie neuf. Le fichier de sélection de la réserve reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','0da75640d974e9fbe3b44b78b07649344169c470')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
