# Contact, disposition et continuation sur les jeux sources

La question testée est précise. Une commande a déjà déplacé P d’un vecteur d. Quand le centre d’une seconde pièce C se trouve maintenant en P+d, cette commande place-t-elle P sur l’ancienne position de C et C sur C+d ? Les autres exemplaires visuellement identiques à C doivent garder leur place. La prévision est produite à partir du préfixe public.

Parmi les transitions distinctes des archives, 54 présentent cette disposition sur dix couples jeu–niveau. SKBN L1 en fournit 14, GABA L1 en fournit 11 et GIGO L4 en fournit 8. Lorsque la commande de déplacement doit aussi avoir été observée antérieurement, la lecture chronologique prédit 23 contacts exacts parmi 219 observations compatibles sur les 100 jeux. Sur les niveaux supérieurs, elle en prédit 8 parmi 469.

Une deuxième expérience exécute les commandes proposées depuis les préfixes d’origine, y compris des commandes que la trajectoire archivée n’avait jamais essayées dans ces états. Le classement privilégie les pièces et les dispositions sans poussée démontrée. Ces échantillons diffèrent des transitions effectivement choisies dans les archives.

| Interventions sur configurations proposées | 100 jeux L1 | 18 niveaux supérieurs |
|---|---:|---:|
| Configurations et commandes proposées | 368 | 229 |
| Les deux positions suivantes sont exactes | 2 | 4 |
| Une autre commande donne une disposition différente, avec les deux rôles observables | 2 | 4 |
| Première mobilité observée de la pièce | 1 | 0 |
| Disposition exacte suivie d’un déplacement prédit, distinct du geste seul et d’au moins un contrôle de même longueur | 1 | 0 |

La première mobilité confirmée concerne GABA L1. MIND L1, GIGO L4 et GRAV L5 fournissent les autres confirmations. Une réussite implique une famille contenant plusieurs exemplaires. Le test de contact constitue une hypothèse expérimentale très incertaine sans condition supplémentaire. Il ne suffit pas à sélectionner seul le meilleur déplacement d’un mécanisme.

`propose-source-contact-layouts.py` réduit les archives publiques de poses et scelle les deux positions ainsi que les prolongements soutenus par des mouvements antérieurs. `test-source-contact-layouts.mjs` rétablit les préfixes, exécute la proposition puis les contrôles, en vérifiant le placement des autres exemplaires.
