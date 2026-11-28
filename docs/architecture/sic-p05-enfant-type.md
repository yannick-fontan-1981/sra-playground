# Enfant typé pour la mesure P05

## Contrat préenregistré

Le lot part de `09b9a509e5e07894b9fccf170f22ae26cbeffbda`. Premier raccord dans `sic_verify_remote_replay` en mode actif. Le besoin parent est celui du contact distant en cours. L’enfant reçoit l’identité du parent, le porteur reconnu, sa position, l’échelle d’un pas, l’observation courante, la commande disponible et un geste hérité. Le ticket et la paire d’observations restent ceux du service natif.

| Témoin | Attendu |
|---|---|
| G50T N1/T1 | L’essai ACTION1 s’ouvre avec une unité et reste en attente avant le retour. Le porteur reste immobile. Le résultat laisse le contrôle inconnu et le parent ne reçoit aucun vecteur. |
| G50T N1/T5 → T6 | Le ticket P05 ACTION4 ouvre un enfant pour le porteur courant. À la clôture du vrai retour, la même pièce s’est déplacée de [6,0]. Le parent enregistre le vecteur sous ACTION4 avec la référence du retour. T6 conserve la marche P07 avec la même commande et le point attendu (26,8). |
| Contre-épreuves | Une preuve de commande, de sujet ou d’observation étrangère ou périmée reste inutilisable. Zéro geste local laisse la décision au repli déjà qualifié. Une référence d’un autre épisode ne rouvre pas un enfant. |

L’observation et les références viennent du service. La famille reste responsable de la réidentification du sujet, de l’unité du pas et de la lecture de la mesure. Le premier raccord ne change pas l’admission ni le plan P07. L’Agenda prépare séparément le parent de pression DC22 N4 dans les fichiers de phases et de route. Une preuve déjà acquise dans `prerequisite` ne crée pas un enfant en attente.
