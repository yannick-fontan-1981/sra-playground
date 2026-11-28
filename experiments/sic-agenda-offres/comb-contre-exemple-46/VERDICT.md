# COMB/46, correction de la portée du contre-exemple

Base `d0e7527c`. Préenregistrement `81f2d53d`. Candidat vérifié `24e9743683b22b2256104d9f4de2c84abb1a1de3`. Treize préfixes natifs, 370 tests et `tsc --noEmit` passent. 13 min 33 s jusqu'au reçu. La première passe agrégée a passé. Le nominal des deux versions conserve les 16 décisions et leurs retours physiques.

| Contrôle | Gel | Candidat |
| --- | --- | --- |
| T3, preuve chargée du T1 [4,4] → [9,8] après (24,20) | Clic (24,20) avec projection du produit [4,8] | Indépendance écartée. Le service émet ACTION1 de containment |
| Geste global 9, preuve du T5 [9,4,4] → [4,8,4] après (31,20) | Le même clic (31,20) prolonge le préfixe calculé | Produit écarté. Aucun rejeu du facteur 1 n'est attesté depuis [4,4,11]. Le service choisit (45,20) par une autre proposition |
| Même T9 et mémoire de fixture avec l'arête exacte observée [4,4,11] → [4,8,11] | — | (31,20) comme une seule comparaison observée. Le vrai paquet correspond, `matched:true`, préfixe scellé |
| Même arête et un contre-exemple au tuple exact, ou une ancienne entrée sans tuple pour ce contrôle | — | Rejeu local écarté. Le service choisit (45,20) |
| Preuve du panneau N1 conservée au changement d'époque | — | N2 démarre sur sa propre portée et conserve le choix nominal (17,20) |

Le compilateur du produit et la couche source d'origine gardent leur contrat. Sur le service natif, un effet multifactoriel produit par le contrôle d'un seul facteur réfute l'indépendance du modèle sur le même panneau et la même époque. L'arête locale fournit le tuple complet, l'action, le résultat observé et les références du retour. Une contradiction applicable ou deux résultats divergents à la même entrée l'écartent. Une réexécution n'autorise qu'un pas et son contexte est gardé comme essayé. Les contre-exemples des tests viennent de retours construits. Le reçu nominal conserve le vrai paquet officiel.

Les deux candidats WEAV et COMB ont des branches et preuves propres. Les points de branchement dans le runtime et le propriétaire partagé ont été signalés au Banc avant assemblage.

[Commande de rejeu](README.md). Reçu `artifacts/qualification-comb-contre-exemple-46/24e97436.json`, SHA-256 `7f533488668aa529718bafd6ffb1702352a599344b0ca1df2df92b556b1a5f05`.
