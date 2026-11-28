# Banc du moteur commun P05 et composeur · 703cd1c3

Moteur `703cd1c32704171bae8e12a33a446bd6486fc288`, arbre `src` `fe6e22425293b31bf01cc447edc9d06a0ddab3b3`. La référence historique précédente est `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`, l'assemblage des 98 lignes. Les 11 chemins moteur modifiés depuis cette référence proviennent des quatre sources suivantes.

| Source | Apport présent sur le moteur commun |
|---|---|
| `09b9a509` | Trois blobs de l'activation locale du quota P05. Les trois autres fichiers du lot sont repris avec leur version enfant. |
| `c515ea14` | Deux blobs du composeur de pression et de son raccord. |
| `40f140f8` | Raccord au contact du passage apparié. |
| `162e4550` | Cinq blobs de l'enfant P05, de sa clôture et de la consommation du retour. |

Les reçus natifs ciblés distinguent trois effets. Le contact apparié modifie réellement son action en cas d'abstention sur PORT. L'enfant de G50T ajoute d'abord une preuve au reçu en conservant l'action. La reprise SS05 exerce la composition de réserve sur le jeu officiel. Les contrôles isolés donnent les références à reconstituer. [Contact PORT](sic-banc-p05-contact-40f140f8.md) · [Enfant G50T](sic-banc-p05-enfant-162e4550.md) · [Pression SS05](sic-banc-pressure-composer-c515ea14.md)

Le transfert du parent de pression sur DC22 N4 et sa clôture T14 font l'objet d'un lot distinct. La campagne historique retrouve les six niveaux et 630 commandes du parcours ordinaire de DC22. Au N4, son reçu enregistre le clic ACTION6 P05 au T14, avec 41 pixels modifiés, puis le déplacement ACTION2 P07 au T15. Il atteste la succession, ses effets et le nombre de preuves.

Le contrôle séparé `9e96585a` rejoue `c515ea14` jusqu'à N4, avec le même blob du fournisseur de support que `703cd1c3`. Les 187 effets du témoin et ses quatre empreintes de trajectoire se raccordent au préfixe des reçus historiques. Retirer seulement la citation r126 de `phaseMemory.refs` conserve l'offre de traversée. L'observation courante réintroduit r126 dans les références de l'offre.

Rouvrir le dernier cycle à géométrie et `lastRef` identiques conserve les 125 premières commandes. Le premier écart est au **N4/T15, geste global 126**. Le service remplace ACTION2 par **ACTION6 (56,28)** et joue ce ticket. Le retour `support_phase_measured` laisse le cycle ouvert. Le témoin gagne N4 en 76 gestes. Le bras rouvert s'arrête à 92 gestes, avec trois niveaux gagnés. La clôture du cycle conditionne donc la traversée à cette observation. Ce constat porte sur le fait `closed` déjà mémorisé par le fournisseur. [Contre-épreuve et protocole](https://github.com/yannick-fontan-1981/sra-playground/blob/9e96585ac3d6c7bcc450e173592211238cdc0ee0/docs/diagnostics/sic-dc22-phased-obligations.md) · [Reçu compact](https://github.com/yannick-fontan-1981/sra-playground/blob/9e96585ac3d6c7bcc450e173592211238cdc0ee0/docs/diagnostics/sic-dc22-phased-obligations-receipt.json)

## Témoins sur le SHA commun

| Épreuve | Verdict sur 703cd1c3 |
|---|---|
| PORT officiel en SIC | 116 décisions, 844 événements identiques à `86e0f172` au quota local 1. Contacts confirmés au N4/T7 et au N6/T6. Au quota 0, premier écart N4/T7 événement 454, `/value/family`. `sic_paired_passage` laisse place à `sic_cavity_access`, ACTION4 devient ACTION1 et le vrai paquet diffère. |
| G50T en SIC, enfant typé | 16 décisions jouées et 17 observations identiques à `09b9a509`. Premier écart N1/T1 événement 5, `/value/controlEffectChild`. Le T5 remesure `[6,0]` depuis r5 et le T6 consomme la preuve r6 sous P07. Quatre enfants clos avec translation, deux indéterminés. Substituer r3 à r5 retire l'acquisition à retour physique identique. Premier écart de cette intervention au N1/T5, événement 54. Le T6 joue ACTION3/P05. Le faux couple destination-vecteur est refusé. |
| SS05, reprise de réserve | 32 gestes puis gain du niveau. Mêmes commandes et projections que `0aef4289`. Le retrait de la fermeture et la projection contredite donnent les refus attendus. |

Les 39 tests ciblés du Banc passent sur ce SHA. Les reçus détaillés sont locaux. L'index donne leurs empreintes et les champs des premières divergences. [Index des témoins](sic-coexistence-703cd1c3/temoins.json)

L'opérateur a vérifié indépendamment les six départs scellés, 62 gestes, sur ce même SHA. Son contrôle du contact porte sur deux géométries construites. À quota nul, ces terrains s'arrêtent sans ticket de contact. Le PORT officiel du Banc joue un ticket de repli au même point du raisonnement. [Verdict opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/8632ad43de237cdca80debf1a2508b4aa71b3aa1/experiments/symbolic-situations/assemblage-cycle-1/BILAN.md)

