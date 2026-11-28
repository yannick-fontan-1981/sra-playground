# DICO · verdict de la ligne 86

Le test exerce huit préfixes natifs sur `8ce7ee35`, le gel `d0e7527c` et le candidat `d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc`. Le préenregistrement est à `78a85c23`. Les trois parcours nominaux donnent les mêmes offres, tickets, retours et empreintes. [Protocole et commande](README.md)

| Épreuve | Verdict |
|---|---|
| Parcours nominal | Le retour de T1 établit les quatre candidats. Au T2, deux commandes visent leur portée. Le clic (6,3) confirme le domaine et ajoute une forme de test. Au T3, le clic (16,3) rend une vue de six membres sur les quatre visés. Le service consomme cette nouvelle vue et atteint la requête au T4. |
| Offre alternative | Émettre (16,3) dès T2 autorise un autre ticket. La vue se resserre et la requête devient disponible au T3. Inverser l’ordre des offres conserve le clic nominal et les quatre tours. |
| Retour stationnaire | Le même ticket T2 garde les quatre candidats et perd l’effet de navigation attendu. La clé d’essai écarte (6,3) et la famille retrouve (16,3). Le contrôle d’un ancien ticket après changement de plateau refuse l’accès avec `subset_scope_changed`. |
| Retrait de l’offre | L’arbitre global émet la commande de frontière (10,23), puis la famille propose la navigation (6,3) au T3. |

Le gel consomme déjà le besoin de navigation et sa réponse. Le candidat ajoute la sélection substituable entre les offres de navigation que le fournisseur a rendues admissibles. TypeScript et 108 tests natifs passent. L’assemblage isolé du fichier de production avec la requête 87 de `c0b9f402` conserve à l’identique les quatre tours nominaux, les offres, les retours et la reprise par la requête.

Le premier vérificateur comparait un contrôle de garde propre au parcours nominal en même temps que les tours de la permutation. La reprise a limité cette assertion aux quatre tours des deux parcours. Le même contrôle de garde reste vérifié séparément.

Le reçu a été écrit le 27 novembre 2026 à 22 h 16 min 13 s (UTC−3), après 9 min 47 s depuis le début du lot. Il est conservé dans `artifacts/qualification-dico-86/d84d0b93.json`. Son SHA-256 est `20c716bfb7f92a84735c5ccc65abf91770df11c2811ae484ee385b13def1d218`.
