# Lot 3G : filiation de FramedWindow, moteur natif 0.48

## Source et périmètre

Ce lot transfère `framed_window_composition` depuis les originaux V5/V6 conservés au commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. Les **1 786 fichiers originaux** sont vérifiés avant et après l’export de l’oracle. Aucun moteur de jeu, manuel, spécification ou solution ne fournit les mesures, les attentes ou les commandes de ce transfert.

Le contrat propre observe deux cadres, formule une question de correspondance exacte, propose un point sur la fenêtre mesurée, puis acquiert son retour réel. La référence plus petite et l’utilité de pointer demeurent des hypothèses de bibliothèque. Le transfert ne fournit aucune loi universelle de transport, de navigation dans des photographies ou de succès officiel.

| Contrat consommé | Original conservé | Cible native |
| --- | --- | --- |
| Mesure des cadres et recherche de fenêtres égales | `laya_proto/framed_window_access.py:measure`, composantes de `geometric_observer.py` | [v6-framed-window-observation.ts](../../src/logos-engine/v6-framed-window-observation.ts) |
| Certificat descriptif des candidats déclarés | `framed_window_access.py:certify` et `TemporalFragmentRequest` | Même projection native, avec [v5-temporal-fragment-match.ts](../../src/logos-engine/v5-temporal-fragment-match.ts) |
| Calcul fini `exact_candidates` | `yf_arc3_v5/capabilities/temporal_fragment_match.py` et contrats mécaniques D | Noyau natif consommé, bornes et reçus descriptifs |
| Proposition, garde, réponse et mémoire des essais | Couche propre `FramedWindowAccess` | [v6-framed-window-access.ts](../../src/logos-engine/v6-framed-window-access.ts) |
| Liaison au point courant et restauration | `common_framed_window.py` | Enveloppe native et propriétaire [SharedSeries](../../src/logos-engine/v6-shared-series.ts) |

Les empreintes des sources consommées figurent dans la [fixture originale](../../tests/fixtures/v6-framed-window-reference.json.gz) et son [reçu d’export](lot3g-evidence/diagnostic/source-oracle-export.json). Les fichiers Python ne sont pas modifiés. Le moteur de production reste TypeScript.

## Mesure publique des cadres

L’observateur source extrait les composantes connexes de même valeur de palette, dans son ordre déterministe. Une composante candidate doit contenir tout le périmètre rectangulaire de sa boîte, avoir au moins trois pixels sur chaque axe et ne pas toucher le bord de l’image. Le périmètre doit être présent ; des pixels supplémentaires de la même composante dans l’intérieur ne sont pas nécessairement exclus. Cette condition ne doit donc pas être reformulée comme l’exigence d’un contour strictement vide.

Les paires candidates ont la même apparence de bordure, des boîtes disjointes et des dimensions compatibles. L’aire intérieure de la référence proposée doit être strictement plus petite que celle du domaine de recherche. La référence intérieure doit contenir au moins deux valeurs distinctes. L’ordre des paires est conservé ; les comptes de paires et de fenêtres examinées ne sont pas réécrits à partir du seul résultat retenu.

La comparaison examine les positions possibles dans l’intérieur du grand cadre. Elle conserve tous les pixels du rectangle de référence, fond et pixels isolés compris. Elle n’infère ni rotation, ni agrandissement, ni rôle fixe de couleur. Une scène est admise seulement s’il existe **une seule paire compatible comportant des correspondances**, et **une seule fenêtre égale dans cette paire**. Un autre cadre candidat sans correspondance peut exister ; une seconde paire compatible avec une correspondance rend la scène ambiguë.

**Borne de mesure et borne de certificat restent distinctes.** Le domaine commun admis est une image rectangulaire de valeurs `uint8` comportant au plus **65 536 pixels**. Le préfiltre de mesure parcourt ses paires et fenêtres sans contrôle interne d’échéance. Le budget du noyau D borne le calcul de certification ultérieur, pas ce préfiltre déjà exécuté. Ce lot ne prétend donc pas garantir un temps maximal de mesure ou une interruption du préfiltre à chaque position examinée.

Les cas originaux couvrent translation, permutation de palette, dimensions paires, référence sur une seule ligne ou colonne, correspondance aux coins, absence ou multiplicité des correspondances, référence uniforme, bordures différentes, cadres d’aire identique, contact avec les bords de l’image, pixel de bordure manquant et pixel intérieur supplémentaire. Les images vides, non rectangulaires et dépassant le domaine de mesure conservent séparément leurs exceptions originales.

## Certificat V5 effectivement consommé

