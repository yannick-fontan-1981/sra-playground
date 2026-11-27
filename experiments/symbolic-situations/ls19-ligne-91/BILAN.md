# LS19 · verdict indépendant de la ligne 91

**Le candidat `14db9cd82a345752030531e9db37fb7c0ea6df45` passe les quatre départs publics et les deux départs réservés.** Le service natif satisfait les 66 contrôles préenregistrés, 42 en développement et 24 en réserve. L'audit a rejeté 12 reçus altérés et vérifié, dans les trois paires, que les observations et décisions antérieures au retour discriminant étaient identiques.

| Situation | Premier choix ou retour discriminant | Verdict |
| --- | --- | ---: |
| D1 · preuve encore actuelle | Au tour 13, si le mobile est resté immobile et le support en place, `ACTION2` est admise comme confirmation. Si seul le support s'efface, l'arrêt antérieur demeure dans le reçu du tour 12 mais le service choisit `ACTION3` et la question est absente du retour suivant. | 2/2 |
| D2 · clôture de la confirmation | Après la répétition du tour 13, deux images identiques à des révisions différentes portent le compteur de 1 à 2 sur la même clé. Le ticket 14 est `ACTION3`. Si le mobile franchit l'entrée, la clé est effacée et le ticket 14 est `ACTION2`, choisi hors de la branche de confirmation. Les deux retours donnent zéro pixel supplémentaire. | 2/2 |
| Réserve · variation d'un seul porteur | Les pixels d'un seul des deux porteurs sont déplacés, à silhouette conservée. L'autre porteur et le support restent fixes. Le compteur ne passe pas à deux sur la clé précédente, la question de blocage est levée. Dans le départ stationnaire apparié, elle passe à deux. Aucun troisième essai de confirmation pendant la fenêtre observée. | 2/2 |

**Besoin et sous-objectifs.** Dans D2, le besoin `observe_view_access` garde la même identité sous `G_official_completion`. Le retour du geste 12 est rattaché au sous-objectif d'approche `C_view_66583eb0e56acd3d`. Le retour du geste 13 est rattaché au sous-objectif de confirmation `C_view_8392843d645dc9fd`. La révision qui clôt l'approche est celle qui ouvre l'essai de confirmation. Les sources et les destinations des deux reçus sont vérifiées. Le garde du ticket de confirmation admet un passage antérieurement attesté et une seule immobilité. La cause exclusive de l'arrêt reste indéterminée.

**Contrôle anti-répétition.** Dans chaque paire, l'audit a injecté une troisième confirmation, une attribution au plan précédent, puis une ancienne révision de départ. Il a aussi réinjecté le ticket historique dans D1 après disparition du support, ou le compteur du monde stationnaire après mouvement d'un ou plusieurs porteurs. Ces quatre falsifications par paire ont toutes été détectées. La portée temporelle après la confirmation couvre le ticket suivant dans D1 et deux observations fixes supplémentaires dans D2 et dans la réserve.

Les quatre départs de développement ont aussi été exécutés sur le contrat antérieur `68efddd2d009ace4f4b898cc82c4bb7941e815ae`. Les observables recueillis sont identiques sur les deux SHA. Le générateur et les critères étaient figés à `7072b2f06d7c3392e5f3cccdc74fb3721a0aff72`, et l'engagement de réserve publié à `be95d935aa73da4a01183a0bf0c6fae45afd6edd` avant l'exécution du candidat. SHA-256 des reçus : développement `6da37d37cbd3a20850cdeed991b3f2ac5f2730254cfd1c91f3f3610b1657c816`, réserve `f5684313e79d8ca8f3a12264feb8b36ebf7298a2d922b3d3de11e65c5f7876f9`.

Ce verdict concerne la confirmation d'obstruction de la ligne 91, sur trois situations construites utilisant le service natif. La ligne 90 a son bilan propre. Le Banc et la décision d'intégration au décompte des 98 restent des étapes distinctes.

```powershell
node qualifier.mjs --sha 14db9cd82a345752030531e9db37fb7c0ea6df45 --depot . --rapport dev-91.json
node auditer.mjs dev-91.json
```

[Contrat et cas publics](CONTRAT.md) · [Engagement de réserve](GEL.md) · [Audit des contre-épreuves](auditer.mjs)
