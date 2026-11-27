# ONDE · témoin historique avant qualification du candidat

Le service issu de `d0e7527c` a libéré 16 tickets depuis ONDE L1 avec la curiosité d’ouverture active et l’agenda du Playground. Les 16 commandes ont reçu leur retour dans le jeu natif. Les trois décisions du [protocole](CONTRAT.md) sont accessibles sur ce parcours.

| Ligne | Ticket libéré | Retour et choix suivant |
|---|---|---|
| 28 · N1/T1 | Famille `periodic_sums`, mesure initiale, ACTION3, aucune prédiction. | Les deux bandes ont des décalages uniques 1 et 0 sous la convention du protocole. Le reçu de sonde `unknown_channel_response` rattache la réponse à T1. T2 propose une cible jointe. |
| 29 · N1/T2 | Même ACTION3, pour `joint_phase_target`, cette fois avec une prédiction. Les mesures admettent 11 préimages. | Le vrai jeu passe au niveau suivant. Le reçu porte `official_boundary` et `matched:null`. Le choix suivant concerne la cible jointe du nouveau niveau. |
| 27 · N3/T7 | Question collective sans prédiction, ACTION6 en (48,3). Trois préimages satisfont les sommes. | Le retour des deux profils admet respectivement les décalages uniques 1 et 3. La famille revient à `joint_phase_target` au T8. |

Le contrôle construit a énuméré les 12 paires de phases des deux profils de périodes 3 et 4. Pour la cible [0,3], deux paires conviennent, dont une accessible en un geste. La cible [2,2] a une seule paire, accessible en trois gestes avec deux premiers choix minimaux. Retirer l’incrément du premier profil rend cette cible inaccessible. Le vérificateur rejette trois attributions fausses : mauvais ticket, mauvais récepteur et affirmation d’un décalage unique lorsque 1 et 3 restent possibles.

Les deux fiches réservées ont été matérialisées à partir de la sélection scellée et des couleurs du vrai N3/T7. Empreinte du fichier de fiches : `159c6f8b62a28915da0e8e6793a0f08c01162c601b9bf1abe3fd8b0c8fe26139`. Leur comparaison au candidat reste à exécuter.

Dans ce dossier avec Node 24, donner le chemin absolu de Pyodide et un fichier de sortie neuf :

```powershell
node historique.mjs $pyodide "$reçus/gel.json"
node --input-type=module -e "import {control} from './enumerer.mjs'; console.log(control())"
```
