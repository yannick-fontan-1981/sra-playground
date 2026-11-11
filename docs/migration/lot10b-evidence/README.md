# Lot 10B : preuves de la reconstruction WindowQuestion

## Statut courant

Le candidat local porte l'étiquette native **0.62.0**. Il compose WindowQuestion avec les sources préparées PreviewPacking et Workshop et comprend désormais la correction d'horloge du commit local `4e7e4742b997128346e84f62b7a4fb8b5d4e47c5`. Son [manifeste diagnostique](recovery-20261111/diagnostic/clock-origin/candidate-native.json) compte **310 fichiers natifs**, digest `74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12`. Cette étiquette, ce commit et les gels ne sont pas des preuves de publication.

La reprise a effectivement récupéré **Site 95 / native 0.58.0**, commit `3a70463039768f7114edae7d94d7dd33b7f36aa8`. Depuis, **6A / native 0.60 a été réellement publié dans [Site 96](recovery-20261111/prepared6a-integration-02/published6a-observation.json), puis [Site 97 pour sa clôture documentaire](recovery-20261111/prepared6a-integration-02/published6a-documentation-observation.json)**. Le suivi 7 / `0.61` reste préparé et non publié. La réconciliation des octets du candidat avec ses prédécesseurs publiés demeure ouverte ; 10B n'est pas publié.

La [feuille de route](../v6-delivery-roadmap.md) donne le statut de livraison courant. La [filiation Window](../lot10b-window-question-lineage.md) décrit les contrats source et les adaptations natives. Les résultats ci-dessous gardent leur périmètre et leurs tentatives distincts.

## Provenance et composition

