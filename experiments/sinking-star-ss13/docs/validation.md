# SS13 — validation de la version 0.2.0

## Résultats de livraison

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript stricte et HTML autonome | Réussis |
| Tests moteur | **31/31** |
| Parcours d’auteur | **8/8 WIN** |
| Entrées rejouées | **781**, dont 49 sélections |
| Refus et morts dans les témoins | **0 / 0** |
| Images contrôlées | **2 411** |
| Tutoriel au niveau 1 | **14/14 découvertes**, parcours de 77 entrées |
| Undo des fins de salle et relecture déterministe | Vérifiés sur les huit salles |
| HTML compilé dans Happy DOM | Réussi, huit routes complètes, pixels et durées contrôlés |
| Audit indépendant des finales | **16/16 contrefactuels** ; 9 fichiers hors périmètre identiques |
| Régénération des deux fichiers d’auteur | Identique octet pour octet ; 5 + 8 branches locales rejouées |
| Rendu dans Chromium (Microsoft Edge 158.0.4370.33) | **Réussi** sur ordinateur et à 390 px |

Les rapports détaillés sont `validation/levels-report.json`, `validation/ui-dom-report.json`, `validation/design-constraints-report.json` et `validation/hard-finals-report.json`. Les deux premiers portent le SHA-256 exact du HTML vérifié. `validation/browser-report.json` contient le contrôle Chromium. `validation/browser-availability.json` décrit les tentatives historiques.

## Différences mesurées des finales

| Mesure du parcours d’auteur | Niveau 7 — avant → après | Niveau 8 — avant → après |
| --- | ---: | ---: |
| Entrées, sélections comprises | 49 → **231** | 48 → **212** |
| Entrées comportant traction, échange, reflet ou presse | 11 → **42** | 5 → **39** |
| Séquences de manipulation, tractions consécutives regroupées | 5 → **17** | 5 → **26** |
| Changements de circuit observés | 0 → **6** | 0 → **34** |
| Contrefactuels indépendants de la nouvelle salle | **6/6** | **10/10** |

Le regroupement considère la direction et le type de cargaison ; une marche ou un changement de circuit sépare les séquences. Ces mesures décrivent les témoins. Elles ne comptent pas des problèmes cognitifs indépendants et ne mesurent pas la difficulté par un facteur numérique.

Le niveau 7 ajoute un poids récupéré, un miroir devenu deuxième poids final, des accès commandés en opposition et une arrivée de presse initialement retirée. Le niveau 8 réemploie ses deux caisses et ses deux miroirs entre les retours, la presse et les commandes ; son monstre reste un poids vivant. Les autres solutions élaborées restent possibles. Les deux recherches de contournement limitées à 12 000 états atteignent leur limite et sont déclarées **inconclusives**.

## Contrat moteur

Les 31 tests couvrent la traction d’un seul occupant, l’absence de poussée et de capacité forcée, la sélection sans tour, les échanges avec la première cible, les visées déviées et les boucles, les priorités des miroirs, les appuis fixes, les cascades hydrauliques, les attaques simultanées et l’annulation.

Le validateur de campagne vérifie la correspondance exacte entre références d’auteur, cartes distribuées, crédits et actions pixel. Il contrôle l’absence de superposition des occupants, le contrat 64 × 64 / palette de 16 couleurs, chaque transition d’animation, l’absence d’état privé dans les observations et la progression jusqu’à WIN. Les huit cartes sont distinctes et les itinéraires sont absents du HTML.

## Interface compilée

Le vrai HTML construit est exécuté dans Happy DOM avec un tampon canvas et une file d’animation contrôlée. Les actions passent par les événements clavier, clics et boutons.

Les vérifications couvrent douze situations du duo, reflets proches/égaux, prévisualisations, miroir sur bouton, refus signalé en rouge, rayon bouclé, sélection sans tour, verrouillage pendant l’animation, interruptions par Annuler/Recommencer/Repartir/sélecteur, réduction des animations et panneaux terminaux différés. Les huit salles présentent leurs deux héros, deux destinations, aides et références. Les huit parcours complets sont également joués dans ce HTML par les événements clavier et clic : chaque image et chaque durée sont comparées, chaque fin de salle est annulée puis rejouée, jusqu’au panneau VICTORY. Le parcours réel du tutoriel obtient les quatorze découvertes depuis les pixels publics.

La découverte « presse » exige une fermeture visible à l’ancienne case d’un occupant puis son déplacement. Elle ne confond pas une élimination au combat avec une poussée.

## Contrôles de conception

`verify-design-constraints.mjs` conserve les trois contrôles des niveaux 4 à 6 : départ du miroir-poids, dégagement d’un axe et mise en service d’un appui pendant une poussée. `audit-hard-finals.mjs` traite séparément les niveaux 7 et 8 reconstruits, avec comparaison aux cartes du commit `61b8d970f30ead54480721c9c080aeb02372a2cc` et contrefactuels aux étapes critiques.

L’audit distingue les entrées totales des manipulations et des changements de commande. Des tractions consécutives d’un même objet ne sont pas comptées comme autant de problèmes distincts. Les recherches de raccourcis sont locales et bornées ; une limite atteinte reste inconclusive. Les fichiers des niveaux 1 à 6, du moteur, du tutoriel et de l’interface sont comparés à la version précédente pour vérifier la portée de cette révision.

Ces vérifications confortent les contraintes reprises des sources. Elles ne prouvent ni l’unicité d’une solution ni la nécessité globale de toutes les mécaniques présentes.

## Navigateur

Le 21 novembre 2026, Playwright a contrôlé le HTML autonome dans Microsoft Edge 158.0.4370.33. Le clavier et les clics réels sur le canvas ont rejoué les huit parcours. Les pixels stabilisés correspondent au moteur après chaque entrée, avec 231 et 212 entrées pour les deux finales. Les quatorze découvertes et le panneau VICTORY ont été observés.

Annuler restaure la dernière action gagnante et Repartir revient au niveau 1. À 390 px, le canvas mesure 344 px et la page reste à 390 px. Les sélecteurs fonctionnent au format mobile. Le HTML autonome a joué sans requête réseau et sans erreur JavaScript.

## Reproduire

Depuis le répertoire du laboratoire :

```sh
npm install
npm test
npm run validate
node scripts/verify-design-constraints.mjs
node scripts/audit-hard-finals.mjs
node scripts/verify-ui-dom.mjs
```

Le dernier script nécessite Happy DOM. La version utilisée est 21.0.4 ; `HAPPY_DOM_MODULE` peut désigner le module installé. Pour un environnement autorisant le navigateur, rendre Playwright/Chromium disponibles puis lancer `node scripts/verify-ui-browser.mjs`. Variables optionnelles : `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` et `SS13_BROWSER_CAPTURE_DIR`.

L’audit des finales lit les sources de la version précédente dans l’historique Git, au commit `61b8d970f30ead54480721c9c080aeb02372a2cc` ; ce commit doit être disponible dans le checkout de validation.

Le build ne lance aucun solveur. Après une modification de carte, reconstruire son fichier d’auteur puis exécuter `node scripts/sync-levels.mjs` avant le build.

## Portée de la livraison

Les témoins démontrent que les huit salles sont solubles dans le moteur livré. Ils ne mesurent pas les performances de SRA. La feuille de route consigne les résultats du raccordement natif et de la mesure du coût global.
