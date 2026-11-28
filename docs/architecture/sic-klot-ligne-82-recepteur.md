# KLOT, ligne 82 — rattacher le rôle au corps qui a bougé

## Première divergence préenregistrée

Le [lot nominal](sic-klot-ligne-82.md) à `a0df8a9b` utilise le
moteur du gel `d0e7527c`. Il reste le parent du correctif. Le clic
crée une hypothèse de sélection. La sonde rattache ensuite une
translation observée à un corps.

Deux départs auxiliaires jouent le vrai KLOT et fournissent leurs
retours à un ticket de la session nominale. Au T7, le ticket
ACTION1 vise la pièce 6, alors que le retour auxiliaire déplace
seulement 11. Au T9, le ticket ACTION1 vise la pièce 12, alors
que la sélection auxiliaire de 6 en (20,23) la déplace seule.
Les deux sessions nominales conservent leur état jusqu'à la
libération du ticket. [Reçu opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/575d1cbeed67911d0c3280d11ccd96983e26daed/experiments/symbolic-situations/klot-ligne-82/BILAN.md)

Dans les deux cas, le retour du gel est `matched:false`, scelle
le plan, laisse zéro modèle et arrête la reprise sur
`rigid_control_or_collision_model_refuted`. L'écart visé est
uniquement le rôle du reçu acquis. La pièce encore sélectionnée
ne doit plus recevoir `observed_exclusive_receiver` quand sa
pose n'a pas changé. L'hypothèse de sélection, le changement
de poses, les références, les modèles réfutés et l'arrêt sont
conservés.

Les trois retours nominaux sur 11, 6 et 12 doivent rester
identiques. Un déplacement exclusif de deux cases du corps
sélectionné demeure observable même si cette distance réfute
les modèles unitaires. La vérification sépare la mesure de la
population réelle du rôle attribué et de la validation de la
loi de commande.

## Raccord et portée

`NativeSelectedRigid.record` compare les poses portées par les
mêmes clés et masques dans les deux observations. Le rôle exclusif
requiert le déplacement de la pièce sélectionnée et l'immobilité
de toutes les autres. Les observations conservent la sélection, la
mesure physique et les références du ticket. La comparaison du
modèle porte toujours sur la population complète. Elle conserve
l'épuisement des modèles quand le retour ne correspond à aucun.

Le rôle était publié dans le reçu d'acquisition
`selected_rigid_event` et dans l'état retenu. Dans le moteur du gel,
les deux références à sa valeur sont le schéma et le propriétaire.
`NativeSelectedRigid.install` restaure l'état et les modèles du
dernier événement. `proposeCurrent` s'arrête sur l'ensemble de
modèles vide, ce qui explique le même arrêt dans les deux
contre-épreuves. L'admission physique et l'acquisition du rôle
se vérifient indépendamment.

Les deux cas échouent sur le rôle exclusif au gel et donnent le
rôle conditionnel sur le correctif. Le contrôle local passe quatre
tests sur le jeu officiel, 58 tests de contrat et le typage. Les
16 décisions nominales, 16 retours et 17 observations sont
identiques dans la capture A/B à horloge déterministe, avec le
passage officiel au T12.

## Reproduction

Node 24. `SIC_KLOT_GAME_ROOT` indique les actifs officiels et Pyodide.
Les deux nouveaux tests libèrent le ticket nominal dans le vrai
service et lui présentent le paquet d'un départ auxiliaire qui joue
l'autre sélection. Pour reproduire l'ancien rôle, prendre
`03fba8c8`, dont l'arbre moteur est celui du gel.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-klot-line-82.test.ts
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/v6-selected-rigid-native.test.ts tests/v6-selected-rigid-integration.test.ts tests/v6-selected-rigid-reference.test.ts
npm run typecheck
```

[Tickets et retours](../../tests/sic-klot-line-82.test.ts) ·
[Acquisition et reprise](../../src/logos-engine/v6-selected-rigid.ts)
