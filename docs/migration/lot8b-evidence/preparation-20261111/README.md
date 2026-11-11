# Préparation source du lot 8B

Cette reconnaissance confirme le périmètre demandé : **`parallel_branch_routing` reste `pending`, sans famille native enregistrée**. Elle ne raccorde aucune entrée et ne change aucun total. Les fichiers lus et leurs empreintes sont consignés dans [source-inventory.json](source-inventory.json), au commit observé `7c8f43365a277406e95c898165d01a7bf6e19772`. La feuille de route a été actualisée ensuite ; son empreinte dans cet inventaire désigne cet instantané Git, tandis que les sources génériques et natives restent identiques. Il n’y a eu ni exécution native, ni oracle, ni jeu, ni test ; aucun payload, jeu ou oracle du cas fermé LKEY n’a été consulté.

## Propriétaire et dépendances

Le propriétaire original est **`BranchRouting`**, dans `common_branch_routing.py`, instancié comme `strategy_router.branches`. Sa proposition a le type `parallel_branch_routing` et porte `branch_plan`. Le caller sélectionne ce propriétaire pour les gardes et l’acquisition, écrit ses retours sous `branches:<revision>` et expose son diagnostic sous `branch_routing`.

Le composant possède cinq fonctions géométriques (`layout`, `bbox`, `read_state`, `observed_state`, `propagated`) et les six méthodes `__init__`, `propose`, `bind`, `before`, `after`, `record`. Ses seules fonctions externes importées sont `digest`, `projection` et `rows_digest` du module générique `common_multiscale_constraints.py`. Leur port doit conserver l’encodage Python des clés/digests, les projections et les octets uint8. Le helper natif `motifRowsDigest` constitue un candidat de réemploi à qualifier ; son nom n’autorise pas à partager l’état de MotifAccess.

`motion`, `passed` et `events` survivent aux changements d’époque. `model`, `current`, `verified`, `seen`, `refs` et `finished` sont renouvelés par la première proposition de la nouvelle époque. L’état froid original ne possède encore que `epoch`, `motion`, `passed` et `events`. Un checkpoint natif devra documenter cet écart éventuel de représentation et conserver la restauration atomique.

## Point de raccordement proposé

La stratégie originale place cette entrée dans **`factored_material_return`, immédiatement après `motif_conditioned_access` et avant `conserved_band_transfer`**. L’adaptateur actuel de MotifAccess dans `v6-native-runtime.ts` fournit le modèle de raccordement : un propriétaire distinct, l’enveloppe `originalEventFamily`, puis `subquestionFamily` portant `material_access_subquestion`.

L’identifiant natif proposé est `branch_routing`, à figer dans le contrat avant implémentation. Il devra être enregistré dans `families`, à sa position exacte dans `groupMembers.factored_material_return`, dans le mapping d’acquisition sélectionnée (`branches`), et dans l’audit des entrées. La position de `materialEntryPoints` doit être **`null` pour ce propriétaire direct**, afin d’éviter une seconde entrée concurrente du caller. Le programme existant `v6.composition_strategy.choose` suffit ; aucun nouveau workflow n’est justifié par cette lecture. Aucun de ces changements n’a été effectué.

## Premières preuves indépendantes

1. **Composant original froid.** Construire des rasters synthétiques génériques pour cavités ouvertes, capuchons de sources, barres et sélection unique ; comparer intégralement géométrie, états et propositions. Couvrir les modes `calibrate`, `select`, `move`, `propagate`, les ambiguïtés d’identité, les égalités de coût et les sorties hors champ. Les observations doivent être mesurées, sans état natif injecté dans l’original.
2. **Boucle commune.** Capturer calibration, sélection, préfixe de mouvement gardé et essai de propagation, puis acquérir chaque retour une seule fois. Ajouter un déplacement contraire, une sélection devenue ambiguë et une frontière d’époque ; démontrer restauration de la méthode et renouvellement de l’autorité courante. La réussite géométrique reste une hypothèse tant qu’aucun résultat officiel n’est fourni.
3. **Bornes distinctes de la parité.** Comparer l’énumération complète dans un petit domaine déclaré, puis qualifier séparément les refus pour interruption, échéance ou borne. Aucun meilleur candidat partiel ne doit être présenté comme optimum source lorsque l’énumération reste incomplète.
4. **Intégration et clôture.** Vérifier ordre de sélection, propriétaire unique, clé mémoire et checkpoint ; ensuite seulement rejouer les régressions, préparer les preuves de travail/graphes, puis mesurer le coût officiel contre un prédécesseur réellement publié.

## Points à préserver ou à qualifier explicitement

Les produits cartésiens de `observed_state` et de la recherche des positions sont sans borne explicite dans l’original. La recherche collecte toutes les solutions avant le minimum : les limites et l’ordre lexicographique exigent donc un contrat prospectif.

La géométrie utilise des coordonnées absolues modulo l’unité : une invariance à toute translation serait une affirmation supplémentaire. Quatre vecteurs de mouvement distincts rendent la source « prête », sans démontrer qu’ils sont les quatre déplacements unitaires attendus. Les obligations hors champ restent conditionnelles au résultat officiel. Enfin, un retour augmentant le score est traité avant l’ajout d’un événement ordinaire, et `remaining` borne directement les préfixes `move`, pas tous les modes : le port doit conserver ces branches tout en respectant l’admission physique du caller.

**Prochaine action concrète :** écrire le contrat de transfert 8B et un exporteur original limité au composant générique et aux petites fixtures déclarées, avant tout raccordement natif. Cette préparation ne prouve encore aucune parité, aucun niveau réussi ni aucun coût.