`certify` construit une requête `mechanics.temporal_fragment_match.exact_candidates`, mode `MATCH`, à partir de la scène déjà mesurée. Elle déclare un seul modèle d’égalité exacte de palette, une photographie courante contenant l’intérieur du grand cadre, une référence courante et les fenêtres préfiltrées. Les références de requête, d’observation, de modèle, de scène, de propriétaire et de contribution sont conservées dans le reçu.

Le noyau ne décide pas qu’un cadre est une référence utile. Il certifie uniquement les fenêtres que l’appelant lui a déclarées. L’unicité dans ce domaine déclaré ne doit pas être confondue avec une nouvelle exploration exhaustive indépendante : l’exploration de l’image complète appartient à `measure`. Le résultat contient les correspondances par modèle, les fenêtres couvertes, les contre-exemples éventuels, le nombre de pixels comparés et le nombre de visites du budget.

Pour chaque modèle, `exact_candidates` s’arrête au premier pixel différent d’une fenêtre. Une égalité déclarée par relation de palette est couverte au niveau du noyau, sans être utilisée comme loi implicite dans la branche V6. Les gardes de photo, de scène, de film et de référence ne sont comparées à un état courant que lorsque cet état fait partie de la requête, conformément à la source.

Les cas de refus conservent modèle absent ou dupliqué, signature incorrecte, domaine d’entrée incomplet, photo manquante ou non unique, contenu non admissible, référence absente, fenêtre hors image, loi d’égalité inconnue, relation de palette absente, identités de fenêtre dupliquées et révisions incompatibles. Un domaine de fenêtres vide peut retourner un calcul complet sans correspondance ; cette propriété du calcul fini ne devient pas une proposition de point, puisque la mesure V6 exige une fenêtre unique.

Les bornes de nœuds, de temps et de domaine, ainsi que la reprise d’un préfixe de modèles déjà entièrement calculés, sont vérifiées. La reprise exige le même digest d’entrée hors bornes de calcul et le même préfixe ordonné de modèles. Elle redémarre le modèle inachevé ; aucun résultat de modèle partiel n’est annoncé comme complet.

### Exception originale et adaptation native nommée

L’oracle conserve une exception source dans le chemin d’interruption pendant la comparaison de pixels. `_compare_window` appelle `FrozenMap.overlay` avec un dictionnaire ordinaire comme argument de repli, alors que ce contrat attend un `FrozenMap`. Quatre cas de nœud ou de temps interrompus lèvent donc l’**`AttributeError: 'dict' object has no attribute '_data'`** originale. Une interruption avant l’entrée dans le modèle ou après son calcul peut, elle, produire le reçu prévu.

L’adaptation **`native_temporal_fragment_interrupted_pixel_frontier`** retourne dans le natif un résultat incomplet `NEEDS_EVIDENCE`, sans autoriser de primitive ni transformer l’interruption en impossibilité physique. L’exception originale reste publiée ; aucune égalité d’exception ou de reçu n’est revendiquée sur ces quatre cas. La reprise originale utilisée comme témoin est obtenue à la frontière réelle entre deux modèles, où l’original produit lui-même son reçu de frontière. La [préparation de l’oracle](lot3g-evidence/diagnostic/oracle-preparation-incident.json) conserve la découverte et la correction de l’hypothèse initiale du générateur.

Les dix autres opérations de la façade temporelle, telles que navigation, compilation, feedback ou portée de mémoire, ne sont pas transférées par ce lot. Les contrats numériques portables vérifiés ne couvrent pas toute la coercition Pydantic ou toute la sémantique Python.

## Proposition et garde courante

La branche propre peut proposer lorsque sa configuration est présente, que la limite de préfixe est vraie au sens Python, qu’`ACTION6` est disponible, qu’une scène unique est mesurée et que l’essai courant n’est pas bloqué. L’enveloppe commune exige séparément des actions restantes positives et une échéance courante. Les limites propres zéro et négative sont conservées comme cas de composant : zéro supprime l’offre propre, une valeur négative reste vraie dans cette condition source. Elles ne constituent pas une autorisation commune de dépasser un budget.

Le point est calculé au centre entier de la fenêtre actuellement mesurée, avec les décalages du cadre de recherche. L’action ne contient aucune coordonnée héritée d’un ancien niveau. Le plan conserve l’époque, le score, la référence d’observation, le digest de l’image entière, les boîtes, la fenêtre, le point et le certificat. Le résultat d’égalité est descriptif ; la proposition garde explicitement ouvertes les hypothèses de référence et d’utilité du pointage.

La garde propre avant l’action exige l’index zéro, la même époque, le même score et la même référence d’observation, le même digest de toute l’image, la disponibilité du pointage, puis l’égalité de la liste d’actions et de celle du bundle avec le point du plan. Une variation de pixel extérieure aux cadres suffit donc à invalider **cette garde de continuation**, même si une nouvelle mesure de scène pourrait encore être admise.

