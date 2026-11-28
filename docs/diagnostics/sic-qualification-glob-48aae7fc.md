# GLOB · dépendance 13 et accès 14

**Le retrait de la question 13 à état et preuves identiques est qualifié sur la branche `48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d`. L’offre d’accès 14 et son retrait sont qualifiés sur le gel `d0e7527c`.** Les trois catalogues de 16 gestes (historique, gel, branche) ont les mêmes tickets et retours. La ligne 13 est sélectionnée au T3. La ligne 14 produit le placement du T4 et le lancement du T5 dans le même plan. [Index](sic-glob-48aae7fc/banc.json) · [Reçus par SHA et par carte](sic-glob-48aae7fc/recus.zip)

| Mesure | Décision et conséquence physique |
|---|---|
| **13 · question de dépendance** | N1/T1, `ACTION5` laisse l’image finale identique. T2 place le marqueur en (10,16) et change le remplissage du nœud 13, avec le même mot. Au T3, garde admise, `ACTION5` teste de nouveau le contrôle après ce placement. Le retour scelle la question, `matched:null`. Les 66 images du vrai paquet donnent 12 transitions pour les deux symboles. |
| Retrait du raccord 13 | À préfixe identique, la branche retire `FixedOrigin.dependencyOffer`. Le vrai service libère un clic de frontière en (10,17). Sur le gel, le même bras conserve la question intégrée et `ACTION5`. Retirer l’acquisition d’inertie ou présenter une référence de placement étrangère suspend la question sur les deux révisions. Renommer le contrôle sur le transport public donne `ACTION4` au T3, avec lancement physique réussi. |
| **14 · origine et confirmation** | Au T4, huit modèles compatibles et 29 origines examinées donnent une seule origine admissible, 10, pour la cible 23. La garde libère le placement en (31,12). Son retour confirme la projection, `matched:true`. Le T5 est le ticket d’indice 1 du même plan, `ACTION5`, et termine N1. |
| Variantes de 14 | Permuter la cible visible de 23 à 24 à échantillons d’instruction identiques donne l’origine 11 et (37,12). Déplacer toute la présentation d’une ligne donne (31,13) et conserve la victoire de N1. La seule image finale des 66 conserve la même empreinte de plateau au retour T3, mais ne donne qu’une transition ; le choix T4 passe à la frontière. |
| Retrait et échec de placement | Le retrait d’`originOffer` au T4 sur le gel comme sur la branche donne (10,17), puis un nouvel accès au T5. Dans un autre bras, le ticket nominal T4 est conservé et le retour présenté ne montre pas le placement. Le service scelle ce préfixe avec `matched:false` et redemande un placement d’indice 0. |

Les deux cibles testées ont chacune une seule origine admissible. L’attribution de 14 porte sur la construction de l’offre, la garde et la reprise mesurée. La question de départage entre plusieurs origines également admissibles reste ouverte. La permutation de cible et le retrait du placement modifient une présentation ; les retours physiques non modifiés et les images présentées sont distingués dans les reçus.

Départ N1, agenda et curiosité natifs, cible complète, budget global 16 et 600 gestes par niveau ; la coupure de lecture est propre à chaque carte. Graine implicite du pont 0. Contrat auteur `a958fd3f`, protocole opérateur `3daaa172`. Le seul fichier moteur changé est `src/logos-engine/v6-fixed-origin.ts`. Le banc a exécuté 23 parcours, soit les dix cartes sur gel et branche ainsi que les trois catalogues complets de 16 gestes. Les relevés complets des dix paires communes (neuf cartes et le catalogue) sont identiques. La onzième paire comporte le retrait voulu de la question 13. L’index donne les heures de capture et le temps jusqu’au verdict.

Pendant la capture, la révision du checkout est passée de `48aae7fc` à `787fee97`. Git établit que seul le vérificateur agrégé, absent de ces appels, change. Les gardes de révision du banc ont signalé cette mise à jour à la clôture. Le rattachement a été vérifié sur l’arbre moteur, le blob de l’entrée opérateur, les cartes et les journaux CLI des 22 bras gel/candidat. Un **24e parcours**, le nominal répété expressément sur `787fee97`, donne un reçu identique octet pour octet. Le verdict détaillé vient du comparateur indépendant livré ci-dessous.

Depuis le banc, utiliser un checkout de preuve en `../sic-glob-13-14`, Pyodide préparé et Node 24.22.3 :

```powershell
$d = 'artifacts/verification-glob'
foreach ($version in 'historique','gel','candidat') {
  py -3.11 scripts/capture-sic-glob-origins.py ../sic-glob-13-14 $version "$d/$version" --pyodide public/vendor/pyodide
}
py -3.11 scripts/check-sic-glob-origins.py $d
```
