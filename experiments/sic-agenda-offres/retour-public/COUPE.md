# Retour d’un geste matériel au gel f296ac1c

La branche `experiment/sic-agenda-retour-public` part de `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. Le défaut étudié survient après la première commande. Le message initial et la sélection de cette commande ont donc déjà franchi l’admission et la recherche.

| Instant | Valeur disponible | Producteur et usage |
| --- | --- | --- |
| Demande du geste | Commande publique complète, verbe et transitions prédites par les règles | `PublicSession.next` émet la commande et garde dans `#pending` sa projection et son verbe. |
| Arrivée du retour | Une chaîne de texte dans `retour` | Le transport v1 garantit un échange séquentiel. Il nomme le refus `Action indisponible.` et transmet la valeur publique des lectures. |
| Qualification | Refus, terminaison, lecture ou accusé matériel | Un retour vide ou refusé arrête la session. Les deux textes terminaux la ferment. Pour un geste sans lecture, la table `acknowledgements` associe cinq verbes et leurs cinq accusés, acquis sur les deux familles de développement. Une lecture est rapprochée d’une unique valeur projetée. |
| Mise à jour | Un seul successeur accepté et une référence `retour:n` | La mémoire prend ce successeur après reconnaissance. Un texte matériel hors de la table arrête la session avant cette affectation. |

La projection de `set`, `keep` et `reveal` décrit le résultat attendu sous les conditions de la fiche. Elle ne constitue pas l’accusé d’exécution du geste. Le schéma de la fiche v1 ne déclare pas l’orthographe des retours matériels. Le dialogue v1 ne transporte pas séparément le statut d’exécution, la commande confirmée ou la référence d’un fait. Une relation publique entre texte et effet, ou une attestation structurée du producteur, permettrait d’expliquer la mise à jour. La reproduction de développement et son témoin négatif détermineront quelle information manque effectivement.

[Interpréteur et attente du retour](../public-v1/solveur.mjs) · [Construction des successeurs](../public-v1/planifier.mjs)