La garde propre ne recalcule pas l’identité de proposition, le certificat, le digest de référence ni la position du point depuis toute la scène. Elle ne compare pas non plus séparément l’action stockée dans le plan ou celle du pas. Une réécriture cohérente du point et des deux listes d’actions peut rester admise par cette fonction isolée. Ces cas contraires sont conservés. Ils n’autorisent pas à présenter la garde propre comme une authentification complète du plan : les contrôles d’enveloppe, de connaissance, de domaine courant et d’autorisation de l’appelant restent distincts.

Après l’action, la source ferme systématiquement le préfixe et garde `matched: null`. Seule une augmentation du score officiel marque `official_progress`; un changement d’image ou d’époque sans augmentation du score ne suffit pas à le déclarer.

## Acquisition, blocage et restauration

L’acquisition propre conserve un événement `framed_window_response` : clé d’essai, époques avant/après, références d’observation, boîte de référence, fenêtre, point, commande réellement rendue, progrès officiel et changement canonique. Elle n’affirme pas que l’effet constitue une loi de transport ou de succès. L’acquisition originale appelle d’abord ses ancêtres ; l’oracle conserve leurs événements dans `expectedOriginal`, puis isole les événements propres dans `expectedOwnEvents`. Le propriétaire commun natif traite ses couches dans leur ordre déclaré, sans acquérir le retour deux fois.

Un retour sans progrès ajoute la clé d’essai à `window_blocked`. Cette clé dépend de **l’époque, de tous les pixels courants et des fenêtres mesurées**. Une nouvelle référence d’observation ou une augmentation de score à époque et image identiques ne retire pas ce blocage. Une nouvelle époque ou une image différente produit une autre clé et peut permettre un nouvel essai. Cette portée exacte reste locale ; un pixel modifié ailleurs ne prouve pas une nouvelle loi et peut néanmoins créer une nouvelle clé selon la source. Un retour avec progrès n’ajoute pas de blocage.

L’original peut conserver plusieurs événements identiques et plusieurs occurrences d’une même clé bloquée. La prévention d’une double acquisition réelle relève du propriétaire commun, pas d’une déduplication inventée dans la couche propre. Les producteurs natifs émettent des événements JSON complets. Le rejet atomique des événements malformés relève du contrat natif de conservation ; il ne doit pas être présenté comme une égalité avec une mutation partielle source précédant un `KeyError`.

La restauration originale reconstruit une nouvelle mémoire à partir des événements et compare son digest avant de remplacer le propriétaire courant. Les cinq cas de restauration couvrent journal vide, retour négatif, retour positif, séquence mixte et digest corrompu. Le digest du parent `RootedQuotaAccess` est fourni séparément comme frontière opaque dans l’oracle propre. Cette comparaison ne démontre pas une parité complète de tous les ancêtres ou de l’appelant Python.

## Point mesuré dans l’enveloppe commune

`common_framed_window.window_propose` ajoute au premier pas la portée `expected_before` et un support de point mesuré : époque, observation, image, palette au point, boîte projetée, digest des pixels projetés, référence d’entité et signature. Le support reste lié à la vue courante et à sa référence, avec la qualification d’hypothèse conservée.

Le `bind` original vérifie l’appartenance du couple époque/image au domaine puis compare les points des supports et des actions sur les paires produites par `zip`. Il copie le support dans `point_binding`. Il ne remesure pas la palette ou le rectangle et ne garantit pas, à lui seul, l’égalité de longueur des listes. Le témoin d’une action supplémentaire hors du `zip` conserve cette limite. Les validations complètes du domaine et des listes restent des obligations de l’appelant commun.

Le natif possède cette couche dans SharedSeries, entre RootedQuota et OccludedCatalogue selon la hiérarchie consommée. La compatibilité avec les états publiés avant cette couche reste une exigence d’intégration séparée ; une couche native sans acquisition ne doit pas changer les anciens états simplement parce que sa classe existe. La mémoire propre du composant, le digest commun et les certificats de travail ne sont pas confondus avec une nouvelle preuve d’autorité.

## Preuves indépendantes et portée publique

La [fixture](../../tests/fixtures/v6-framed-window-reference.json.gz) contient **68 cas propres**, **24 gardes**, **neuf exceptions propres**, **43 cas de noyau**, **cinq restaurations** et **deux chaînes froides**. Les chaînes froides partent d’une mémoire vide, calculent leur proposition originale, acquièrent leur retour puis reconstruisent l’état ; aucun état natif attendu ne prépare ces calculs.

