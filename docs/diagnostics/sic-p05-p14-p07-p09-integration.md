# Intégration expérimentale P05 → P14 → P07 avec P09

La branche `experiment/sic-p05-p14-p07-p09-integration` réunit les trois révisions mesurées `3e33f0f6`, `05b9e74a` et `a914ed88` à partir du figé `20433007224accc36e3d7976696d9ee7a783a227`. Le blob du composeur P09 reste `f54a624abaaa89e4d5363f41869017f4e7f99b35`.

## Six régressions temporelles

Le test ciblé régénère les six cas publiés, vérifie leurs signatures et exécute chacun de leurs deux mondes dans les deux bras. Avant le changement, le candidat échoue sur 11 des 12 mondes et le figé en réussit 12. Demander une quatrième mesure fiable dans chaque phase rétablit les 12 réussites de l’actif, sans traversée hors fenêtre sur ces mondes et sous leurs plafonds d’origine.

Sous 64 gestes et 12 000 états par monde, le même rejeu ciblé de développement donne 12/12 dans chaque bras, avec 306 gestes cumulés pour le figé et 387 pour l’actif. Le maximum d’un épisode est de 47 et 60 gestes respectivement. Aucun de ces six cas connus ne fait partie du résultat à l’aveugle.

La nouvelle campagne sur `b225b1df` reproduit les 8 000 signatures et les 767 décisions finales du bras figé. Le candidat passe de 7 844 à 7 962 réussites. Il récupère 127 cas et en perd 9 face au candidat précédent. Aucun des 767 cas réussis par le figé n’est perdu. L’audit réunit les huit fragments et leur agrégation. Ces chiffres concernent le banc temporel aux plafonds de développement de 180 gestes, 360 ticks et 20 000 états. [Campagne P14](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46155382495)

## Effet composé joué

`composeObservedTimedAccess` consomme un effet P05 acquis à partir d’un essai réel et d’un contre-essai d’attente. P14 fournit les preuves de chaque tick de passage. P07 propose une route et P09 construit une composition à partir de cette proposition. Le service n’engage qu’une commande à la fois. La traversée en première commande exige que le retour public ait déjà confirmé l’activation. Un nouvel appel recalculera la suite depuis le retour reçu.

Le test exécute un terrain construit avec des tickets V6, passe l’activation différée, traverse sur deux ticks et scelle le paquet terminal. Les deux essais d’acquisition et les 22 lectures de phase sont facturés dans le même plafond de 64 gestes. Retirer la preuve P05 ou un seul des deux témoins temporels retire l’offre de passage. Le compteur hôte facture chaque état examiné par les recherches P07 et P09 de cette composition. Le terrain et les tests couvrent une chaîne, sans exercice du reste de l’agenda SIC ni du pack strict sur un jeu officiel.

```powershell
node --test tests/sic-observed-timed-access.test.ts tests/sic-p14-subject.test.mjs
```

## Comparaison indépendante

Les 6 000 cas générés et les 36 niveaux natifs appartiennent au scellement `SIC-OP-20261128-01`. La comparaison qualifiante exige un adaptateur du pack strict, un compteur hôte couvrant aussi les autres recherches de ce pack et un exécuteur confiné éprouvé par l’opérateur. Le raccord expérimental facturé ci-dessus ne couvre que ses deux recherches. Le test V6 emploie une famille de test dédiée. Les deux bras sur la réserve restent à exécuter. Les données privées de l’opérateur et SS08–SS25 restent sous scellés. [Conditions de qualification de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/d0f7c0b9/docs/diagnostics/sic-operateur-independant/2026-11-28/SIC_SYNC.md)
