# Divergence attendue avant modification

Point de départ vérifié dans un checkout propre : `383c9e0581304f17e6321222cb0e02a41a0e2551`. Le consommateur caractérisé est `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. L’entrée de développement est `dial.json`, avec ou sans la variation publique archivée. [Variation](../caracterisation-public-v1/contre-exemple.json)

| Condition de départ | Décision du gel | Décision attendue du candidat | Verdict attendu |
| --- | --- | --- | --- |
| Cadran caché, deux sorties, même tampon exigé | Lire au tour 1, quatre gestes | Marquer une case au tour 1, marquer l’autre, valider. Les deux premiers marquages sont également courts. | Succès en trois gestes pour chacune des deux sorties. Le cadran demeure inconnu. |
| Cadran caché, tampons opposés | Lire au tour 1 | Lire, utiliser la valeur effectivement rendue, marquer deux fois puis valider. | Succès en quatre gestes dans chaque cas. |
| Domaine public avec une troisième sortie sans issue favorable décrite | Aucune garantie | S’abstenir de conclure la réussite et de proposer un plan garanti. | Aucun succès déduit des deux seules sorties décrites. |

La première divergence recherchée porte sur le **premier geste du cas à tampon commun**. Le minimum de trois gestes découle des deux cases vierges, du fait qu’une commande remplit une seule case et de la validation finale. L’essai mesurera les hypothèses examinées pour conclure la réussite. Les observations, les usages et les retours de lecture doivent rester distincts de ces hypothèses. L’inversion de l’ordre des commandes doit conserver la sélection et les finalistes. Le contrôle de non-régression portera sur les douze fiches de développement et leurs dix-huit départs.
