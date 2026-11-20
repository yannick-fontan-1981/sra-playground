# Comment départager les causes d’un mouvement

Cette expérience part des 100 traces sources et prolonge le candidat figé v15. Elle examine deux questions. Suffit-il d’avoir vu une commande agir une seule fois pour choisir un test qui distingue trois causes possibles ? Peut-on prévoir ce qui arrivera en déplaçant le mécanisme si cette préparation déplace aussi le voyageur ? Les résultats portent sur les jeux sources. La v15 reste la version évaluée sur Custom 4.

## Ce que les sept jeux permettent de distinguer

La v15 a annoncé ses coordonnées avant chaque transition des traces supérieures. Un même geste peut fournir plusieurs objets à suivre. Les deux colonnes centrales comptent uniquement les objets qui ont ensuite bougé. La dernière colonne indique la fréquence à laquelle le modèle a prédit à tort un déplacement quand l’objet restait immobile.

| Jeu | Niveaux | Arrivées mobiles exactes | Répéter le dernier déplacement | Faux mouvements |
| --- | --- | ---: | ---: | ---: |
| GRAV | L2–L5 | 236/310 | 97/310 | 41/97 |
| GARE | L2–L3 | 14/14 | 11/14 | 0/6 |
| POLA | L2–L5 | 8/50 | 2/50 | Aucun cas immobile |
| CWSE | L2 | 163/165 | 161/165 | 28/28 |
| CATR | L2–L3 | 27/37 | 13/37 | Aucun cas immobile |
| GIGO | L2–L5 | 127/127 | 127/127 | 100/100 |
| MOTO | L2 | 102/102 | 37/102 | 2/4 |

Dans GIGO, les 127 arrivées en mouvement étaient déjà prévisibles en répétant le dernier déplacement. Les 100 faux mouvements rendent particulièrement visible l’information manquante sur le moment où une commande peut agir. Dans GRAV et MOTO, changer de repère apporte un gain sur les destinations mobiles. Dans POLA, 42 des 50 destinations échappent encore à ce modèle.

## Choisir un essai qui tranche entre trois explications

Une première arrivée est compatible avec un point fixe du monde, un déplacement propre au voyageur ou une destination relative à un autre objet. SIC sélectionne deux placements possibles d’un objet qu’une autre commande a déjà déplacé. Il ne propose un essai que si la destination associée à cet objet diffère des prévisions des deux autres explications. La variante plus exigeante vérifie également qu’au moment où la préparation avait déplacé l’objet, le voyageur était identifiable et était resté immobile. En cours d’exécution, une contradiction interrompt le programme. Le moteur indépendant rejoue le même préfixe en supprimant les gestes retenus.

Sur les 100 entrées initiales, la variante exigeante confirme 20 hypothèses sur 139, toutes dans VOIS. Parmi les 105 essais lancés après une seule réponse mobile et sans autre repère déjà identifié pour la commande, six passent ces contrôles. Sur les huit entrées supplémentaires de VOIS et KA59 aux niveaux 2 à 5, un essai sur 121 passe les contrôles. Il se trouve dans VOIS L4, après une seule observation. Au préfixe 40, le voyageur reste en `(38,10)` pendant que deux gestes déplacent l’objet de `(18,14)` en `(18,22)`. La commande suivante conduit le voyageur en `(18,22)`. Depuis le même préfixe, la commande seule l’aurait conduit en `(18,14)`. La version plus permissive trouve deux témoins de cette sorte dans VOIS L4 et aucun sur les 240 propositions des 18 niveaux supérieurs des sept jeux.

L’intégration précoce de ces essais en partie autonome fait perdre GRAV L3. Elle lance trois essais sans placement confirmé et épuise ses 120 commandes. Une seconde intégration, conservée dans cette branche, attend l’épuisement des expériences prioritaires. Sur les sept parties rejouées, elle conserve GRAV L3 en 53 commandes, GIGO L3 en 12, VOIS L1 en 50 et PORT L1 en 20. Elle ne lance aucun essai de départage sur ces sept parties. L’expérience de VOIS L4 a été obtenue depuis un préfixe archivé.

