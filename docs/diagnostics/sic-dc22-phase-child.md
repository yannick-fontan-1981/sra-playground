# DC22 — Enfant natif de mesure du cycle

## Attendus figés avant raccord

Base `b0574d0d45d3253c38fd6a72e52074874b6a0da6`. Témoin discriminant `9e96585ac3d6c7bcc450e173592211238cdc0ee0`. L’option est exercée exclusivement sur DC22 par le harnais expérimental.

| Point | Attendu |
| --- | --- |
| N4/T1, après 111 gestes inchangés | Même `ACTION6 (46,28)`. Le premier changement est l’ouverture à l’autorisation d’un enfant de mesure du contrôle, rattaché au besoin de traversée. |
| N4 avant T14 | Chaque cycle ouvert continue à recevoir ses mesures. Un retour intermédiaire ne satisfait pas cet enfant. |
| N4/T14 | Même `ACTION6 (56,28)`. Le retour à 126 clôt l’enfant du deuxième contrôle avec la paire 125→126. |
| N4/T15 | Même `ACTION2`. Le plan du parent cite la preuve déjà acquise pour chaque cycle, dont celle de T14. L’autorité vérifie cette preuve avant le ticket. |
| Un seul cycle rouvert | Repli sur `ACTION6 (56,28)`, sans franchissement au T15. |
| Mauvais contrôle ou référence périmée | Contre-épreuves indépendantes sur l’entrée pré-T15. Le même `ACTION2` proposé doit être refusé avant délivrance du ticket. |
| Préfixe nominal | Même suite du départ L1 jusqu’à N4/T76, mêmes commandes et effets physiques, mêmes empreintes aux quatre fins de niveau. |

Le champ générique `prerequisite` du moteur atteste l’accès de frontière selon un autre contrat. Pour les cycles, la preuve est produite au scellement du retour de mesure, puis vérifiée et citée par le parent.
