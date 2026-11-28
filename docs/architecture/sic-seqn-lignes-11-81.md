# SEQN · isoler un retour matériel et revalider une réécriture

## Contrats avant intervention

Les deux témoins du catalogue portent `ACTION1`. La ligne **11** relève de `factored_material_return / public_factored_return` à N1/T8. La ligne **81** relève de `scored_local_rewrite / public_scored_rewrite` à N2/T12. Le départ est N1, six niveaux, 600 gestes par niveau, limite globale de 16 gestes et sans curiosité ciblée. La reprise est aussi examinée avec 19 gestes. [Catalogue 11](sic-v8-strategies-observees.md?plain=1#L37) · [Catalogue 81](sic-v8-strategies-observees.md?plain=1#L107)

| Ligne | Faits à établir | Variation de la preuve |
|---|---|---|
| 11 | Retrouver le retour exact au point de départ, la décomposition de la scène et la chaîne utilisée pour préparer `ACTION1`. Vérifier le contrôle des deux projections, le rôle du dernier essai et la destination du reçu. | Garder l’observation courante, retirer un témoin historique nécessaire à la partition et vérifier l’offre suivante. Au retour de la même commande, examiner une contradiction sur un seul canal. |
| 81 | Retrouver les échantillons qui conduisent à un modèle associé à la progression, puis la commande et les supports relocalisés réellement revalidés à T12. | Garder l’observation de N2, retirer l’attestation du modèle marqué par la progression et suivre le repli. Avec le ticket historique, retirer une réécriture attendue et vérifier le refus ou la suite. |

Les contrats ont des sorties et des gardes distincts. Le lien éventuel doit être suivi jusqu’à l’événement acquis qui traverse la frontière de niveau. [Retour factorisé](../../src/logos-engine/v6-factored-return.ts) · [Réécriture après score](../../src/logos-engine/v6-scored-rewrite.ts)

## Rejeu au gel

La session de 16 gestes sur `8ce7ee35` et `d0e7527ca8033bd805a6d7a8bb021eff62e87021` donne les mêmes décisions et retours. Elle retrouve les **4/4** occurrences de la ligne 11 et les **5/5** de 81. La suite à 19 gestes confirme la frontière N2→N3 et la reprise de la réécriture en N3. Les deux variantes à histoire identique et leurs retours physiques sont conservés avec le rejeu nominal. [Paquets publics](../../tests/fixtures/sic-seqn-public-returns.json.gz) · [Tests des deux contrats](../../tests/sic-seqn-lines-11-81.test.ts)

| Étape | Ligne 11 · partition d’un retour exact | Ligne 81 · revalidation d’un modèle associé à la progression |
|---|---|---|
| Besoin et entrée | Les sept premiers tickets explorent. À T8, la scène est exactement revenue à son image initiale dans la même époque et au même score. `NativeCallerCoordinator.factoredOffer` appelle `ProspectiveContactAdapter.proposeFactored`, puis `factoredProposal` lit l’épisode public. | À T12, le score a ouvert N2. `NativeCallerCoordinator.scoredOffer` délègue à `ProspectiveContactAdapter.proposeScoredRewrite`. `ScoredRewriteAccess.propose` recompose les masques relocalisés dont la couleur source, la taille et le libellé sont compatibles avec le modèle de l’époque précédente. |
| Preuve consommée | `measuredPartitions` sépare les rangées 60–62 à partir de trois déplacements du même motif, sur plusieurs commandes. Les références pointent vers les observations avant T2, T4 et T5. La chaîne matérielle et la dérive de la bande ont des transitions séparément déterminées. Il reste une commande inédite à la pose finale de la chaîne. | Le modèle retient des masques 7 × 7, couleur 5→14. Les retours de T8–T10 fournissent les couples masque–commande. T11 est la frontière officielle par `ACTION4` devant le seul masque restant. Son reçu associe ce dernier masque à `ACTION4` comme hypothèse à revalider. Le modèle contient la référence avant T11 et celles des trois échantillons. |
| Plan et garde | Le ticket démarre par `ACTION1`, suivi de `ACTION3`, `ACTION2` et de la sonde `ACTION4`. La garde teste à chaque pas les deux empreintes, l’époque, le score et la commande disponible. Les trois premières prédictions doivent toutes se confirmer. La sonde finale ne prédit aucune image. | `ACTION1` réessaie la réécriture du support à l’origine (16,34). Le garde lie l’époque, le score, la référence courante, la commande disponible et l’ensemble du masque source. Le retour doit montrer la couleur cible sur toutes les cellules des sites prédits. |
| Retour, acquisition, reprise | T8 change 106 pixels, dont 3 sur la bande. Les deux canaux concordent et la suite avance vers T9, puis T10. `ScoredRewriteAccess.record` conserve à la clôture trois `factored_rewrite_sample` sous l’identifiant du même plan. T11 `ACTION4` ouvre N2 et produit `factored_rewrite_scored`. | T12 change 110 pixels au total. Les 30 cellules du masque prévu atteignent la palette 14. `scored_rewrite_test` date la confirmation. T13 choisit `ACTION2`. T14 réutilise `ACTION1` sur le masque relocalisé en (32,34). T18 progresse officiellement puis T19 rééprouve l’offre avec un autre site de N3. |

## Épreuves discriminantes

**11 · preuve de partition.** À T8, la suppression du seul témoin avant T4 dans l’épisode présenté au producteur fait disparaître la partition admissible. La scène de retour et le journal acquis restent identiques. La frontière libère `ACTION4`, puis `ACTION1`, et reçoit le vrai retour de chaque action. Dans le retour construit du vrai ticket T8, garder la projection matérielle correcte et remettre les anciennes valeurs aux rangées 60–62 suffit à sceller le préfixe avec `partition_forecast_diverged`. Aucun échantillon de réécriture n’est acquis sur ce pas.

**81 · provenance et résultat local.** À T12, présenter au producteur les mêmes données courantes sans le modèle qualifié par le score fait élire la frontière. Elle libère également `ACTION1` et reçoit le même paquet physique. Ce ticket ne produit aucun `scored_rewrite_test`. Avec le modèle de nouveau disponible, T13 rééprouve le prochain site par `ACTION2`. Dans le retour construit du vrai ticket T12, un seul pixel remis à la couleur source entraîne `predicted_mask_rewrite_refuted`. Le reçu rattache la réfutation à l’époque, à l’action et au retour. L’action cesse d’être admissible pour cette réécriture dans cette époque.

Les retraits de preuve interviennent dans les copies utilisées pour proposer. Les deux variations de retour remettent une partie de l’image précédente afin d’isoler le contrôle. Les paquets nominal et de repli sont issus du jeu public.

## Frontière déjà en service

Le point de passage est `ScoredRewriteAccess.record`. Il appelle déjà la garde de retour héritée pour sélectionner les échantillons de la ligne 11, puis `scoredModel` qualifie l’ensemble à la frontière officielle. `ContactMemory` conserve ce modèle et le fournisseur de 81 le relie à des sites courants. Retirer les échantillons jusqu’à n’en conserver qu’un ne suffit plus à produire le modèle. Le partage démontré porte sur cette acquisition et ce passage d’époque. La recherche par partitions et le test local des masques répondent à deux décisions distinctes. Le lot caractérise le raccord présent sur le gel pour les deux lignes. [Adaptateur et mémoire](../../src/logos-engine/v6-prospective-contact.ts) · [Partition et gardes](../../src/logos-engine/v6-factored-return.ts) · [Modèle et reçus](../../src/logos-engine/v6-scored-rewrite.ts)

## Reproduction

Depuis le lot sous Node 24. Le chemin `SIC_SEQN_GAME_ROOT` doit contenir Pyodide et les archives Python pour le rejeu physique. Utiliser `SIC_SEQN_ENGINE_ROOT` pour importer explicitement le moteur du gel.

~~~powershell
node --test tests/sic-seqn-lines-11-81.test.ts
$env:SIC_SEQN_GAME_ROOT = (Get-Location).Path
node --test tests/sic-seqn-lines-11-81.test.ts
node --test tests/v6-prospective.test.ts
~~~

Les cinq tests de caractérisation et les 143 contrats prospectifs passent. Le 27 novembre 2026 (UTC−3), préparation à 22 h 18 min 36 s, premier rejeu du gel à 22 h 19 min 11 s, verdict local à 22 h 23 min 45 s, soit 5 min 09 s. Critères figés au commit `57601dca`.
