# SEQN · qualification indépendante des lignes 11 et 81

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, révision annoncée `b5dda8ecb17b1725816bae09b44973449869dbae`. Réglages de l’[attendu public](https://github.com/yannick-fontan-1981/sra-playground/blob/57601dca/docs/architecture/sic-seqn-lignes-11-81.md). Départ au N1, six niveaux, 600 gestes par niveau, sans curiosité ciblée. Mesurer le catalogue de 16 gestes et l’extension à 19 gestes sur des services neufs.

| Ligne | Témoin et preuve | Intervention à état égal |
|---|---|---|
| 11 · séparer deux changements | N1/T8, `factored_material_return / public_factored_return`, ACTION1. Relever le point de départ retrouvé, les supports des deux projections, les faits antérieurs qui les justifient et l’attribution du retour T8. Montrer quelles prédictions sont confirmées par chaque canal. | Retirer un témoin de la partition sur la même observation. Jouer le ticket de repli et mesurer ses preuves. Une commande qui coïncide ne vaut pas acquisition sous la famille 11. |
| 81 · revalider la transformation qui a permis le score | N2/T12, `scored_local_rewrite / public_scored_rewrite`, ACTION1. Rattacher le modèle à son épisode de progression à T11 et à la géométrie actuelle. Distinguer les supports relocalisés et le retour réel de la première revalidation. | Présenter un retour T11 du même ticket qui conserve la progression officielle mais retire l’échantillon local attendu s’il est séparable du paquet. Retirer séparément l’attestation du modèle dans la mémoire consultée à T12. Comparer les offres et jouer le repli à preuve manquante lorsqu’il reste compatible avec le vrai jeu. |

Vérifier la contribution exacte de 11 à la preuve consultée par 81. Un événement commun ne suffit pas. Exiger une référence à un même acquis ou un changement observable lorsque cet acquis est retiré. Un reçu qui prête à 81 l’effet obtenu sous une autre famille doit être rejeté même si la commande est identique.

## Réserve opérateur

Empreinte du fichier de sélection `cd2582e7a59d20c0acb30056c7414724c9a6977f9dd0bdd6666fe0c9b1406427`.

- Sur le vrai retour T8, garder les changements du canal mobile ou matériel selon le bit de poids faible de l’octet 0, avec 0 pour le mouvement. Pour l’autre canal, reprendre dans toutes les images les pixels d’avant le geste dans son support prédit. En cas de recouvrement, ne remplacer que les pixels exclusifs au canal écarté. Mesurer les pixels retirés et signaler si le contraste est vide. Vérifier indépendamment les deux projections et le ticket suivant.
- Au vrai T12, reprendre le plateau d’avant le geste pour les pixels de la réécriture attendue et garder les pixels hors de ce support. Conserver le nombre d’images et le niveau livré par le jeu. Vérifier le scellement, le statut de la revalidation et la disponibilité du même modèle au ticket suivant. Si plusieurs réécritures disjointes sont exposées, garder une seule réécriture occultée et choisir son indice par l’octet 1 modulo leur nombre.

Compter séparément les preuves de décision de 11 et de 81. Le verdict se fonde sur le ticket, l’acquisition et la reprise.