Les horloges de contrat sont fournies extérieurement : `perf_counter` et `monotonic` source sont exprimés en secondes, les arguments natifs en millisecondes. Les cas de temps interrompu consignent leur suite de ticks. Ces horloges déterministes ne mesurent aucune durée physique et ne remplacent pas la fenêtre officielle de coût. La borne de certificat source est maintenue entre 1 et 300 000 millisecondes ; avec cette horloge fixe, une échéance déjà dépassée peut encore produire le minimum d’une milliseconde. Les obligations d’échéance de l’appelant natif restent distinctes.

Le [scan initial](lot3g-evidence/diagnostic/framed-window-public-admission.json) applique uniquement la mesure originale à **96 images initiales publiques archivées**, après exclusion préalable de CWSE, SK48, FOGW et VOIS. **Aucun candidat n’est admis**, avec zéro exception source. Cela ne constitue ni une impossibilité de la capacité ni un résultat sur des vues ultérieures.

Le [plan complémentaire préalable](lot3g-evidence/diagnostic/retained-public-scan-plan.json) retient une trace par jeu, choisie par taille compressée puis chemin, et au plus 40 vues canoniques uniques réparties déterministement dans sa séquence. Le [diagnostic obtenu](lot3g-evidence/diagnostic/retained-public-admission.json) mesure **909 vues sur 30 traces**, sans erreur source : **11 vues sont admises**, une dans LF52, quatre dans RSWP et six dans TR87. Les vues non admises et les vues omises par la borne restent comptées séparément. Les traces et leurs empreintes restent inchangées. Ce diagnostic consomme seulement `packet.frame_rows`, jamais les animations, commandes, propositions ou états appris ; il n’exécute aucun jeu et ne sélectionne pas de nouveau cas. Une admission structurelle n’est ni une proposition effectivement sélectionnée par l’appelant commun, ni une contribution acquise, ni un niveau résolu.

Un [complément distinct sur ces mêmes onze vues, conservé en gzip](lot3g-evidence/diagnostic/retained-public-command-comparison.json.gz) construit ensuite les propositions propres et communes originales depuis des mémoires vides, avec les métadonnées publiques courantes et la politique de fenêtres originale. Le [restaurateur borné](lot3g-evidence/restore-public-command-comparison.py) reconstruit le JSON original à l’octet près selon son [reçu de transport](lot3g-evidence/public-command-comparison-transport.json), sans refaire l’analyse et sans écraser un fichier existant divergent. Une action de diagnostic reste disponible et l’horloge de contrat fournit la même allocation déterministe que l’oracle ; aucune durée historique de campagne n’est supposée. Les cinq propositions propres concordent avec leur enveloppe commune. Elles diffèrent toutes de la commande suivante déjà archivée. Les six vues TR87 n’offrent pas `ACTION6` et ne produisent donc aucune proposition propre ou commune.

| Jeu | Admissions géométriques | Propositions propres et communes | Commande suivante identique | Dernier paquet | Commande différente | Absence de proposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| LF52 | 1 | 1 | 0 | 0 | 1 | 0 |
| RSWP | 4 | 4 | 0 | 0 | 4 | 0 |
| TR87 | 6 | 0 | 0 | 0 | 0 | 6 |

Ce complément ne lit aucun plan historique pour produire les propositions. La règle préalable exigeait l’égalité exacte avec la commande suivante avant de présenter son retour public à `record`. **Aucune acquisition n’a donc eu lieu**, et aucune comparaison de restauration contre une mémoire vide n’est exercée sur ces retours. Les zéros correspondants du reçu ont un dénominateur nul et ne constituent pas des résultats positifs de restauration. Le [script distinct](lot3g-evidence/diagnostic/compare-retained-public-commands.py) conserve la branche conditionnelle et les motifs de chaque exclusion ; ses onze cas, les trois traces sources et les 1 786 originaux restent vérifiés. Ce corpus n’établit pas de contribution réelle de la nouvelle capacité.

Les tests, preuves de contribution communes, régressions, éventuelles campagnes et coûts de livraison doivent garder leurs reçus distincts. Une preuve intégrée synthétique établit un contrat et l’effet de sa mémoire ; elle ne peut être présentée comme une nouvelle victoire de jeu. Le raccordement de cette entrée ne clôt ni les dépendances héritées ni la migration complète.

## Reproduction de l’oracle

```bash
python -B scripts/export-v6-framed-window-reference.py
```

Le script exporte les résultats des méthodes originales, vérifie leurs empreintes avant/après et compresse la fixture avec `mtime=0`. Les sources, données de jeu et décisions natives ne sont pas modifiées. Le [reçu d’export](lot3g-evidence/diagnostic/source-oracle-export.json) identifie le générateur et la fixture exacts.