## Prédire aussi les conséquences de la préparation

Le laboratoire conserve les mêmes propositions et les mêmes suites de commandes que la v15. Il produit une nouvelle prévision avant de rejouer la suite. À chaque geste de préparation, il actualise simultanément la position du mécanisme, celle du voyageur et celles des autres objets identifiables. La commande finale est ensuite évaluée dans cette disposition. La comparaison des 157 propositions confirme que tous les gestes et toutes les prévisions d’origine sont identiques entre les deux fichiers scellés. Quatre jeux émettent les 36 propositions initiales, et cinq entrées émettent les 121 propositions supérieures (CATR L2–L3, GRAV L3–L4 et POLA L5). Les deux prévisions sont mesurées sur la même branche physique. Les cas où les deux objets restent identifiables après la préparation constituent le dénominateur de la comparaison ci-dessous.

| Cohorte source | Préparations mesurables | Deux positions exactes avec déplacement constant | Deux positions exactes avec mise à jour simultanée | Arrivées mobiles après deux positions exactes, avant → après |
| --- | ---: | ---: | ---: | ---: |
| 100 entrées initiales | 36 | 20 | 22 | 20 → 22 |
| 18 entrées supérieures des sept jeux | 115 sur 121 | 2 | 62 | 1 → 24 |

Sur ces 115 essais supérieurs, le repère change réellement de place 64 fois. La nouvelle prévision en retrouve la position dans 34 cas, contre 6 auparavant. Sur les 24 arrivées mobiles après un placement correctement prédit, trois satisfont également les contrôles de suppression avec déplacement effectif du mécanisme. Dans CATR L2 et L3, il s’agit d’un retour du voyageur à sa position d’origine après plusieurs applications du même geste. Dans GRAV L4, le voyageur atteint une autre position et la préparation utilise une commande différente de la commande finale. Aucune des trois branches ne démontre un usage suivant contrôlé.

Dans GRAV L4, au préfixe 109, SIC prévoit le passage du repère de `(8,12)` à `(12,44)` et du voyageur de `(20,8)` à `(20,24)` sous deux applications de la préparation. La commande finale seule conduit en `(48,8)`. Après préparation, elle conduit en `(52,24)`, comme prévu. Le voyageur et le repère ont tous deux bougé pendant la préparation. La comparaison avec la commande seule mesure donc l’effet de la disposition entière.

Nous avons rejoué chacun des 1 722 programmes de longueur un ou deux accessibles depuis cette même situation, avec toutes les commandes sans coordonnées disponibles et les 36 positions de clic déjà observées. Deux branches atteignent aussi `(52,24)` et deux rendent le voyageur non identifiable. Les deux chemins courts confirmés contiennent la préparation. L’un applique `ACTION7` une seule fois avant `ACTION4`. Cela réfute la nécessité du deuxième geste de préparation pour cette destination. Aucune des branches examinées ne place le voyageur en `(20,24)` avec un autre repère identifiable, donc cet essai ne permet pas d’isoler l’effet du repère de celui du déplacement du voyageur.

Les [mesures par niveau](sic-source-moving-frame-interventions.json) incluent les essais concurrentiels, les résultats en autonomie et les contrôles sur les actions omises. Le laboratoire emploie `scripts/test-source-motion-frames.mjs` pour produire et signer les prévisions (`SIC_STUDY_PAIRED_IDENTIFY=1`, ou `SIC_STUDY_INVERSE=1` et `SIC_STUDY_NESTED=1`). Le vérificateur `scripts/score-source-projected-preparations.mjs` rejoue ensuite la composition et ses témoins dans un moteur séparé. Aucun essai Custom 4 n’a été lancé avec ce prototype.
