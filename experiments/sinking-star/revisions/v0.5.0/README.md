# SS01 v0.5.0 — deux Marchands au niveau 1

Demande : deux personnages présents au départ, devant occuper les deux cibles de l'autre îlot.

Le terrain ouvert du niveau 1 est conservé. Nouveau Marchand en (3,12), nouvelle cible en (14,7), coordonnées zéro-based dans la carte 19x19. La première cible reste en (16,4). Aucune duplication. Les deux destinations doivent être occupées simultanément, sans attribution à un personnage précis. Niveaux 2–8, moteur, prévisualisations et animations inchangés par rapport à v0.4.0.

## Sauvegarde exacte

`v4-to-v5.patch.gz` contient le delta complet des sources, tests et documentation depuis le ZIP livré `Sinking-Star-Lab-SS01-v4.zip`. Les fichiers compilés sont régénérés, pas patchés. Il inclut la fixture historique v4 et les dix tests v5.

SHA-256 du patch décompressé : `189bee3633f9d7ceb95f2566e9ccf8cb585b745d7666cad725779f96da4d9f9c`.
SHA Git du blob compressé : `4fddca08d6f6809b582c9a82265d621a332950e8`.

## Reconstruction

Depuis la racine d'une extraction propre du ZIP v4 (contenant `experiments/`) :

```sh
gzip -dc /chemin/v4-to-v5.patch.gz > /tmp/ss01-v5.patch
git apply --check /tmp/ss01-v5.patch
git apply /tmp/ss01-v5.patch
cd experiments/sinking-star
npm test
npm run validate
```

Node et TypeScript doivent être disponibles. Le HTML autonome est produit sous `dist/ss01-demo.html`.

## Validation exécutée

135 tests passent : 125 tests historiques conservés, 10 nouveaux. L1 résolu par recherche en largeur en 19 commandes ; impossible par la marche seule même avec sélection. Un seul Marchand visitant les deux destinations ne gagne pas. Sélection, Undo, Reset et progression testés.

Chromium/Playwright : campagne entière jusqu'à VICTORY, contrôles et animations vérifiés, zéro erreur JavaScript et zéro requête HTTP. HTML exact injecté par set_content ; file:// non testé.

## Limite de cette sauvegarde

Ce commit sauvegarde le delta v4→v5. Il n'applique pas les livraisons v3/v4/v5 dans les fichiers runtime src de la branche, encore sur la baseline v2. Le ZIP complet v5 livré dans la conversation contient la version jouable complète. Aucun changement du catalogue, du SRA ou du SIC. Aucune intégration canonique et aucune publication Site. Synchronisation du Site existant non vérifiée.
