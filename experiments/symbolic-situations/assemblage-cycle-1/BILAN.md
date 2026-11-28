# Premier cycle après les 98 · vérification de l’assemblage

Moteur commun vérifié `703cd1c32704171bae8e12a33a446bd6486fc288`, arbre `src` `fe6e22425293b31bf01cc447edc9d06a0ddab3b3`. Les harnais des reçus opérateur précédents ont été repris avec la seule sélection des départs réduite. Les six enregistrements de départ concordent intégralement avec leurs références.

| Contrôle | Départs et gestes | Résultat au SHA commun |
| --- | ---:| --- |
| G50T N1, enfant typé | 2 départs, 12 gestes | Le vrai paquet T5 est identique dans les deux bras. La provenance exacte produit `[6,0]` et le parent cite ce retour au T6. ACTION4/P07 vers `(26,8)` est jouée et confirmée. La substitution par la référence du vrai T3 fait disparaître l’acquisition. ACTION3/P05 est réellement jouée au T6 et son paquet diffère. |
| Contact après P07, terrain construit et miroir | 4 départs, 50 gestes | Les deux approches P07 et leurs retours concordent à budget 1 et 0 dans chaque géométrie. Budget 1 libère ACTION4 ou ACTION3 et reçoit `passage_connections_rewritten_at_landing` avec `matched:true`. Budget 0 diverge sur `selected` à preuve égale. Aucun ticket de contact ni reconfiguration. |

Les comparaisons utilisent les champs complets des enregistrements extraits par les deux harnais, y compris les autorisations, les acquisitions, les empreintes des paquets et les références. Le helper de la fixture de passage est identique au témoin d’origine. [Référence enfant typé](../p05-enfant-type/BILAN.md) · [Référence contact](../p05-contact-passage/BILAN.md)

Les expériences sur simulateur conservent leurs SHA propres. La campagne des 107 utilise le run déjà engagé `46117920929`. [Run des 107](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46117920929)

Les reçus privés de cet assemblage sont scellés par SHA-256. Enfant `9d76a2e90b9a288e8c9426cc5a239ea487a1585e5cf839a48e9e16d7bce58348`. Contact `e8d8da8c286e7e786123e414c4d069a2349a9866ea0d4351a17849faf6936399`.
