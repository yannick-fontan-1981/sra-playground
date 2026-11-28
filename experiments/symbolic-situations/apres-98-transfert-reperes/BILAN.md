# Transfert par repère public · troisième réserve et contrôle du correctif

Réserve préalable `a5d81510cdb2476c1fee1d1e44fd6b01f0c56ac3ab22063975f59c5d1536579c`, neuf départs et sept paires. Première mesure sur le candidat `a53eb1d5d401d0d4c3e11a080bf77bfb4e635856`. Le passage sur `86e0f172bfd4f743bccd985a57ce1811001a6d7e` est un rejeu de la réserve révélée pour éprouver le correctif.

Les neuf départs à froid sont identiques entre révisions. Le figé obtient 2 victoires en 75 gestes et la composition 9 en 56 gestes. Les deux sources distinguent leur code sur un vrai retour d’ouverture, respectivement aux T2 et T3. Chaque cible gagne dans les trois colonnes du tableau.

| Transfert | Gestes à froid | Avec rappel, candidat initial | Avec rappel, correctif |
| --- | ---: | ---: | ---: |
| Renommage, repère unique | 7 | 5 | 5 |
| Repère unique trompeur | 7 | 7 | 7 |
| Repère dupliqué en cible | 7 | 7 | 7 |
| Repère absent en cible | 7 | 7 | 7 |
| Code et repère contradictoires, ordre initial | 5 | 6 | 5 |
| Même contradiction, ordre inversé | 6 | 6 | 6 |
| Renommage avec ordre changé | 6 | 4 | 4 |
| **Total** | **45** | **42** | **41** |

- **Renommages.** Les deux premiers essais changent au T1 avec rappel. Le vrai retour est `armed:true`, position 0, porte fermée. Le nouveau départ acquiert le lien après ce retour. Chaque scénario économise deux gestes sur les deux SHA.
- **Faux repère unique.** Le premier essai rappelé reçoit au T1 `{position:0, open:false, target:null, outcome:null, armed:false}`. Le retour élimine ce code des hypothèses. Le vrai code arme au T3 et devient le seul code acquis pour la destination. Le premier geste diffère du bras à froid, avec sept gestes et victoire dans les deux.
- **Contradiction à alphabet égal.** Initialement le repère unique reçoit une priorité alors qu’il désigne un autre code que celui acquis dans ce même alphabet. Dans un ordre, le T1 change, `armed:false` est rendu et la victoire coûte un geste de plus. Dans l’ordre inverse, le rappel discordant existe encore et la suite est identique au bras à froid. Sur le correctif, le rappel est absent dans les deux ordres et les reçus concordent intégralement avec le bras à froid.
- **Absence et duplications.** L’absence et la duplication du repère à destination laissent les parcours à froid intacts. Dans une contre-épreuve séparée sur le développement, la source dont le repère est dupliqué apprend le code au vrai retour d’ouverture du T5 et n’exporte aucun repère. Le parcours de destination est identique au bras à froid sur les deux SHA.

**Contrôle indépendant.** Sur chaque SHA, 6 970 transitions légales du terrain sont vérifiées, dont 458 terminales, et les 25 exécutions du reçu sont reproduites en processus de politique restreints. Deux sondes de lecture privée sont bloquées par exécution de l’audit. Les acquisitions sont aussi revérifiées par énumération des mondes compatibles avec les observations. Les 17 tests de développement, incluant le rejeu par tickets V6, passent sur chaque SHA. Les traces complètes et les cas restent chez l’opérateur.

SHA-256 des reçus complets. Initial `f976835743e7562b8f1d555edcc216426595c13d2cd0faf1ab4614ce48014475`. Correctif `eece118676c0a137cf76242fecfc03a7a27b8348556aff51b4695f77acf5a92e`.