Rejouer depuis le Banc avec Node 24.22.3, quatre checkouts propres et un dossier neuf `$out`. `$b` contient le moteur commun, `$aPassage` contient `86e0f172`, `$aP05` contient `09b9a509` et `$a98` contient `0aef4289`.

```powershell
$sha = '703cd1c32704171bae8e12a33a446bd6486fc288'
$case = 'docs/diagnostics/sic-banc-p05-contact-40f140f8/attendus.json'
node scripts/sic-p05-contact-native.mjs $aPassage $b 86e0f172bfd4f743bccd985a57ce1811001a6d7e $sha $case "$out/contact"
node scripts/sic-p05-child-native.mjs $aP05 $b 09b9a509e5e07894b9fccf170f22ae26cbeffbda $sha "$out/child"
py -3.11 scripts/test-sic-pressure-composer-port.py $a98 $b $sha "$out/pressure" --one
```

## Campagne historique

Le run unique `46117920929` part du N1 sur le catalogue figé, mode SIC, un travailleur par partie, graine et plafonds historiques. L'option expérimentale d'activation P05 est absente du lanceur de cette campagne. Le commit `3b79cfcfda680a2e71f1f5e825d6bca88d384bbd` ajoute seulement le workflow, avec 24 lots dont les jeux s'exécutent en série. [Run GitHub](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46117920929)

**107/107 jeux complets, 692 niveaux, 18 560 commandes.** La comparaison n'a trouvé aucun écart sur les champs des trajectoires, effets, résultats et arrêts contrôlés, contre le gel ni contre le moteur des 98. La campagne a duré **13 min 15 s**, avec un pic de 20 lots en rejeu. Les 50 fichiers de l'archive couvrent une seule tentative. La reprise importe 3 puis 104 reçus et retrouve ensuite les 107 sans nouveau traitement. [Archive](sic-coexistence-703cd1c3/recus.zip) · [Verdict par jeu](sic-coexistence-703cd1c3/qualification.json) · [Horaires](sic-coexistence-703cd1c3/horaires.json)

**Graphe brut.** Face au gel et face à `0aef4289`, les 692 empreintes `levelStats.graph` diffèrent sur 692. Sur chaque niveau, `prefixHash` et les compteurs de nœuds, deltas, acquisitions, événements de trace et opérations par phase concordent. La chaîne brute inclut le champ horodaté `created` du journal de raisonnement. Les reçus publics ne suffisent pas à attribuer chaque différence de chaîne à ce seul champ. Les comparaisons précises du raisonnement actif sont celles des témoins ci-dessus. [Portée constatée au jalon précédent](sic-coexistence-0aef4289.md#campagne-historique)

Depuis le Banc, l'audit rattache chaque reçu au SHA, au workflow, aux plafonds et à l'empreinte de son lot.

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-703cd1c3/recus.zip --candidate 703cd1c32704171bae8e12a33a446bd6486fc288 --workflow 3b79cfcfda680a2e71f1f5e825d6bca88d384bbd --run 46117920929
```

Pour vérifier la reprise, utiliser un répertoire de téléchargement neuf `$download` et le même répertoire `$state` sur les trois imports.

```powershell
gh run download 46117920929 --dir $download
foreach ($groupe in 'initial','all','all') {
  py -3.11 scripts/sic-qualification-progressive.py import-ci --candidate 703cd1c32704171bae8e12a33a446bd6486fc288 --download $download --state $state --workflow 3b79cfcfda680a2e71f1f5e825d6bca88d384bbd --run-id 46117920929 --games $groupe
}
```

La branche `main` distante est restée à `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.

## Complément expérimental · b0574d0d

`b0574d0d45d3253c38fd6a72e52074874b6a0da6` a pour parents `703cd1c3` et `3047ef55`. Son arbre `src` est `dad4f968ca4df71755ac143f39cb806062d7af45`. Le diff moteur comprend exactement deux fichiers. Les blobs de `v6-sliding-cavity.ts` (`300894dc4f20f7c7acb3617d863eb117e625cf59`) et `control-effect-next.ts` (`5bf2ca61bb93b595e3ed6b3fa9633768738dfe40`) sont identiques à ceux du lot `3047ef55`. [Dossier du départage isolé](sic-banc-p05-cavite-3047ef55.md)

Sur **AS66 officiel en V6**, le parent et l'assemblage concordent sur **84 événements et 7 décisions dans chacun des deux bras**. Au N2/T1, le nominal départage les deux offres de mêmes preuves et de coût 1 en faveur d'ACTION1. À la même observation et avec les mêmes commandes publiques, le retrait de la seule question ACTION1 fait jouer ACTION4. Le premier écart entre ces deux bras est l'événement **62**, champ `/value/actions/0/action_ref`. Le vrai retour modifie 82 pixels, établit `[0,1]`, puis le service joue ACTION2 et confirme l'accès. La campagne historique des 107 reste attachée à `703cd1c3`.

Depuis le Banc avec Node 24.22.3, `$a` désigne le checkout propre de `703cd1c3` et `$b` celui de `b0574d0d`. Le reçu détaillé reste dans le nouveau dossier local `$out`.

```powershell
node scripts/sic-p05-cavity-native.mjs $a $b 703cd1c32704171bae8e12a33a446bd6486fc288 b0574d0d45d3253c38fd6a72e52074874b6a0da6 $out
```
