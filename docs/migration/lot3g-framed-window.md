# Lot 3G : FramedWindow, moteur natif 0.48

## État de la livraison

La branche **`framed_window_composition`** est transférée dans le propriétaire commun. Elle mesure une référence encadrée, cherche son unique copie exacte dans un autre cadre visible, propose un point sur cette copie et conserve le résultat de l’essai. La sélection, l’autorisation courante, l’acquisition, la restauration et la décision suivante sont vérifiées dans une boucle complète du contrôleur. **La contribution propre en jeu reste ouverte : aucune nouvelle réussite de jeu n’est attribuée à FramedWindow.** Le [reçu de portée](lot3g-evidence/final/framed-window-validation-scope.json) distingue ce périmètre technique de cette réserve.

Le périmètre formel passe **2 566/2 566 tests dans 68 fichiers**, sans échec, annulation, test ignoré ou TODO, avec **5/5 contrôles du projet, compilation comprise**, **68/68 contrôles de régression** et les **15 groupes de contrôles intégrés**. Le [reçu final des tests](lot3g-evidence/final/revalidated/validation/delta-tests-run.json) conserve les empreintes de tous les intrants. Il couvre le delta déclaré, pas toute la suite historique.

Le premier passage **2 564/2 566** reste à son [emplacement d’origine](lot3g-evidence/final/validation/delta-tests-run.json). Ses deux échecs venaient des attentes du registre restées à 51/76 et à 13 alias de fenêtre. Les deux tests comptent maintenant l’entrée ajoutée, dans son ordre source, avec 52/76 et 14 alias. Aucun test ou seuil n’a été supprimé. Les 68 fichiers ont été rejoués ; aucun code natif ou intrant de build n’a changé. Le [reçu de reprise](lot3g-evidence/diagnostic/formal-validation-retry.json) distingue la correction des attentes et la réutilisation à l’identique du build réussi.

**Le coût global 0.48 est accepté sur les deux jeux** contre la référence 0.47 remesurée, selon la [décision globale](lot3g-evidence/performance/global-budget-decision.json).

| Jeu | Médiane complète 0.47 fraîche | Médiane complète 0.48 | Variation |
| --- | ---: | ---: | ---: |
| STCK | 10620,593652 ms | 10796,360101 ms | **+1,654959 %** |
| SMLP | 18046,696917 ms | 19245,217139 ms | **+6,641217 %** |

Les **32 sessions et 400 actions mesurées** suivent A1/B1/B2/A2. Les huit chauffes déclarées, 24 actions, sont les seules exclusions ; aucune session mesurée ni valeur extrême n’est retirée. La revue indépendante passe **231/231 contrôles**. Une [seconde revue indépendante des résultats bruts](lot3g-evidence/diagnostic/cost-result-review.json) confirme les médianes, les distributions, les cohortes et les exclusions avec **96/96 contrôles**. Le calcul utilise la médiane regroupée des huit sessions par version et par jeu, sans compensation entre jeux ni somme de phases imbriquées.

Le diagnostic historique reste **12/16**, avec les quatre dépassements suivants conservés :

| Jeu | Phase | Hausse de médiane |
| --- | --- | ---: |
| STCK | Service de préfixe connu | **+14,718825 %** |
| STCK | Requête de préfixe connu | **+13,306563 %** |
| STCK | Garde de préfixe connu | **+11,457232 %** |
| SMLP | Garde de préfixe connu | **+13,181611 %** |

Ces dépassements sont acceptés dans cette fenêtre selon votre règle, car les deux coûts globaux restent strictement sous +10 %. Ils ne sont pas reclassés artificiellement comme conformes à l’ancienne règle par phase. Les deux cohortes conservent respectivement **10/16 et 13/16** diagnostics conformes. Les p95 restent également publiés : notamment restauration STCK **+26,771026 %**, service de préfixe STCK **+26,134641 %**, acquisition/persistance SMLP **+18,115606 %**. Le [rapport complet](lot3g-evidence/performance/results.md) contient toutes les distributions, pointes disponibles et valeurs défavorables. Il ne permet pas d’attribuer causalement ces variations à la nouvelle branche ou de garantir une vitesse en jeu.

