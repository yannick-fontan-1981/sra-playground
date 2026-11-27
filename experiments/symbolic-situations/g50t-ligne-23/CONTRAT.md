# G50T · ligne 23 · essai d'une commande inédite ici

Gel des 107 jeux `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le [dossier de départ](https://github.com/yannick-fontan-1981/sra-playground/tree/02032a3d50ba15d7d0d7ff1c74d01165ad7e31f2/experiments/sic-agenda-offres/frontiere-22-23) et les [critères de SIC 4](https://github.com/yannick-fontan-1981/sra-playground/blob/d5e642677e792e921e459189882d94f592a2eee5/experiments/sic-agenda-offres/essai-local-23/CRITERES.md) précèdent le candidat.

## Préenregistrement des observations et des verdicts

| Entrée | Critère opérateur |
| --- | --- |
| G50T, niveau 1, première action. Lancer le jeu et le service avec le pack actif de la campagne. | Une décision de famille `observed_frontier`, stratégie `test_local_input`, plan `experiment` libère `ACTION1` à l'index 0. Le ticket lié à l'occurrence vise `Q_36ce889058ea8eda599b`. Seul le retour de ce ticket satisfait la question, avec `unknown_effect_observed` et `matched=null`. Le pré-choix, la garde, le ticket et le retour sont comparés à ceux du gel. |
| D1–D2. Même plateau, même domaine de deux commandes neuves U < V, présentation directe ou inversée. | En l'absence d'historique, le départage canonique choisit U dans les deux cas. La question et le contexte sont identiques. |
| D3–D4. Même occurrence et même domaine. Un seul essai stationnaire antérieur effectué ici, U ou V. | Seule l'autre question est ouverte. L'essai fermé est étayé par la transition de la bonne commande, au bon index. |
| D5–D6. Les deux commandes sont inédites ici. Le seul essai antérieur, U ou V, a eu lieu sur l'autre plateau dans la même époque. | Avec `least_tried`, changer cette seule preuve choisit l'autre commande, bien que les deux questions locales restent ouvertes. |
| D7. À froid, retour de U sur le même plateau, puis retour de V sur un autre plateau dont le domaine reste identique. | La question sur U disparaît ici à réception de son retour. V est le seul essai restant. Dans le nouveau contexte, U redevient admissible et est choisie. Son identifiant doit changer et la question initiale rester fermée à son index. Une nouvelle occurrence du même plateau conserve l’index. |
| D8. A est épuisé, l’essai U a déjà conduit de A à B et V reste ouverte sur B. | Témoin distinct de 22. Le fournisseur propose `reach_open_input / access` par U vers la question V de B. La première étape est conditionnelle à une projection déjà observée. L’arête doit citer la transition A → B. |
| D9. A est épuisé, B possède toujours V, mais seule la direction B → A a été observée. | Aucune commande libérée par le fournisseur. Le besoin d'accès reste ouvert. Une question ouverte ailleurs ne suffit pas à déduire un trajet. |

D1–D9 passent par le fournisseur natif, chaque départ en mémoire neuve. Les seules entrées sont le domaine public, le plateau courant et les transitions déjà observées. D7 rend chaque retour après la proposition et la garde. Une décision de fournisseur est comptée comme telle. Le témoin de service à deux plateaux du dossier de départ contrôle séparément les tickets d'accès et de continuation. REGN N3, geste 16, sert de négatif d'attribution historique : même commande et même type de retour avec une autre famille doivent être refusés comme preuve de la ligne 22 ou 23. Une garde sur occurrence altérée et un reçu dont la famille ou la question a été remplacée doivent échouer.

## Réserve

Les neuf mêmes interventions sont exercées sur deux projections et une paire de commandes déterminées par une graine opérateur distincte. Les octets de la sélection ont pour SHA-256 `df4ac1793fcdc006331e1082809aa76ed01f0b0551f96f1bb2080bfdbb624ac1`. La sélection produite diffère du développement pour les commandes et les plateaux. Le gel fixe les cas et les critères avant lecture et mesure du candidat. La réserve mesure le transfert de cette structure à de nouvelles instances.

## Attribution

Comparer sur les mêmes entrées le gel et le candidat explicitement scellé, y compris les refus. Pour distinguer changement de type et changement de comportement, comparer l'arbre `src` et le JavaScript effectivement émis pour tous les modules différents avec les mêmes options TypeScript. Dénombrer séparément les décisions locales, l'accès, les absences de trajet, les points historiques et les contrôles altérés. Le décompte du chantier et l'intégration restent du ressort du Banc.