| Pièce | Portée |
| --- | --- |
| [Reprise de l'environnement](recovery-20261111/recovery-status.json) | Source publiée réellement récupérée ; anciens commits et preuves locales non retrouvés ; débit HPDL historique conservé. |
| [Premier import Preview refusé](recovery-20261111/prepared6a-integration/preflight-failure.json) | La copie de travail du harnais avait évolué depuis le gel préparé. Aucun résultat de cette tentative n'est effacé. |
| [Second import Preview](recovery-20261111/prepared6a-integration-02/source-observation.json) | Octets du gel préparé `ea2b522…`, copies supplémentaires identifiées, trois conflits constatés au moment de l'import. Ce reçu historique n'est pas réécrit après résolution. |
| [Revue indépendante de résolution](recovery-20261111/prepared6a-integration-02/independent-resolution-review.json) | Résolution du runtime, du harnais et de l'audit ; contexte courant des gardes, propriétaires et acquisitions conservés. |
| [Attentes du registre composées](recovery-20261111/diagnostic/prepared6a-registry-tests.json) | Deux corrections de tests héritées du commit préparé 6A `c263271…`, puis ajout explicite de Window comme 64e entrée. Aucun test exécuté par ce reçu d'édition. |
| [Premier gel HPDL](recovery-20261111/hpdl-freeze-01/source-manifest.json) et [archive](recovery-20261111/hpdl-freeze-01/source-archive.json) | 310 fichiers natifs, digest `318153c14c7766c9d007f1b2ede4fa03ce940d62b1369251339e0174af79c306`, au commit `dd4a432`. Archive de l'exécution réelle, pas gel de livraison finale. |
| [Correction des origines d'horloge](recovery-20261111/diagnostic/clock-origin/review.json) et [manifeste après correction](recovery-20261111/diagnostic/clock-origin/candidate-native.json) | Seul fichier natif modifié : `v6-native-runtime.ts`. La durée restante de l'appelant est convertie sur l'horloge du runtime, puis bornée par le budget actif. Nouveau digest `74143a7…` ; HPDL01 conserve son digest historique `318153c…`. |

La composition avec les sources préparées précède la réconciliation obligatoire avec les publications effectives des prédécesseurs. Le helper Preview initialement importé depuis l'archive ne contient pas les deux champs de capture ajoutés ultérieurement par 6A ; cette différence historique reste documentée. Le harnais candidat reprend maintenant `previewFacts`, `previewPacking.acquired` et `retainedSourceFact`, avec lecture du graphe réel, collecteur Window et garde Symbols conservés. Cette extension doit encore être gelée et validée dans la chaîne finale ; les preuves HPDL01 restent inchangées.

## Diagnostics de développement acquis

| Pièce | Observation |
| --- | --- |
| [Référence Window](recovery/diagnostic/window-oracle/reference-02.tap) | 173/173 contrôles de composant et de collecteur au stade indiqué par la filiation. |
| [Métadonnée du collecteur](recovery/diagnostic/window-oracle/capture-contracts-03.tap) | Relance séparée de trois contrats après ajout du champ `episode`. |
| [Noyau froid](recovery-20261111/diagnostic/lot10b-kernel-02.log) | Quatre scénarios : acquisition étrangère puis propre, état source, restauration et contexte courant. |
| [Contrôles communs](recovery-20261111/diagnostic/lot10b-common-regression-01.tap) | 56/56 sur les quatre fichiers déclarés pour ce diagnostic. |
| [Composition Preview/Window](recovery-20261111/diagnostic/lot10b-composed-kernel-01.tap) | 61/61, sans échec, annulation, test ignoré ou TODO. |
| [Trace synthétique froide](recovery/diagnostic/source-call-capture/synthetic-common-runtime-03.json.gz), [paquets publics](recovery/diagnostic/source-call-capture/synthetic-common-runtime-03-public-trace.json.gz) et [comparaison originale](recovery/diagnostic/source-call-capture/synthetic-source-parity-03.json.gz) | Dix appels source, sept restaurations, trois transitions/préfixes et quatre paquets complets ; zéro différence. Les interventions de mémoire restent des contrefactuels de composant. Aucun jeu exécuté. |
| [Horloge avant correction](recovery-20261111/diagnostic/clock-origin/before-fix.json), [après correction](recovery-20261111/diagnostic/clock-origin/after-fix.json) et [Window après correction](recovery-20261111/diagnostic/clock-origin/window-after-fix.json) | **Deux échecs reproduits avant correction, puis 2/2 tests passés et Window 4/4 passé.** Origines d'horloge inversées, expiration à la garde et au `resume`, identité du signal et acquisition unique du retour conservées. Ces contrôles ciblés ne remplacent pas la validation finale. |

Ces populations se recouvrent et ne sont pas additionnées. Le premier échec de chargement du test, les anciennes comparaisons diagnostiques et leurs correctifs restent conservés. Les preuves originales proviennent de la référence épinglée `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` ; elles ne sont pas des entrées de décision du moteur de production.

## HPDL : progression partielle et arrêt technique conservés

Le [contrat de campagne](hpdl-campaign-contract.md) fixe une session froide visant six niveaux et le cumul maximal de 2 400 secondes. Le [registre](recovery-20261111/hpdl-clock.json) est l'autorité des débits. Les **159,45478678199166 secondes / 40 actions historiques** sont conservées malgré l'absence de leurs anciens journaux bruts.

Le [premier reçu réel](recovery-20261111/hpdl-live-01/execution-hpdl.json) constate **48 retours d'action, trois niveaux terminés, puis le signal externe 9**. Le dernier checkpoint complet contient 47 actions et 47 préfixes ; le 48e paquet observé ne devient pas une acquisition supposée. Aucun rapport final du harnais n'a été créé. Le signal n'est attribué ni au jeu ni à une cause mémoire démontrée. Le débit de **315,682964465 secondes** inclut le lancement et la conservation des preuves.

Le [diagnostic original partiel](recovery/diagnostic/window-oracle/checkpoint-47-first-abstention-01.json) établit, sur la première consultation du niveau 4, que les quinze méthodes transportées correspondent bien à la signature courante. Les 24 configurations sont complètes mais aucune ne couvre les dix rangs avec les trois fenêtres mesurées. Le meilleur résultat couvre huit rangs. Les 27 acquisitions étrangères du niveau 4 présentes dans le checkpoint sont également cohérentes avec l'original. Cela ne démontre ni l'impossibilité du jeu, ni la parité de l'appelant original complet, ni la cause du signal 9.

La [vérification réelle du writer incrémental](recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-01/writer-check.json) est **passée** : **177 532 943 octets identiques** directement et après gzip/gunzip, EOF exact, **28 petits cas et 13 erreurs attendues** vérifiés, entrées inchangées. Les champs probants sont conservés. Le parcours du gros checkpoint inclut les comparaisons et la compression ; il ne mesure pas le coût de tous les checkpoints d'une campagne. Le maximum mémoire diagnostique inclut aussi le parsing et ne borne pas la mémoire du processus de production. La cause du signal 9 reste inconnue.

Le [diagnostic combiné01](recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-01/execution-hpdl-diagnostic.json) conserve ce succès du writer, puis l'interruption de la parité par la borne d'activité commune. La [tentative diagnostique02](recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-02/execution-hpdl-diagnostic.json), limitée à la parité avec une nouvelle borne déclarée, est ensuite **passée**. Son [reçu PARTIAL](recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-02/window-source-parity.PARTIAL.json.gz) compare **111 appels, 94 restaurations, 47 préfixes et 47 actions**, dont **17 acquisitions actives et 30 passives**, avec **zéro divergence et zéro adaptation**. Les quatre ablations de composant donnent **188 interventions, 113 appliquées, 23 changements d'action ou de refus et zéro erreur**.

Cette parité reste liée à l'ancien digest `318153c…` et au checkpoint47 historique. Le 48e retour public reste observé, mais son acquisition n'est pas reconstruite. Aucun rapport final, succès sur six niveaux ou résultat de jeu du nouveau candidat `74143a7…` n'est déduit de ces diagnostics ; la parité de l'appelant original complet reste non établie.

### Horloge HPDL conservée

Le [registre cumulatif](recovery-20261111/hpdl-clock.json) indique **1 263,3446460859916 secondes débitées** et **1 136,6553539140084 secondes restantes** sur 2 400, sans intervalle en cours ni remise à zéro.

| Intervalle conservé | Secondes débitées | Qualification |
| --- | --- | --- |
| Historique de l'environnement perdu | 159,45478678199166 | 40 actions historiques conservées comme débit ; journaux bruts non récupérés. |
| HPDL01 et rétention de ses preuves | 315,682964465 | 48 retours publics observés, signal 9 et absence de campagne finale conservés. |
| [Travail hors jeu](recovery-20261111/hpdl-analysis-after01/hpdl-conservative-case-work.json) | 451 | Débit conservateur d'un intervalle observé ; aucune mesure monotone ou action de jeu inventée. |
| Diagnostic01 | 149,720413432 | Writer passé, parité interrompue par la borne d'activité partagée ; échec conservé. |
| Diagnostic02 | 187,486481407 | Parité PARTIAL passée, conservation du reçu comprise. |

Les diagnostics n'ajoutent aucune action HPDL et aucun débit n'est remboursé. La nouvelle campagne bornée et la QA navigateur partageront le même budget restant.

## Validation et coût à clôturer

Le [périmètre principal](validation-test-scope.json) et le [complément intégré](integrated-extra-test-scope.json) déclarent **44 fichiers** avant leur première validation finale. Les trois modules qui décodent le cas LKEY clos sont exclus intégralement. Les dix rejeux historiques sont déclarés par le [manifeste de régression](recorded-regression-cases.json). **Nouvelle campagne HPDL sur le candidat corrigé, QA navigateur, validation finale, cinq contrôles, build et rejeux restent ouverts.** Les diagnostics ci-dessus, dont la parité historique PARTIAL et les tests du correctif, ne remplacent pas ces preuves liées aux octets définitifs.

La règle de coût autorisée est la suivante : pour **chaque jeu de référence**, la médiane des sessions complètes du candidat doit rester **strictement sous +10 %** par rapport à la référence réellement publiée et remesurée. Une phase peut dépasser +10 % lorsque ce critère global passe. Les phases, cohortes, sessions, pointes défavorables et éventuels refus du comparateur historique restent visibles ; aucun coût n'est retranché et aucune compensation entre jeux n'est appliquée.

La fenêtre officielle exige les preuves fonctionnelles, une référence publiée vérifiée, les déclarations immuables et un calme explicitement confirmé. Aucun résultat de coût ou de publication 10B n'est établi par ce document à ce stade.
