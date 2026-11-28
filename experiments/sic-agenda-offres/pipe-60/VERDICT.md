# Verdict PIPE · ligne 60

Le catalogue `8ce7ee35` et le gel `d0e7527c` donnent le même préfixe physique et les mêmes commandes sur 16 gestes. Le N1/T1 relève de `public_occurrence_recall / radial_port_composition / OP18`. Le service se sert déjà de la géométrie mesurée pour compiler puis vérifier le montage. Le lot ajoute les contrôles et le reçu.

| Situation | Preuve et décision observée |
|---|---|
| N1/T1, grille 3×3, pas 16 | Les raccords initiaux, en indices de cellules commençant à 0, sont 0 est–1 ouest, 1 est–2 ouest, 3 est–4 ouest et 4 est–5 ouest. Huit ports sont ouverts. Le montage conditionnel exploré en 7 états totalise huit raccords, aucun port ouvert et un graphe connexe. La séquence de quarts de tour par cellule est [0,0,0,1,0,1,1,0,1]. |
| Premier clic à (16,28) | La commande isolée teste le point de la cellule 3. Ses ports nord et est deviennent est et sud, ce qui raccorde son port sud au port nord de la cellule 6 (16,44). La marque de sélection et les ports inchangés ailleurs permettent d'acquérir le quart de tour horaire. |
| Retour T1 stationnaire ou seul port de la cellule 1 modifié après le vrai clic | Le premier ne confirme ni la sélection ni la rotation. Dans le second, la cellule 3 tourne encore comme dans le vrai retour, mais le contraste de la cellule sœur empêche d'attribuer un effet local préservant les autres ports. |
| N1/T2, mêmes ports et même clic (48,28), seule méthode retirée | Trois opérations sont conditionnellement justifiées avec la méthode. Sans elle, le service propose un nouveau test à une action avec un effet inconnu. Le retour nominal T2 correspond aux ports, mais 371 pixels extérieurs changent et ferment ce préfixe. |
| N2/T5 et N3/T13 | Une unique réépreuve du point revalide le quart de tour pour l'epoch courant. En N2/T6, la méthode justifie sept opérations. La fin officielle de N1 en T4 et de N2 en T12 est enregistrée séparément. |
| Même N3/T14 réel avec et sans un pixel extérieur ajouté au retour présenté | Les ports prévus correspondent dans les deux cas. Sans différence extérieure, le T15 (14,22) reprend le même plan à l'indice 1. Avec le pixel extérieur sans explication, le plan se ferme. Le même clic provient alors d'un nouveau plan de deux actions, à l'indice 0. |

`measureRadialPorts`, `assemblePorts`, `RadialPortMemory` et `radialPortBefore` / `radialPortAfter` portent respectivement les mesures, le calcul, l'acquisition et les gardes consommées par le service. Le rattachement au retour courant est commun aux contrôles de provenance. Ici l'effet exige en plus une cellule sélectionnée, une rotation unique expliquant ses ports et la préservation des autres cellules. La continuation demande aussi l'absence d'un changement extérieur inexpliqué.

Six préfixes et 400 tests passent. Le premier lancement des tests dans le checkout partiel manquait du corpus public V41. Durée du préenregistrement au reçu 10 min 21 s. Harnais `aa75791a365b1ab6edcfa6a464654c6432cb3b46`. Reçu local `artifacts/qualification-pipe-60/aa75791a.json`, SHA-256 `3e9a02b13da34b2f9589e87338eefe8d2fa4390c84e4c35101a906230d26b6bd`. [Commande de rejeu](README.md).
