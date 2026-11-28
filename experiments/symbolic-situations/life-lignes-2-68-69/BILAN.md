# LIFE · qualification indépendante de trois décisions

**La ligne 2 se qualifie sur le moteur gelé. Les lignes 68 et 69 y accomplissent leur enchaînement nominal. Le candidat rend remplaçable la sélection du sujet libre aux deux endroits.** Les sept départs communs produisent des résultats identiques sur les deux révisions. Deux autres départs utilisent le nouveau point de sélection sur la branche. [Conditions scellées](CONTRAT.md) · [Reçu vérifié](recu.json)

| Ligne | Présence dans le catalogue | Intervention et retour du vrai jeu |
|---|---|---|
| 2 · invitation animée | LIFE porte 2 des 21 occurrences. T1 en N1 et T16 en N2. | T1 clique en (24,7) sous `animated_contact`. Quatre images, dont deux distinctes, se terminent sur le plateau initial. Le reçu porte les références d’avant et d’après le clic, sans modèle de contact confirmé. T2 passe au porteur. Retirer seulement l’invitation au choix initial donne le porteur (6,48) et sa marque, puis l’invitation en (24,7). Dans le contrôle où les quatre images sont identiques, la mesure d’invitation reste la même et le service s’arrête avant T2. |
| 68 · essai sur porteur | 6/6 sur LIFE. | T2 nominal choisit (6,48) parmi quatre porteurs. Le reçu mesure 29 pixels de marque. T3 choisit (41,48), seul autre porteur du même profil de bordure. Sur la branche, au même état, substituer (23,48) donne le partenaire (58,48), puis le support (48,34). Son activation produit deux descendants. Le vérificateur rejette le reçu altéré qui attribue la marque au partenaire. |
| 69 · choix du descendant | 8/8 sur LIFE. | Le retour de T4 fournit deux descendants. T5 nominal choisit (12,21) et T6 vise sa demande en (24,7). Sur la branche, l’autre descendant admissible (19,21) entraîne la livraison en (56,7). Le même identifiant relie le sujet marqué, le ticket de livraison et le sujet consommé au retour. Le choix suivant est (12,21). Le vérificateur rejette l’attribution de la marque à l’autre descendant. |

Les lignes 68 et 69 ont la même famille publique `public_occurrence_recall`. Le ticket de 68 porte `typed_carrier_experiment` et son reçu `typed_carrier_response`. Le ticket et le reçu de 69 portent `typed_material_flow`. Le raccord `selectUnboundSubject` intervient uniquement pour un sujet libre. Les contraintes de partenaire et la continuité du descendant engagé ont été vérifiées après exécution des clics.

**Limite de la réserve.** Sur les deux départs scellés, le masque centré sur le clic a retiré zéro pixel du changement final. Les marques de 29 et 32 pixels restent observables et les décisions sont conservées. Deux contrôles complémentaires, définis après cette constatation, rétablissent la dernière image d’avant le geste et gardent les images intermédiaires. À T2 le porteur perd son contexte de marque. À T5 le reçu du descendant devient `unknown`. Dans les deux cas le service s’arrête avant la commande suivante sur les deux SHA.

| Révision | Départs opérateur | Gestes exécutés | Tests de l’auteur exécutés avec le jeu |
|---|---:|---:|---:|
| `d0e7527c` | 7 | 35 | 6/6 applicables |
| `f005be66` | 9 | 45 | 10/10 |

Le préfixe nominal inclut 16 tickets, 16 vrais retours et 17 observations recoupées avec l’archive. Le délai entre le commit de présélection et le reçu vérifié est de 5 min 13 s. Il comprend les deux contrôles complémentaires.

### Rejeu

Depuis ce dossier sous Node 24, `$jeu` désigne la racine du Banc contenant Pyodide et le jeu Python. Utiliser un dossier de reçus neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','f005be662b0e4b556a0cea3d246381cd98eec7ae')) {
  $prefixe = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contact','complément','réserve')) {
    node qualifier.mjs $sha $g $jeu "$prefixe.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$prefixe.auteur.txt"
}
node qualifier.mjs f005be662b0e4b556a0cea3d246381cd98eec7ae substitution $jeu "$reçus/f005be66.substitution.json" $sélection
node verifier.mjs $reçus
```
