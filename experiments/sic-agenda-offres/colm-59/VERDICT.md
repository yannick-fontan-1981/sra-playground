# Verdict COLM · ligne 59

Le catalogue `8ce7ee35` et le gel `d0e7527c` produisent le même préfixe de 16 gestes. Le ticket N1/T1 est `public_occurrence_recall / queued_field_composition / queued_field_experiment / OP18`, ACTION1. La composition, l'acquisition et la reprise sont exercées dans le service natif du gel. Le harnais expérimental ajoute les témoins et le reçu.

| Avant la décision | Retour ou variation | Décision et preuve |
|---|---|---|
| N1/T1, champ posé fixe, colonne active 3, ordre [8,11,8] | Un retour public, [8,8,11], même colonne, mêmes membres et même champ posé | L'essai de contrôle retient deux permutations [0,2,1] et [2,0,1]. Il répète ACTION1 en T2. [11,8,8] départage en faveur de [2,0,1]. |
| Même N1/T1 | Retour stationnaire construit ou copie de la vue canonique dans une deuxième trame | Aucune loi acquise dans les deux cas. Le retour stationnaire fait essayer ACTION2. Les deux trames laissent ACTION1 comme essai inconnu, sans permutation citée. |
| N1/T3, ACTION2 | Neuf trames publiques. Le placement intermédiaire mesuré apparaît à l'ordinal 1, avec un déplacement de 1. Une nouvelle enveloppe [14,8,14] apparaît ensuite | Le reçu permet d'acquérir la réception et conserve deux clôtures compatibles. Sans cette seule trame, la vue finale et l'empreinte du vrai paquet concordent, mais la réception reste inconnue. Le service répète ACTION2. |
| N1/T4–T6 | Deux translations publiques à une trame, 3→2 et 2→3, avec les mêmes membres ordonnés et le champ détaché fixe | T6 engage [ACTION3, ACTION2]. La translation correspond en T6, puis le plan se poursuit vers la réception T7. |
| Même N1/T6 et même commande réelle | Retour présenté sans translation | La prémisse `queuedTranslationPremise` est réfutée pour ce champ et ce départ. Le préfixe est fermé. La loi de déplacement déjà acquise demeure, et le service propose ACTION2 depuis la colonne 3. |
| N2/T16 après réussite officielle de N1 | Nouvelle grille mesurée. Les ordinals 1 et 2 montrent la même réception de déplacement 1 | Le premier ordinal étaye la réception dans le nouvel epoch. Les obligations de géométrie et de commande sont revalidées. |

`QueuedFieldMemory.record` prépare les références avant et après. `recordPacket` relie les trames, et `acquireQueuedField` admet le contrôle de préparation à une trame avec le même epoch et champ posé, calculé hors enveloppe active. Le contrôle à deux trames vérifie cette garde conservatrice. Il laisse l'origine du changement indéterminée. Le reçu de réception conserve l'incertitude sur le rôle de la file dans la clôture.

La vérification commune porte sur le rattachement au même contexte et au retour réel. Ici la preuve de préparation exige en plus l'immobilité du champ posé, la conservation des membres actifs et une permutation compatible avec les contrastes successifs.

Six préfixes natifs et 74 tests passent. Durée du préenregistrement au reçu 7 min 45 s. Harnais `b8902646b6c968f78e5512f62d1d641b0bd20dd0`. Reçu local `artifacts/qualification-colm-59/b8902646.json`, SHA-256 `d1c7b8c029fa68033a065d9d3f88358811bd0bf0ab7b183e64222fadb7fc7e5c`. Le lot contient uniquement le harnais et ses documents. [Commande de rejeu](README.md).
