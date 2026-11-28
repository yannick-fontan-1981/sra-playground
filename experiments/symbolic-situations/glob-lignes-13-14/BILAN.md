# GLOB · qualification de la question de dépendance et du choix d’origine

**13 fonctionne sur le gel et devient remplaçable sur la branche. 14 est déjà remplaçable sur le gel.** L’entrée officielle a été rejouée depuis N1, avec la curiosité native, l’agenda du navigateur et un budget global de 16 gestes. Le préfixe nominal qualifié comprend six gestes. [Contrat scellé](CONTRAT.md) · [Mesures vérifiées](recu.json)

| Ligne | Décision, preuve et retour du jeu | Intervention à état comparable |
|---|---|---|
| 13 · demander si le lancement dépend du placement | Au T3, le contrôle ACTION5 était resté inerte avant le placement. Le T2 a changé le nœud du marqueur en conservant le mot. La référence du placement désigne le plateau courant. La famille `fixed_origin` libère ACTION5 sous `fixed_origin_dependency` et reçoit l’exécution de 66 images avec `matched:null`. La lecture de ces images fournit 12 couples de nœuds associés aux instructions. | Remplacer la référence courante par la véritable référence antérieure de T2, ou retirer la seule preuve d’inertie, donne la famille `observed_frontier` et son clic en (10,17) sur les deux SHA. Retirer uniquement l’offre de dépendance donne ce même repli sur `48aae7fc`. L’opération distincte n’existe pas sur le gel et le geste nominal y est conservé. |
| 14 · placer le marqueur à une origine compatible | Au T4, huit modèles et 29 placements examinés aboutissent à une seule origine commune, le nœud 10 pour la cible 23. Le clic en (31,12) reçoit `matched:true`. Le ticket suivant lance ACTION5 à l’indice 1 du plan, puis le jeu passe au N2. Le lancement reçoit `matched:null`. | Retirer seulement l’offre d’accès au T4 donne le clic d’exploration (10,17), suivi d’un nouvel accès à l’origine 10. Changer la cible en 24 donne l’origine 11 en (37,12). Masquer le placement après le clic donne `matched:false`, clôt le préfixe et conduit à un nouveau placement à l’indice 0. |

**Réserve à image finale identique.** Les trois versions gardent la même première image, la même dernière image et les mêmes 66 instants. Les résultats suivants sont reproduits sur les deux SHA.

| Présentation au retour T3 | Couples de nœuds relevés par instruction | Ticket T4 |
|---|---:|---|
| Animation complète | 12 | `fixed_origin`, placement en (31,12) |
| Seules les bornes restent visibles | 1, du nœud 13 vers lui-même | `observed_frontier`, clic en (10,17) |
| Un palier intérieur est masqué | 12, identiques aux 12 du nominal | `fixed_origin`, placement en (31,12) |

L’observation des bornes crée un voisinage visuel absent de l’animation complète. Le seul couple 13→13 ne justifie pas l’origine 10. Bien que le ticket et les références des deux images terminales concordent, le vérificateur rejette le reçu qui attribuerait les 12 couples à cette observation réduite. Sur le palier réservé, deux voisinages de pixels disparaissent et un nouveau apparaît, tandis que les 12 couples de nœuds utiles restent attestés. Le contrôle conserve donc le choix sur ce départ.

**Décompte.** Neuf départs et 42 gestes par SHA dans la comparaison opérateur. Un départ nominal supplémentaire de six gestes par SHA a été joué avec l’entrée PowerShell livrée. Les reçus nominaux concordent champ par champ après retrait des deux annotations opérateur de rattachement. Les neuf départs ont été rejoués une fois pour enregistrer explicitement l’identité du ticket livré et la famille donnant le retour. Cette reprise instrumentale conserve le même dénominateur de neuf situations.

Les 84 gestes de la reprise reproduisent intégralement les premiers reçus sur leurs champs communs. Après le clic de repli au T4, le service examine 28 placements au T5 et retrouve l’origine 10. Le plateau nominal du T4 en admettait 29 à examiner. Le vérificateur contrôle les deux dénominateurs. Le délai de la présélection au verdict vérifié est de 10 min 46 s, attente du candidat et qualification LIFE comprises.

### Rattachement du vérificateur de l’auteur

Le moteur candidat éprouvé dans ce bilan reste `48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d`. La révision `787fee9746815121a133704e2c1554f096e09834` déplace l’initialisation de deux comparateurs avant le lancement du vérificateur agrégé de l’auteur. Le diff Git porte uniquement sur ce vérificateur. L’arbre `src` est identique (`07d3a71b`), comme le fichier de l’opérateur (`ea0debe6`). Le vérificateur indépendant de ce dossier a été relancé sur les reçus conservés et reproduit exactement le JSON publié pour les neuf départs et 42 gestes par SHA. L’agrégat des 21 préfixes de l’auteur relève du vérificateur corrigé. [Diff de correction](https://github.com/yannick-fontan-1981/sra-playground/compare/48aae7fc...787fee97)

### Rejeu

Depuis ce dossier, sous Node 24, utiliser un dossier de reçus neuf. `$pyodide` est le chemin absolu vers `public/vendor/pyodide` du Banc. `$candidat` est le checkout propre de `48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d`. Le fichier de sélection est conservé chez l’opérateur.

```powershell
node verifier-prefixe.mjs
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d')) {
  foreach ($g in @('décisions','placement','réserve')) {
    node qualifier.mjs $sha $g $pyodide "$reçus/$($sha.Substring(0,8)).$g.json" $sélection
  }
}
$livré = Join-Path $candidat 'experiments/sic-agenda-offres/glob-13-14'
foreach ($moteur in @('gel','candidat')) {
  & "$livré/lancer.ps1" operateur --moteur $moteur --fiche "$livré/public/nominal.json" --pyodide $pyodide --recu "$reçus/$moteur.entrée.json"
}
node verifier.mjs $reçus
```
