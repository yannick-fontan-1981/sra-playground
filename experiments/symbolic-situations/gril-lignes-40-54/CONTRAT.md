# GRIL · présélection opérateur des lignes 40 et 54

Comparer le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le candidat annoncé `915e0601e3aad82653733ac602909bef2286343d`. Ce protocole est scellé avant lecture du candidat, à partir des [critères de l’auteur](https://github.com/yannick-fontan-1981/sra-playground/blob/cb05fadc/docs/architecture/sic-gril-lignes-40-54.md) et de l’inventaire. Chaque départ utilise le vrai jeu et un service neuf au N1, sans curiosité ciblée, six niveaux cibles, budget global de 16 et 600 gestes par niveau.

| Ligne | Parcours authentique | Intervention à état comparable |
|---|---|---|
| 54 · interroger une occurrence | N1/T2, ACTION6(11,53), sous-question `occluded_catalogue_composition`, plan `occluded_catalogue_experiment`. Relever les hypothèses examinées, celle effectivement soumise, la preuve datée et la décision suivante. Rejouer le deuxième contexte en N3 et relever son propre reçu. | Retirer seulement le reçu du clic T2 à paquet physique égal. Vérifier ce que devient la soumission suivante et quelle partie du besoin est conservée. Si une autre hypothèse déjà admissible peut être choisie grâce à une intervention locale, jouer son propre ticket et vérifier le reçu. |
| 40 · changer de vue | N1/T4, ACTION3 sous `catalogue_view_experiment`. Montrer la preuve d’accès du T1 consommée au T4 et dater le vrai changement de vue. En N3, vérifier la référence d’accès propre à ce niveau. | Retirer la seule preuve d’accès au même état. Relever le ticket résultant, puis son vrai retour. Si une commande identique est reprise sous un autre besoin, comparer type, acquis et références plutôt que la seule commande. |

La comparaison s’arrête à la portée locale de chaque décision. Un reçu édité qui conserve les pixels et le ticket mais remplace la référence de la preuve par celle d’une autre décision doit être refusé par le vérificateur. Dans la mesure du possible, éprouver aussi le refus natif d’une référence venant d’une époque antérieure sur la vue de N3.

## Réserve opérateur

Empreinte du fichier privé `4c5bc47cdc54f21e57e930ea6ebb0553fa7f22e2c491bb0b9ad64869408d9ccd`.

Pour la ligne 54, exécuter le vrai T2 et calculer les pixels modifiés entre les deux images terminales. En séparant selon la médiane des coordonnées, conserver seulement une moitié des changements sur chaque image servie et reprendre les pixels précédents dans l’autre moitié. L’axe et le côté sont fixés par les deux bits de poids faible du premier octet de la sélection. Si l’une des moitiés est vide, traiter le cas comme un contrôle de conservation ou de stationnarité, selon le résultat, et publier les deux effectifs. Comparer la soumission acquise et la décision suivante.

Pour la ligne 40, servir le plateau d’avant T4 dans toutes les images du vrai retour T4. Conserver la commande, le nombre d’images et le statut officiel. Vérifier la distinction entre un essai d’accès enregistré et un changement de vue effectivement visible. Relever le premier ticket de reprise et l’identité du propriétaire.

Compter par ligne les tickets et les preuves acquises dans le parcours nominal, puis les interventions. Consigner le temps jusqu’au verdict et toute reprise du harnais.