**Le transfert technique 3G et son budget commun sont livrés dans ce périmètre ; sa contribution propre en jeu reste ouverte.** L’acceptation du coût ne ferme ni cette réserve ni la parité héritée complète.

## Référence, gel et compteurs

La référence est **Site 75 / native 0.47.0**, commit `08bc35e447d17530a774c146ce4e660b1ef29d9a`, digest natif `54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165`. Elle a été relue dans un checkout distinct et remesurée dans la fenêtre courante. Les anciens temps ne fournissent aucun échantillon au nouveau bilan. Le [reçu de provenance](lot3g-evidence/baseline/provenance.json) conserve son identité.

Le candidat **0.48.0** est gelé sous **`fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26`** : **266 fichiers natifs**, archive de **277 fichiers**. Le [manifeste natif](lot3g-evidence/final/source-manifest.json), l’[archive](lot3g-evidence/final/source-archive.json) et ses [parties](lot3g-evidence/final/source-archive-parts.json) identifient exactement les octets exécutés. Les originaux V5/V6 du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` restent immuables ; la production exécute TypeScript.

| Compteur | État 0.48 | Portée |
| --- | ---: | --- |
| Entrées DRM raccordées | **52/76**, aucune partielle | Une entrée de plus ; 24 restent ouvertes |
| Branches observées raccordées | **6/6** | FramedWindow est une entrée de fenêtre distincte, pas une septième branche observée |
| Workflows compilés | **37** | Compilation, distincte de la consommation et de la parité |
| Modules de composant vérifiés | **160** | Contrats de composant, sans transfert complet automatique |
| Modules partiellement transférés | **144** | Sous-ensembles consommés et héritages incomplets |
| Modules en attente | **1 065** | Périmètre source restant |
| Modules entièrement vérifiés | **0** | Aucune clôture de migration complète |

Le [registre des entrées](v6-entry-point-progress.json) et l’[audit de couverture](v6-coverage.json) restent séparés. `fullV6Parity` et les six portes de complétude restent faux. L’ordre DRM place FramedWindow immédiatement après RootedQuota ; les replis hérités complets restent partiellement transférés.

## Fonctionnement et connaissance conservée

La mesure recherche deux composantes qui contiennent leur périmètre rectangulaire, sans toucher le bord de l’image. Les cadres doivent avoir la même apparence de bordure, des boîtes disjointes et des dimensions compatibles. L’intérieur de la petite référence contient au moins deux valeurs distinctes. La branche accepte une seule paire ayant des correspondances et une seule fenêtre égale dans cette paire. Elle compare tous les pixels nécessaires, y compris le fond et les pixels isolés ; aucune rotation, échelle ou signification de couleur n’est présumée.

Le point provient du centre de cette fenêtre actuellement mesurée. Le certificat V5 établit une égalité descriptive dans le domaine déclaré. Il ne prouve ni que le petit cadre joue le rôle de référence utile, ni que cliquer fera progresser le jeu. Ces deux hypothèses restent explicitement présentes dans la proposition. La [filiation](lot3g-framed-window-lineage.md) relie projection, certificat, accès, gardes et mémoire aux méthodes originales.

Un retour sans augmentation du score officiel bloque exactement la clé formée par l’époque, l’image entière et les fenêtres mesurées. Une nouvelle référence d’observation ne suffit pas à effacer ce blocage. Un changement d’époque ou de pixels produit une autre clé ; cela ne constitue pas une loi universelle apprise. Un succès ultérieur ne supprime pas un blocage antérieur de la même clé. Après chaque action propre, le préfixe est scellé et `matched` reste inconnu.

La nouvelle couche possède ses événements et ses essais bloqués. L’acquisition et le digest suivent **RootedQuota → FramedWindow → Catalogue** ; les gardes choisissent la couche propre avant son ancêtre. Le journal commun acquiert chaque retour une fois. La restauration construit des propriétaires temporaires, vérifie le digest, puis les publie ensemble. Identité, révision et témoin structurel invalident une réutilisation devenue incorrecte. Une couche FramedWindow vide est omise du digest natif pour conserver les **neuf checkpoints réellement exportés de 0.47**, notamment Population et Reception. Cette compatibilité native est distincte du suffixe propre original, comparé sur un parent opaque. La [revue d’intégration](lot3g-evidence/diagnostic/shared-integration-review.json) et les [checkpoints antérieurs](../../tests/fixtures/v6-framed-window-legacy-checkpoints.json.gz) en conservent les preuves.

## Oracle, limites et adaptations explicites

L’[oracle indépendant](lot3g-evidence/diagnostic/source-oracle-export.json) conserve **68 cas de méthode, 24 gardes, 9 exceptions source, 43 cas de noyau, 5 restaurations et 2 séquences froides**. Ces ensembles ont leurs propres dénominateurs ; ils ne sont pas présentés comme un total de tests disjoints. Les **1 786 fichiers originaux** sont vérifiés avant et après. Les attentes ne proviennent pas du port TypeScript.

Seule l’opération V5 **`exact_candidates` en mode `MATCH`** est transférée. Les dix autres opérations temporelles, la totalité des conversions Pydantic, la sémantique numérique Python générale et la parité de l’appelant hérité complet restent hors périmètre.

Deux adaptations natives sont nommées dans le runtime. Lorsqu’une comparaison de pixels est interrompue, l’original peut lever `AttributeError` à cause de son appel à `FrozenMap.overlay`. **`native_temporal_fragment_interrupted_pixel_frontier`** renvoie un résultat incomplet `NEEDS_EVIDENCE`, avec sa frontière, sans action ni acquisition. Les quatre exceptions originales concernées restent dans l’oracle ; aucune parité d’exception n’est revendiquée. **`atomic_framed_window_response_validation`** refuse un événement malformé avant de muter le propriétaire, là où la source pouvait muter partiellement avant son erreur.

La garde propre vérifie époque, score, observation, image complète, disponibilité et concordance des actions avec le point du plan. Elle n’authentifie pas seule l’identité de tout le plan ou du certificat. Le `bind` conserve aussi la portée du `zip(actions, steps)` original. Les contrôles communs d’enveloppe, de domaine, de connaissance et WHY/ACT restent distincts et obligatoires ; les cas contraires des fonctions isolées ne sont pas retirés.

**Le préfiltre géométrique n’a pas de contrôle interne d’échéance.** Le domaine commun est limité à 65 536 pixels `uint8`, mais la mesure parcourt toutes les paires et fenêtres avant la certification bornée. Les diagnostics synthétiques de géométrie conservent le risque de latence et d’allocations sur une image artificiellement chargée. Leurs temps ponctuels ne sont ni un maximum garanti ni une mesure officielle. Voir le [reçu géométrique](lot3g-evidence/diagnostic/framed-window-geometric-diagnostic.json).

## Boucle intégrée et contribution démontrée

La [preuve du contrôleur complet](lot3g-evidence/final/framed-window-common-loop.json.gz) passe **15 groupes de contrôles** sur **deux sessions synthétiques froides**, avec les déclarations source inchangées. Aucun état appris ne préinitialise la session. Le moteur choisit la branche à sa vraie place, lie le point courant et libère l’action par WHY/ACT avant que le harnais fournisse son retour contrôlé.

| Retour contrôlé | Acquisition | Décision suivante |
| --- | --- | --- |
| Image et score inchangés | Un événement négatif, une clé bloquée | Après restauration, FramedWindow refuse de répéter ; le contrôleur choisit l’exploration commune |
| Score augmenté et nouvelle époque synthétique | Un événement positif, aucun blocage ajouté | Une nouvelle proposition FramedWindow est autorisée dans la nouvelle époque |

Trois retours invalides sont refusés sans modifier le graphe, l’autorité ou l’acquisition. Une ablation séparée retire uniquement l’événement négatif réellement acquis dans cette expérience contrôlée : au même contexte, le résultat du composant passe du refus à la proposition d’action. Cette intervention est faite dans des propriétaires contrefactuels séparés ; elle ne prétend pas isoler tout l’appelant commun. Le témoin de progrès synthétique ne constitue aucun score gagné dans un jeu.

## Vues publiques et réserve en jeu

Le premier scan examine **96 vues initiales** et ne trouve aucune admission. Le complément, déclaré et borné avant exécution, examine **909 vues canoniques dans 30 traces**, au plus 40 par trace. Il trouve **11 admissions**, sans exception. CWSE, SK48, FOGW et VOIS sont exclus de ces scans avant les appels source.

| Cas du corpus | Admissions géométriques | Propositions propres | Commande suivante archivée identique | Limite observée |
| --- | ---: | ---: | ---: | --- |
| LF52 | 1 | 1 | 0 | Point proposé différent de la commande archivée |
| RSWP | 4 | 4 | 0 | Quatre commandes différentes |
| TR87 | 6 | 0 | 0 | Action pointée indisponible |

Les cinq propositions originales propres et communes concordent entre elles, mais aucune ne correspond à la prochaine commande de sa trace. **Aucun retour réel n’est donc acquis pour FramedWindow dans ce diagnostic.** Les restaurations sur ces retours ne sont pas exercées ; zéro acquisition n’est pas une validation positive. Le [scan complet](lot3g-evidence/diagnostic/retained-public-admission.json) et la [comparaison des commandes](lot3g-evidence/diagnostic/retained-public-command-comparison.json.gz) conservent toutes les non-admissions et les limites d’échantillonnage. Le rapport brut se reconstruit avec le [restaurateur vérifié](lot3g-evidence/restore-public-command-comparison.py).

La contribution propre en jeu reste donc un suivi ouvert. Aucun nouveau cas, objectif de trois niveaux ou compteur de temps n’a été inventé. La règle de livraison permet un sous-lot technique vérifiable sans imposer un nouveau jeu à chaque entrée ; elle ne transforme pas la boucle synthétique en réussite de campagne.

## Non-régressions et interface

Les quatre rejeux froids utilisent les rapports effectivement produits par 0.47 et les retours publics archivés inchangés. Chaque commande native est calculée avant que le harnais fournisse le retour enregistré. Les **17 contrôles par cas passent**, soit **68/68**, sur **159 actions, 88 préfixes, 163 paquets complets et 12 frontières naturelles**.

| Cas | Actions | Préfixes | Niveaux conservés | Contrôles |
| --- | ---: | ---: | ---: | ---: |
| CATR | 12 | 8 | 3 | 17/17 |
| RSWP | 19 | 11 | 3 | 17/17 |
| FOGW | 50 | 27 | 3 | 17/17 |
| VOIS | 78 | 42 | 3 | 17/17 |

La [synthèse des régressions](lot3g-evidence/final/regressions/regression-summary.json) précise les champs comparés et leurs exclusions. Ces parcours ne sont pas de nouveaux succès en direct ni une preuve de contribution FramedWindow. Ils ne certifient pas tous les payloads des fournisseurs ou la parité complète de l’appelant Python.

Dans le navigateur, une session CATR continue conserve **12 actions, 3 niveaux et 8 plans**, avec arrivée au niveau 4. L’action isolée passe de 3 à 4 actions ; Pause est observé à 5 actions et 3 plans, puis la reprise atteint les frontières à 7 et 12 actions. La première demande de Pause avait atteint la fin du premier niveau avant d’afficher un état arrêté ; ce résultat est conservé. Le [reçu d’interface](lot3g-evidence/final/browser/browser-qa.json) et son relevé textuel AX décrivent les observations visibles. Aucun état caché ou saut de niveau ne fournit le résultat.

## Suite et conservation des réserves

La prochaine entrée autonome est **`coupled_prefix_reference`**, puis **`recurrent_series`**. Le suivi FramedWindow cherchera une contribution effective sur une trajectoire de jeu adaptée ; les limites de préfiltre, de garde propre et d’héritage restent explicites. Les suivis Population, Reception et RootedLine ne sont pas annulés par ce transfert.

Les horloges précédentes restent inchangées : **CWSE 2 399,683865 s**, **SK48 667,35444 s**, **FOGW 951,320275 s**, **VOIS 1 017,469531 s**. Les traces FOGW/VOIS sont utilisées uniquement pour la non-régression. Aucun compteur de cas n’est remis à zéro. La [feuille de route](v6-delivery-roadmap.md) conserve les statuts des lots 1 à 11 et les six portes de migration encore ouvertes.
