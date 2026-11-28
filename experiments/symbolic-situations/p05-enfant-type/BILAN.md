# Enfant P05 typé · preuve consommée par le parent

Candidat `162e45506cd9196171c15cb2402cf2ca1ee4266d`, base `09b9a509e5e07894b9fccf170f22ae26cbeffbda`, dont l’arbre moteur est celui du parent de préenregistrement. Contrat opérateur `fe3d4297` avant lecture du détail. Rejeu autonome du vrai G50T N1 en SIC et budget global 16 sur les deux SHA. Les 16 commandes, paramètres, paquets et issues par commande concordent. Le candidat clôt six enfants, quatre avec translation et deux indéterminés.

**Mesure réelle.** Au T5, le ticket P05 ACTION4 expose un enfant en attente rattaché au besoin du parent et à l’observation courante. Son vrai retour lie les deux vues et mesure `[6,0]`. Une mesure indépendante des pixels sur les cinq gestes rejoués retrouve un composant unique de 24 pixels de même couleur et de même forme, de `(14,8)` à `(20,8)`, avec le paquet attendu. Le parent cite la référence du retour T5 au T6 et libère ACTION4 sous P07, avec projection `(26,8)` confirmée par le vrai retour.

| Intervention au T5 dans le service ciblé | Reçu de l’enfant et décision suivante |
| --- | --- |
| Témoin au vrai retour | Translation `[6,0]` inscrite avec sa référence. T6 ACTION4 sous P07 et même paquet que le nominal autonome. |
| Vrai geste joué, vue présentée stationnaire | `unresolved / no_single_axis_step`, aucun vecteur acquis. Le T6 proposé passe à ACTION5 sous P05. Cette proposition reste au stade de la décision. |
| Seule provenance d’ouverture remplacée par celle du vrai retour T3 | Même paquet réel et même paquet présenté au T5. Le reçu typé et le vecteur sont absents. T6 ACTION3 sous P05, joué, avec paquet différent du T6 nominal. |
| Acquisition T5 retirée avant choix du parent | La translation et sa référence étaient construites. Retirer ces données dérivées et leur reçu laisse le même paquet T5, puis T6 ACTION3 sous P05, réellement joué. |

Les quatre contrôles totalisent 23 gestes sur le candidat. Ils distinguent l’effet physique, son rattachement au bon essai et sa consommation par le parent. Les 31 tests ciblés du candidat passent. [Reçu réduit](recu.json)

## Rejeu

Copier [parcours.mjs](parcours.mjs) à la racine des deux checkouts exacts sous `operateur-enfant-p05.mjs`, et [mesure.mjs](mesure.mjs) dans le candidat sous `mesure-operateur.mjs`. La racine du jeu est celle du Banc local avec Pyodide.

```powershell
node operateur-enfant-p05.mjs base <racine-jeu> <reçus>/base.json
node operateur-enfant-p05.mjs candidat <racine-jeu> <reçus>/candidat.json
node mesure-operateur.mjs <racine-jeu> <reçus>/candidat.json <reçus>/mesure.json
node <dossier-opérateur>/verifier.mjs <reçus>
```
