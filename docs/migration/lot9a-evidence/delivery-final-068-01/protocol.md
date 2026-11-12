# Protocole prospectif de livraison 9A / native 0.68

## Objet et identités

La source A est exactement le publié Site108 / native0.67.0, commit `8462204043aa368faa7df280d796bb706eb53b38`, 331 fichiers natifs / digest `c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a`. La source B est le candidat0.68.0, 334 fichiers / digest `e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653`. Les deux manifestes sont figés séparément. Le candidat conserve tous les algorithmes des175 tests antérieurs; seul son littéral de version a changé depuis leur gel. Aucun résultat antérieur n'est rebaptisé comme nouvelle exécution0.68.

Le nouveau propriétaire `public_chart_navigation` et le programme familial `v6.chart_navigation.choose` sont les seuls ajouts attendus. Les propriétaires62→63 et programmes28→29 doivent être inventoriés sur les véritables fabriques sans initialisation de session. BranchRouting est maintenant commun aux deux rôles et doit être comparé exactement.

## Parcours et compteurs

Chaque rôle exécute à froid les formes historiques STCK3, STCK10, SMLP3, SMLP15: quatre sessions et31 retours, trois inspections terminales pour chacune des deux formes complètes. Chaque commande est calculée avant comparaison à la trace enregistrée, puis le retour correspondant est fourni. Aucun état appris n'est injecté. Les traces et budgets historiques ne sont pas modifiés.

Le caller Chart utilise cinq sessions froides sur les observations originales64×64: primaire3 retours, ancrage contraire1, ablation1, passif égal2 et passif changé2. Ce sont neuf retours par lancement. Les groupes de sélection restent ceux de production. La désactivation de la sélection Chart emprunte l'édition publique réellement disponible; l'acquisition passive reste observée. Une ablation est explicitement distinguée d'une acquisition effective. Les callbacks source et natifs sont conservés avec leurs arguments/états et leur ordre, sans injection d'état appris.

| Catégorie | Par lancement | Lancements prévus | Plafond correctif | Plafond cumulé nouveau |
| --- | --- | --- | --- | --- |
| Formes A | 4 sessions /31 retours | 1 | 2 | 8 sessions /62 retours |
| Formes B | 4 sessions /31 retours | 1 | 2 | 8 sessions /62 retours |
| Caller Chart final | 5 sessions /9 retours | 1 | 2 | 10 sessions /18 retours |
| Total nouveau | Sans simultanéité des commandes de cette branche | 13 sessions /71 retours attendus | Pas de retry automatique | 26 sessions /142 retours |
| Antécédents caller Chart | 10 sessions /14 retours déjà consommés | Conservés | Non rejoués | Réserve historique inchangée |
| Registre descriptif incluant ces antécédents | 23 sessions /85 retours attendus | Périmètre précis de ce tableau | Échecs inclus | 36 sessions /156 retours |

Les fabriques non initialisées de l'inventaire et les deux fabriques historiques de registration sont comptées séparément. Ce registre ne prétend pas récapituler toutes les autres campagnes historiques du projet. L'ancien libellé maximumSessions8 non précisé reste une réserve; ce nouveau protocole ne le répare pas rétroactivement. Les deux clôtures d'oracle échouées et la récupération indépendante restent conservées, sans troisième oracle. LKEY reste fermé définitivement.

## Conservation et attribution

Les réponses et snapshots complets, les observations, commandes, tickets, graphes et deltas sont conservés sans filtrage. La projection structurelle historique sert uniquement à comparer les formes; elle ne remplace pas la décision complète. Chaque graphe est validé avec le Kernel/store de son propre rôle. Les nœuds supplémentaires doivent être les racines Chart et ses fragments réellement atteignables, validés par leur contenu. Aucun joker général sur les fragments ou les faits de raisonnement n'est admis.

Les identités sont vérifiées contre les fabriques, chaînes, révisions et digests effectivement reconstruits. Le digest canonique des fichiers natifs et le sourceDigest calculé par la fabrique sont distincts. Les différences temporelles sont conservées puis attribuées à leurs champs et intervalles réels; l'horloge de production n'est pas remplacée. Un nouveau fait ou une nouvelle proposition Chart dans les formes historiques exige une preuve explicite. La condition de clôture est zéro différence inexpliquée, avec tous les échecs et sorties partielles gardés.

## Supervision et portée

La déclaration JSON lie les commandes exactes, outils, données et SHA-256 avant lancement. Chaque capture ou lecteur a un délai d'activité de300s au maximum et deux lancements au maximum; l'inventaire a120s. Un correctif doit répondre à un défaut constaté et recevoir une justification, sans élargissement silencieux des règles. Le superviseur compte tous les essais d'un même budgetKey, y compris après amendement du lecteur. La durée réelle inclut fermeture, compression et inventaires; elle est rapportée et déduite du budget cumulé. Le délai d'activité n'est pas présenté comme une borne murale identique, car fermeture et conservation s'ajoutent. Les nombres de sessions/retours sont imposés par les boucles figées, puis recomptés depuis les captures et sorties partielles. La limite V8 old-space de1536Mio ne constitue pas une limite absolue RSS.

Le travail fonctionnel reste sans verrou global et n'attend aucun autre lot. Ces formes ne constituent pas une mesure officielle ni un succès de nouveau jeu. La mesure STCK/SMLP officielle restera séparée sous courte exclusivité: chaque médiane de session complète strictement sous +10%, deux jeux examinés séparément, phases supérieures à +10% admises lorsque les deux globals passent, aucun échantillon retiré et aucune compensation entre jeux.

La façade publique positive Chart, les contrôles de worker et la mesure officielle restent des étapes distinctes. Le build final0.68 est déjà conservé. La publication nécessite une relecture du publié réel, une vérification du gel final et la courte exclusivité; la réservation de version seule ne vaut pas publication.
