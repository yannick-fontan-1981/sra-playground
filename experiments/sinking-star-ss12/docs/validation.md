# SS12 — validation de la version 0.1.0

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript stricte et HTML autonome | Réussie. |
| Tests du moteur | **25/25**. |
| Campagne complète, via les huit témoins d’auteur | **8/8**, état final **WIN**. |
| Entrées rejouées | **526**, dont 38 sélections. |
| Actions refusées / morts dans les témoins | **0 / 0**. |
| Images d’animation contrôlées | **1 548**. |
| Découvertes du tutoriel | **13/13**, détectées dans les pixels publics. |
| Annulation du dernier coup de chaque salle | Vérifiée, y compris le changement de niveau. |
| Source des cartes, crédits et témoins | Huit correspondances exactes avec les références d’auteur. |
| Contrôles du HTML compilé | Réussis dans Happy DOM, pixels du canvas et temporisation contrôlée. |
| Rendu dans un véritable navigateur | **Bloqué par l’environnement**, non validé. |

Les résultats détaillés sont dans `validation/levels-report.json` et `validation/ui-dom-report.json`. Le statut navigateur est dans `validation/browser-availability.json`.

## Moteur et règles vérifiées

Poussée de files mixtes, chant simultané, portée diagonale et à travers les murs, membres retenus, Guerrier entraîné sans poussée secondaire, Barde forcé sans chant, création et déplacement d’appuis, ancrage des supports occupés, reflets prioritaires et échanges à égale distance, presses et stabilisation hydraulique, combat simultané, sélection sans tour et actions invalides atomiques.

Trois tests de régression supplémentaires accompagnent le contrôle des appuis hydrauliques. Une arrivée volontaire sur plateforme inactive ne doit pas noyer le Guerrier ; le chant ne doit pas retirer un appui indispensable à un miroir ; quitter un bouton peut toujours retirer ensuite une plateforme active sous le partenaire.

## Interface exécutée

Le vrai fichier HTML construit est évalué dans Happy DOM. Les entrées passent par les événements du clavier, les boutons et les clics du canvas. Les pixels et les durées présentés sont comparés au moteur pour les cas contrôlés.

Les vérifications couvrent douze situations du duo, trois cas de reflets, le miroir sur un bouton, quatre cas de blocage/annulation d’un reflet, le verrouillage des commandes pendant l’animation, l’interruption par Annuler/Recommencer/Repartir/sélecteur, la réduction des animations, les panneaux terminaux, les huit sélections de salles et le parcours complet du tutoriel. Les deux références de la dernière salle sont accessibles.

Cela vérifie les comportements DOM et les images calculées. Cela ne certifie pas la mise en page CSS, les périphériques tactiles ou la présentation dans chaque navigateur.

## Limite de l’environnement navigateur

Le lancement local de Chromium a échoué sur une création de socket interdite. Le navigateur géré a ensuite refusé l’URL locale selon sa politique de protocoles. Aucun contournement n’a été essayé. La vérification visuelle des grilles publiques a été possible par rendu des matrices de pixels, mais pas celle de la page complète.

`scripts/verify-ui-browser.mjs` prépare le contrôle Chromium pour un environnement autorisant le navigateur. Il n’est pas compté comme réussi dans cette livraison.

## Reproduire

```sh
npm install
npm test
npm run validate
```

Pour les contrôles complémentaires, rendre disponibles `happy-dom` et `playwright` dans l’environnement. Les versions utilisées ou préparées ici sont Happy DOM 21.0.4 et Playwright 1.62.1.

```sh
node scripts/verify-ui-dom.mjs
node scripts/verify-ui-browser.mjs
```

Les variables optionnelles `HAPPY_DOM_MODULE` et `PLAYWRIGHT_MODULE` peuvent désigner les modules installés dans l’environnement. `CHROMIUM_PATH` sélectionne un Chromium existant. Les captures intermédiaires du second script sont optionnelles via `SS12_BROWSER_CAPTURE_DIR`.

Le build ne lance aucun solveur. Une modification de carte se régénère depuis son script d’auteur, puis se synchronise avec `node scripts/sync-levels.mjs` avant reconstruction.

## Ce que les résultats établissent

Les huit salles sont solubles avec les règles livrées. Les témoins gagnent sans refus ni mort et sont absents du bundle jouable. Leur longueur n’est pas une mesure d’optimalité ; leur réussite n’est pas une réussite de l’agent SRA. Aucune unicité des solutions ou nécessité globale de chaque mécanisme n’est affirmée.

Aucun chemin du runtime SRA ou du catalogue natif n’est modifié dans cette étape. Il n’y a donc pas de comparaison de performance globale du Playground dans ce rapport. Elle devra être faite si l’intégration modifie des chemins partagés.
