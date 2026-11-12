# Lot 8B : native 0.67 publiée dans Site 108

**La publication a réussi**, avec accès privé du propriétaire conservé :

https://sra-playground.yannick-fontan.chatgpt.site

| Identité | Valeur constatée |
| --- | --- |
| Version native | **0.67.0** |
| Version Site | **108** |
| Source publiée | `8462204043aa368faa7df280d796bb706eb53b38` |
| Déploiement | `appgdep_6af5b61c537c8191b0a7252d3de9a4f9` |
| État natif retourné | `succeeded` |
| Registre intégré | **69/76 entrées, dont 26/33 matérielles** |
| Gel natif | **331 fichiers**, digest `c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a` |

La [synthèse de publication](validation-summary.json) relie le résultat natif, la version sauvegardée, le commit, l'archive soumise, les qualifications fonctionnelle et de coût, ainsi que la libération du bail. Le succès terminal de Sites constitue la preuve de déploiement ; aucune nouvelle consultation de statut du déploiement terminé n'a été effectuée.

## Source et build effectivement publiés

Le build comprenant TypeScript avait déjà réussi sous l'identité finale 0.67. Avant publication, **2 886 entrées de build et les 74 fichiers produits, soit 30 121 789 octets, ont été revérifiés identiques**. Le helper officiel Sites a donc été appelé avec `commands: []`, puis a poussé le commit exact par un push Git ordinaire et produit l'archive. Le HEAD est resté identique pendant le bail. Le [reçu de réconciliation](build-reconciliation.json) conserve ces vérifications.

L'archive soumise contient les **74 fichiers de build exacts et le manifeste d'hébergement**, soit 75 fichiers vérifiés. La première vérification locale attendait le manifeste à son chemin du dépôt ; son échec est conservé. Après lecture du helper officiel, la seconde vérification a utilisé son chemin de staging documenté, `dist/.openai/hosting.json`, et vérifié les 75 fichiers. Ni le build, ni le moteur, ni l'archive n'ont été modifiés ou régénérés pour ce correctif du vérificateur.

L'archive compressée soumise, de 14 887 822 octets, garde le SHA-256 `4a2db5fdc00ec78e49197bc24dbde359ef435fb990c9c69ce186b5a288b1966a` après le succès. Les métadonnées Sites décrivent leur propre conteneur tar de 30 187 520 octets et 75 fichiers, avec un hash distinct. Ces deux représentations ne sont pas présentées comme identiques octet pour octet. La preuve conserve séparément l'archive locale vérifiée et la provenance source/version/déploiement renvoyée par Sites.

## Coût accepté, avec les dépassements locaux visibles

Le [bilan officiel de coût](../final-performance-067-01/README.md) compare le candidat au vrai prédécesseur **Site 107 / native 0.66**. La fenêtre ABBA conserve 32 sessions mesurées et huit chauffes, sans exclusion.

| Jeu | Médiane 0.66 | Médiane 0.67 | Variation globale |
| --- | ---: | ---: | ---: |
| STCK | 9 921,972 ms | 9 853,022 ms | **−0,69 %** |
| SMLP | 15 364,418 ms | 15 087,339 ms | **−1,80 %** |

Les deux critères sont strictement sous +10 %. La restauration SMLP dans la première paire (**+30,36 %**) et la restauration STCK dans la seconde (**+29,98 %**) restent visibles et sont admises selon la règle globale autorisée. Les phases regroupées ne présentent aucun dépassement. Les statuts des comparateurs historiques et leur refus strict restent conservés ; la lecture complémentaire a été déclarée avant mesure et vérifiée sur les 40 formes et signatures complètes.

Ce coût porte sur le harness natif déclaré jusqu'au dernier retour acquis. Il exclut notamment le moteur de jeu réel, le réseau et le rendu navigateur. L'isolation observée est limitée aux checkouts propres et au namespace visible ; le calme de tout l'hôte n'est pas prétendu. Les réserves historiques de coût de 0.65 et 0.66 restent distinctes.

## Exclusivités closes et sauvegardes

Le travail courant, les contrôles, commits et push de sauvegarde sont restés sans verrou global. La mesure officielle a détenu son mutex pendant **481,3 secondes**. La publication a acquis immédiatement son propre bail, borné à 300 secondes, et l'a libéré après **166,5 secondes**. Dans les deux cas, le même inode est conservé, le descripteur détenu est fermé et aucun fichier de verrou n'est supprimé ou remplacé. Aucune attente de disponibilité d'un autre lot n'a été introduite.

Les reçus actifs du bail ont été temporairement exclus du staging Git local afin de conserver un HEAD stable pendant publication. Après la libération terminale vérifiée, cette exclusion propre a été retirée et les reçus sont conservés dans la sauvegarde documentaire suivante. Le commit publié reste `8462204043aa368faa7df280d796bb706eb53b38` ; le dernier commit de sauvegarde documentaire est indiqué séparément dans le compte rendu final.

## Feuille de route après publication

| Étape | État | Suite |
| --- | --- | --- |
| Lot 8B, composant et raccordement | Qualifiés dans le périmètre déclaré | Conserver les preuves et contre-exemples. |
| Lot 8B, version finale et coût | Acquis pour 0.67 contre 0.66 | Conserver toutes les sessions, les diagnostics et les limites. |
| Lot 8B, publication | **Réussie : Site 108 / native 0.67** | Reçus et source exacte sauvegardés. |
| Lot 11, trajet public BranchRouting | Prochaine qualification propre à cette filière | Déclarer le passage public 64 × 64, les tickets et le worker, puis restauration et sessions longues. |
| 6C / 6D | `observed_rigid_cargo`, `shared_settlement` restent ouverts au registre publié | Continuer leurs branches et qualifications. |
| Lot 9 | `chart_navigation`, `region_intervention`, `joint_channels` restent ouverts | Continuer leurs transferts ; `discrete_network` reste hors compteur 76. |
| 10D / 10E | `temporal_selection`, `invited_endpoints` restent ouverts | Continuer leurs intégrations et qualifications. |
| Lot 11, portes globales | Six portes encore fausses | Parité complète, graphes, restauration, sessions longues, coût global et lisibilité. |

La preuve positive BranchRouting actuellement acquise concerne le runtime natif : cinq chaînes, 26 retours, 23 acquisitions, une ablation et deux incomplets conservés. Elle ne qualifie pas encore le trajet public 64 × 64 ou le worker. Les 524 tests / 23 modules et 11 cas / 187 projections restent des preuves historiques réconciliées ; les graphes finaux, audits et build ont été renouvelés sous 0.67. Aucun nouveau succès de jeu n'est ajouté. **LKEY reste définitivement fermé.**

La [feuille de route générale](../../v6-delivery-roadmap.md) porte ce nouvel état publié ; les sections anciennes gardent leur statut de jalons historiques.
