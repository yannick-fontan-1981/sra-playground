# Situations symboliques de transfert

Ce lot teste une seule capacité. Il faut préparer une action irréversible en s’appuyant sur un prérequis, puis réviser le choix si la dépendance ou sa preuve change. Les situations et leurs corrigés s’exécutent avec Node.js 20 et sa bibliothèque standard.

## Générer et vérifier

Depuis ce dossier, les deux premières commandes produisent et vérifient les huit cas de la graine 107. La troisième exécute également les tests de composition, de reproductibilité, de rejet et de rejeu.

```powershell
node generate.mjs --seed 107
node verify.mjs generated/107
node --test test.mjs
```

Le dossier `exemple` contient la même livraison déjà générée. On peut la contrôler directement avec `node verify.mjs exemple`. Chaque fichier de `public/` est une fiche autonome à copier dans une fenêtre ChatGPT. Chaque fichier Markdown de `corriges/` explique les choix admissibles pour la fiche de même nom. Le manifeste privé `corriges/corpus.json` conserve la graine, les modèles, les corrigés structurés et la filiation.

## Rejouer le cadran masqué avec Agenda

La graine fixe la situation publique. Les deux positions réelles du cadran restent possibles pour cette même fiche. Pour recréer uniquement le parent et son enfant masqué, puis ouvrir cet enfant dans le premier monde, exécuter les commandes suivantes depuis ce dossier.

```powershell
node generate.mjs --seed 107 --chain mask
node verify.mjs generated/107-mask
node play.mjs generated/107-mask/public/9fd1072013fd810d513c.md --monde 1
```

L’opérateur peut relancer la dernière commande avec `--monde 2` pour le second monde. Sans cette option, le rejeu tire le monde au hasard. L’opérateur transmet la fiche initiale à l’agent, saisit ses actions, puis lui transmet chaque retour dans l’ordre. Le numéro du monde reste chez l’opérateur. Le rejeu lit uniquement le Markdown public. Il accepte également les actions sur l’entrée standard, une par ligne.

- [Fiche publique à copier](exemple/public/9fd1072013fd810d513c.md)
- [Corrigé à consulter après la réponse](exemple/corriges/9fd1072013fd810d513c.md)

## Monde et composition

Le premier marquage d’une des deux cases engage définitivement un tampon. La validation exige deux marques du tampon relié à la sortie que désigne le cadran. La lecture révèle cette sortie. Chaque action coûte une unité. Une réponse admissible minimise le nombre d’actions dans le pire des mondes compatibles avec la fiche. Lorsque plusieurs ordres de marquage conviennent, chaque branche du plan peut choisir son ordre indépendamment.

| Transformation | Modification | Relation contrôlée entre parent et enfant |
| --- | --- | --- |
| `rename` | Remplace tous les noms par une bijection. | Transport exact de tous les plans gagnants par monde, y compris les plans plus longs, et de toutes les politiques réalisables. |
| `add` | Introduit un tampon utilisable qu’aucune sortie ne demande. | Égalité des plans minimaux dans chaque monde et des politiques minimales sous les observations disponibles. |
| `rewire` | Une sortie exige désormais un tampon d’une autre branche. | Une seule dépendance change. Pour la sortie concernée, tous les anciens plans gagnants échouent et chaque nouveau plan gagnant emploie le nouveau tampon. |
| `mask` | Retire la position observée du cadran. | Le monde du parent conserve ses plans physiques. Les deux mondes de l’enfant ont la même fiche et des engagements incompatibles. Seule la lecture permet une décision qui garantit le but. |

La livraison possède quatre enfants directs et prolonge l’enfant `rewire` par `mask`, puis `rename` et `add`. Chaque arête porte la transformation et les paramètres nécessaires pour comparer ses extrémités. L’identifiant privé d’un cas est calculé sur le parent, la transformation et le modèle. Les noms publics sont opaques et les listes triées. La fiche publique contient les règles observables, sans filiation ni nom de stratégie.

Pour construire une autre suite, utiliser par exemple `node generate.mjs --seed 42 --chain add,rewire,mask,rename`. Les opérations `rename`, `add` et `rewire` peuvent être réappliquées. Un masquage exige encore une position visible. Pour repartir directement d’un cas conservé, la fonction exportée `derive(parent, kind, seed)` de `generate.mjs` accepte l’enregistrement du manifeste et produit un enfant.

## Ce que contrôle l’évaluateur

L’évaluateur relit chaque fiche Markdown, instancie chaque valeur du cadran compatible et explore les transitions jusqu’à la validation. La profondeur maximale est de quatre actions, car chaque case se marque une fois, le cadran se lit une fois et la validation termine la partie. Il combine les traces gagnantes en politiques. Deux traces doivent choisir la même action tant que leurs observations sont identiques. Il conserve toutes les politiques de coût minimal et vérifie l’égalité exacte avec les réponses du corrigé, ainsi que le tampon invoqué comme preuve dans chaque monde. Le générateur construit ses réponses directement à partir des dépendances. L’évaluateur applique ses propres règles de transition. [Énumération](enumerate.mjs) · [Contrôle des fiches et des filiations](verify.mjs)

| Contrôle exécuté | Couverture |
| --- | --- |
| Livraison de la graine 107 | 8 cas, 12 mondes compatibles, 96 plans physiques gagnants comptés par cas et par monde. Sur 48 politiques gagnantes, 24 sont minimales. |
| Relations dans cette livraison | 7 arêtes vérifiées, dont 2 renommages, 2 ajouts, 1 déplacement et 2 masquages. Profondeur maximale de 4 générations après la racine. |
| Composition et autres graines | 24 permutations sur la graine 107, soit 65 cas distincts avec les préfixes communs. Les graines 1 à 15 ajoutent 120 cas. Total de 185 cas distincts, dont les 8 livrés, et 294 mondes comptés par cas. |
| Relations sur les 185 cas | 46 renommages, 46 ajouts, 31 déplacements et 46 masquages. Les propriétés de la décision sous information partielle sont vérifiées dans les 109 cas à cadran masqué. |
| Reproductibilité | Deux répertoires générés avec la graine 107 sont identiques octet par octet. Les 15 autres graines reproduisent chacune leur corpus en mémoire. |
| Contre-exemples | Le vérificateur sur disque rejette un corrigé qui choisit selon une position jamais observée. Trois autres mutations sont rejetées en mémoire : un ordre admissible supprimé, un faux tampon cité comme preuve et le corrigé du parent conservé après déplacement. |
| Interface Agenda | Le même fichier public est rejoué dans les deux mondes. Dans chacun, la bonne branche réussit et l’autre échoue. |

Le point de départ Git est `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le générateur reprend le tirage xorshift32 du pilote et le principe de ses campagnes qui comparent les résultats sur les mêmes cas. Le lot évalue la qualité des situations et des corrigés. La performance de SRA relève d’une expérience ultérieure. [Générateur du pilote](https://github.com/yannick-fontan-1981/sra-playground/blob/145b8c764477fe913709e999747a0f8db125d060/scripts/sic-transfer-generator.mjs) · [Campagne du pilote](https://github.com/yannick-fontan-1981/sra-playground/blob/145b8c764477fe913709e999747a0f8db125d060/scripts/sic-transfer-campaign.mjs)
