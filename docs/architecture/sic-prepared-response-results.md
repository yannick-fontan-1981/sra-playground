# Réponse à une préparation et réemploi spatial, candidat v17

Le témoin figé est `7f2cb3eb29a4bd7640c3c38b71107af86b521ad5` et le candidat est `1a19b9c7fe189231fa8b1c174718c37f465901e1`. Le choix de préparer un repère puis d'exécuter une autre commande est issu des traces sources. La mesure en autonomie part d'une mémoire neuve par niveau. Un rejeu indépendant vérifie chaque transition sur le moteur. Pour un déblocage, il rejoue la commande finale depuis la même image avant préparation et vérifie que le voyageur y restait immobile.

| Cohorte | Témoin | Candidat v15 | Candidat v17 |
| --- | ---: | ---: | ---: |
| 100 jeux sources, niveau initial, budget de 60 commandes | 65/100 | 58/100 | 55/100 |
| 18 niveaux supérieurs de GRAV, GARE, POLA, CWSE, CATR, GIGO et MOTO, budget de 120 | 7/18 | 8/18 | 8/18 |
| SS01 L2, budget de 1 200 | Échec | Échec | Échec |

Sur les 100, la v17 gagne ESCT L1 et perd COLM, SNAR, VOIS et SKBN L1 par rapport à la v15. Ses 117 essais de préparation provoquent 24 mouvements qui échouaient sans préparation. Sur sept tentatives de réemploi depuis une autre origine, deux produisent le déplacement prévu et dépendent de la préparation. Sur les 18 niveaux supérieurs, 147 essais donnent trois mouvements débloqués et aucun réemploi exact.

Sur SS01 L2, le candidat lance 26 expériences. Une commande déplace le voyageur après préparation et le laisse immobile lorsqu'elle est rejouée seule. Aucun réemploi ni franchissement entre régions n'est établi. Le candidat finit après 878 commandes, le témoin après 1 101. Aux 878 premières commandes, le candidat voit 137 images distinctes et le témoin 168. SS01 avait déjà fait l'objet d'évaluations. SS09 L2 reste réservé à la confirmation.

Les expériences à partir de préfixes sources et les parties autonomes sont ventilées dans [les résultats vérifiés](sic-prepared-response-results.json). Les deux réussites officielles observées dans les branches expérimentales ESCT et KA59 ont leur propre témoin d'omission. Seul le tableau ci-dessus mesure les victoires en partie autonome. Le compilateur TypeScript passe et 157 tests sur 158 passent. Le test de recharge du cycle orienté échoue également avant ce chantier.

