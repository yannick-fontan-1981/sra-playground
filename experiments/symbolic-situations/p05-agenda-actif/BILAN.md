# Agenda P05 actif · contrôle indépendant de l’autorité du retour

Candidat `09b9a509e5e07894b9fccf170f22ae26cbeffbda`, contrat opérateur `fb03bda1`. Six départs natifs, **96 gestes**. G50T en SIC et AS66 en V6 depuis N1, avec budgets transmis de 16 gestes par session et 600 par niveau. Pour AS66, la cible de session couvre plusieurs niveaux afin de suivre les 16 gestes. Pour chacun des deux jeux, le trajet ainsi que les reçus sans option et avec budget local 1 concordent intégralement.

## G50T · première différence au T1

| Champ | Budget local 1 | Budget local 0 |
| --- | --- | --- |
| Comparaison d’offre | `selected:true`, coût admis | `selected:false`, premier écart `selected` |
| Propriétaire du ticket | `sic_verify_remote_replay` | `sic_public_input_exploration` |
| Besoin de la décision | `use_repeated_remote_effect_to_gain_access` | `learn_public_command_effect` |
| Garde admis | `current_replay_and_carrier_bound` | `current_public_input_bound` |
| Motif du reçu natif | `compare_replayed_motion_and_remote_return` | `observed_public_input_return` |

Même observation de départ, preuve d’offre inchangée, même ACTION1 sans paramètre et même paquet après exécution réelle. Le reçu de chaque bras cite le plan en vol, le propriétaire du ticket joué et la même référence publique de retour. Les deux cas donnent `matched:null`. Les identifiants du ticket et du plan sont également identiques entre les deux sessions contrôlées. Le garde, le besoin et le motif du reçu distinguent leur autorité. Dans un septième départ limité à ce premier geste, le service refuse le retour soumis sous un identifiant étranger avec `stale`. Le vrai ticket reçoit ensuite le même paquet sous l’autorité d’exploration.

Sur G50T, les 16 tickets et paquets concordent à budget zéro et un. Le T2 conserve la différence de besoin. Au T6, les deux bras gardent ACTION4 sous P07 et confirment le déplacement avec `matched:true`. Le fournisseur qui la libère diffère. Aucun niveau n’est terminé dans la fenêtre de 16 gestes.

## AS66 · contrôle de continuation

À budget local zéro, le premier écart apparaît au T6, à observation de départ identique. Au budget 1, `sliding_cavity` libère ACTION1 et son reçu demande une réponse mesurée avant de lier le trajet. Au budget 0, `observed_frontier` libère ACTION2 et reçoit un paquet distinct. Deux niveaux sont terminés dans les 16 gestes au budget 1, un seul au budget 0. La réduction locale change donc réellement la trajectoire dans ce contexte.

Les six tests du lot P05 passent. Le [reçu réduit](recu.json) contient les références et le premier écart de chaque comparaison.

## Rejeu

Depuis le checkout au SHA indiqué, copier [parcours.mjs](parcours.mjs) à la racine sous `operateur-p05.mjs`. La racine de jeu désigne le Banc local avec Pyodide. Utiliser un fichier de sortie neuf.

```powershell
node operateur-p05.mjs <racine-jeu> <reçu-brut>
node <dossier-opérateur>/verifier.mjs <reçu-brut>
```
