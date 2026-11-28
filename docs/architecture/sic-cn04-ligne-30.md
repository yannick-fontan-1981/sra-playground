# CN04, ligne 30 — assemblage de ports rigides

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Ligne 30,
CN04 N1/T1 ACTION1, `port_assembly / rigid_port_assembly`. Repartir de
N1 avec les paramètres d'inventaire. Identifier ce que prouve déjà
le premier geste et ce qui doit encore être acquis.

- Séparer la compatibilité des ports, la trajectoire qui relie des
  poses admissibles et le contact ou la fusion réellement observés.
  Rattacher le retour à la bonne commande et à la prochaine décision.
- Sur une autre pose ou avec une preuve retirée, garder la commande
  comparable et vérifier le premier refus ou changement de plan.
  Un mouvement confirmé a son propre reçu, même sans contact.
- Retrouver le vrai contact si la prolongation ou une archive
  comparable le permet. Sinon borner précisément la preuve au
  préfixe. Le point officiel éventuel a une portée distincte.
- Attribuer le comportement du gel, les contre-épreuves construites
  et tout changement minimal à leurs révisions respectives.

## Compatibilité, trajet et contact au gel

| Étape | Ce que le ticket connaît | Ce que montre le retour |
|---|---|---|
| N1/T1–T4 | `measurePortLayout` mesure deux corps sur une maille de 3 pixels, chacun avec deux ports. T1 est ACTION1 et étalonne le contrôle. Aucune pose d'assemblage n'est encore offerte. | T1 déplace le corps de pose (0,3,3) à (0,3,2), soit un pas (0,−1) en unités de maille. Le reçu du ticket ne porte aucune prédiction booléenne. Les trois autres gestes établissent leurs translations. |
| T5–T7 | `assemblePorts` trouve l'assemblage ((3,7,10),(0,12,9)). Aux poses de départ, les translations seules ne peuvent l'atteindre. La famille propose trois ACTION5 pour orienter le premier corps. | Les trois retours remesurent successivement les orientations 1, 2 et 3. Le trajet de translation devient calculable dans cette orientation. |
| T8–T17 | `portAccessPath` trouve sept ACTION2 puis quatre ACTION4. Les poses prévues respectent les bornes et les cœurs restent disjoints. La garde retrouve l'occupation avant chaque pas. | Les retours intermédiaires confirment les poses. T17 ACTION4 est confirmé, le score reste 0 et les deux cellules du contact final portent encore la couleur de port 8. |
| T18 | Le dernier ACTION4 relie la pose courante à l'assemblage prévu. Dans le modèle, chaque point commun appartient à deux ports de propriétaires distincts. | Les deux premières images retournées concordent avec l'occupation de l'assemblage. Elles montrent (12,11) et (12,13) en coordonnées de maille, de valeur 3 au lieu de 8. La dernière image ouvre N2 et le score passe à 1. Le reçu moteur se ferme sur `official_boundary`, avec `matched:null`. |
| N2/T19 | Quatre pièces et des nombres de ports [2,4,4,2] constituent une autre configuration. Le même ACTION1 ouvre une calibration sur ces nouveaux corps. | Le scénario repart avec une pose courante à mesurer. Le gain de N1 ne tient pas lieu de contact dans la nouvelle époque. |

`compatiblePorts` contrôle les bornes, l'absence d'intersection des
cœurs avec les autres matériaux et au plus deux ports par cellule.
L'assemblage complet exige exactement deux propriétaires pour chacun
des ports. Le calcul décrit une pose géométriquement admissible.
`portAccessPath` cherche un parcours selon les commandes mesurées.
Le plan peut sceller un premier essai de transit avec recouvrement.
Le trajet nominal N1 n'a pas besoin de cette hypothèse.

Deux contrôles réemploient les vraies poses. À T8, supprimer la
translation ACTION2 du calcul de chemin conserve l'assemblage
compatible, mais rend son trajet inaccessible avec les translations
restantes. Présenter à la garde isolée le raster officiel d'avant les
rotations fait refuser le même premier ACTION2. Le témoin T17/T18
offre le même ACTION4 avec deux effets mesurés, une translation
avant contact puis un assemblage visible et un gain. La mesure
d'assemblage exploite les images effectivement retournées avant que
le plateau ne change. Elle est distincte du reçu officiel du moteur.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L70)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L56)
· [Compatibilité](../../src/logos-engine/v6-port-assembly.ts?plain=1#L112)
· [Trajet](../../src/logos-engine/v6-port-assembly.ts?plain=1#L218)
· [Proposition](../../src/logos-engine/v6-port-assembly.ts?plain=1#L246)
· [Garde et acquisition](../../src/logos-engine/v6-port-assembly.ts?plain=1#L301)

## Reproduction et portée

**16/16 occurrences** du catalogue sont retrouvées. Les 16 commandes et
retours concordent sur `8ce7ee35` et le gel hors métadonnée `palette`.
La prolongation T17–T19 apporte le véritable contact, le gain officiel
et la première décision de la nouvelle configuration. Elle ne se compte
pas comme une recapture supplémentaire du catalogue.

Avec Node 24 et les actifs Pyodide préparés sous `public/` :

```powershell
node --test tests/sic-cn04-line-30.test.ts
node --test tests/v6-interface-families.test.ts tests/v6-native-interface-families.test.ts
```

`SIC_CN04_GAME_ROOT` désigne au besoin le checkout des actifs.
`SIC_CN04_ENGINE_ROOT` isole le checkout de code du gel. La branche
ajoute le dossier et les assertions. La qualification indépendante
reste ouverte.

La caractérisation passe 1/1 sur le jeu réel et les contrats des
interfaces 106/106. Branche ouverte à 23:46:15, critères figés
à 23:46:38, premier rejeu du gel à 23:46:47 et verdict local
à 23:49:36 (UTC−3).
