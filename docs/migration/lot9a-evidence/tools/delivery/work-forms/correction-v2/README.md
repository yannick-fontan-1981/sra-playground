# Correction bornée du lecteur des formes de travail — v2

## Motif et périmètre

Le premier lecteur `work-qualify-01` a terminé en échec conservé après
50,551226686999144 secondes. Ses 28 279 différences comprennent exactement
58 écarts non attribués, tous sur le chemin complet
`/whyAct/decision/total_ms`. Les quatre formes sont conservées, ainsi que
les rapports, différences compressées, journal et reçu du premier essai.

Cette correction dérive exclusivement le lecteur. Elle ne modifie ni les
sources natives, ni le générateur de capture, ni les captures, ni les outils
v1 gelés. Le nouveau lecteur exige les empreintes originales des deux
captures et des quatre fichiers d’échec. Les sept arguments restent dans
le même ordre. Les sorties du deuxième essai doivent être nouvelles.

## Règle ajoutée

Le producteur est précisément `NativeSrcBridge.run`, dans
`v6-composition-engine.ts`. Son horloge par défaut est `performance.now`.
`NativeCompositionAuthority` construit ce bridge sans option d’horloge,
conserve le rapport de libération dans `lastRelease` et le publie dans
`snapshot().decision`, exposé comme `whyAct.decision`.

`NativeEngine.persist` copie d’abord le rapport dans une trace
`src_decision`. Le bridge ajoute ensuite `total_ms` en soustrayant ses
lectures d’horloge. Le lecteur v2 fixe les empreintes de ces producteurs,
de la mémoire qui copie le rapport et du générateur qui observe les
horloges réelles sans les remplacer. Les deux rôles doivent avoir les
mêmes sources communes, également liées à leurs inventaires natifs.

Pour chaque point retenu, le lecteur v2 vérifie les conditions suivantes :

1. Le rapport est complet, terminé et décrit une libération d’actions.
   Le dernier événement `why_act_release` appartient au graphe validé du
   rôle. Sa révision correspond à celle du lot d’actions dans le rapport.
2. Un nouveau rapport ne peut apparaître que pendant `init` ou `resume`
   dans les formes gelées. Sa chaîne de libération doit être un delta du
   même appel `service.handle`.
3. Ce même appel doit contenir une seule nouvelle trace `src_decision`
   dont le corps entier égale le rapport avant ajout de `total_ms`.
   Cette trace a la révision 1 et précède la chaîne de libération. Sa date
   de création conserve les contrôles v1 liés à l’intervalle réel de
   `Date.now`.
4. La nouvelle durée est finie, positive ou nulle et inférieure ou égale
   à chacun des deux intervalles déjà capturés : durée monotone du handle
   et croissance du compteur de temps actif pendant ce handle.
5. Sur `advance` et `inspect`, la note de libération et le rapport entier
   doivent rester strictement identiques à leur création, `total_ms`
   inclus. L’intervalle du point de réutilisation ne sert pas à borner à
   nouveau une durée ancienne.

Une fois ces preuves établies pour les deux rôles, la seule attribution
nouvelle est `attributed_bounded_release_report_duration`, sur le chemin
exact `/whyAct/decision/total_ms`. Toutes les autres feuilles des rapports,
décisions, propositions et snapshots restent comparées. Les valeurs
brutes, les empreintes complètes et la preuve de création/rétention sont
conservées dans le rapport et dans les différences.

La durée de création est **bornée**, pas recalculée : les deux timestamps
internes du bridge n’ont pas été capturés séparément. Aucun timestamp
synthétique, arrondi comparatif ou remplacement d’horloge n’est introduit.
Ces contrôles fonctionnels ne constituent pas une mesure officielle de
performance.

## Sources et conservation

`producer-proof.json` contient les empreintes des sources et les extraits
précis du producteur. `provenance.json` lie le v2 au lecteur v1 gelé, aux
preuves de l’échec, aux captures originales et au diff distinct
`qualify-cost-owner-graphs-v2.diff`. Les imports et la racine du lecteur
ont seulement été décalés d’un niveau pour son nouveau sous-répertoire.

Le contrôle local `node --check` est uniquement syntaxique et ne charge
aucun module importé. Aucun lecteur fonctionnel, moteur, oracle, capture,
jeu, test natif ou publication n’est exécuté pour préparer ce dérivé.

## Exécution déclarée suivante

Le parent doit d’abord figer l’amendement prospectif et les empreintes du
v2 après revue indépendante. Le deuxième lecteur reste sous le budget
existant `work-qualify`, sans nouvelle catégorie : 2 essais au maximum,
600 secondes cumulées et 300 secondes au maximum par essai. Le premier
essai a consommé 50,551226686999144 secondes ; il reste un essai et
549,448773313000856 secondes cumulées, toujours limité à 300 secondes
pour cet essai. Le deuxième essai consomme zéro session et zéro retour.

Arguments du lecteur, depuis la racine du checkout :

```sh
node --max-old-space-size=1536 \
  docs/migration/lot9a-evidence/tools/delivery/work-forms/correction-v2/qualify-cost-owner-graphs-v2.mjs \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-inventory-01/owner-source-inventory.json \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-baseline-01/baseline.json.gz \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-baseline-01/baseline.receipt.json \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-candidate-01/candidate.json.gz \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-candidate-01/candidate.receipt.json \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-qualify-02/graph-review.json \
  docs/migration/lot9a-evidence/delivery-final-068-01/work-qualify-02/work-forms.json
```

Cette commande doit passer par le superviseur et son plan amendé. Sa
présence ici ne constitue pas une exécution ni un résultat de qualification.
