# Qualification conjointe · résultats sur les témoins connus

**Réserve préenregistrée : 10 succès sur 10 pour le lecteur `2c8168f2e1df1eaa6961c0f39a473ffdf0cde147` en v1.1.** Les dix fiches de départ sont admises et les dix parcours correspondent aux politiques minimales du manifeste. Les 32 commandes proposées sont exécutées. L'opérateur rend 14 confirmations matérielles déclarées, 8 valeurs de lecture et 10 verdicts de succès. Chaque lecture est suivie d'une commande. Les quatre paires divergent pour la première fois à un retour de lecture. Aucun abandon, refus de commande ou incident technique.

L'opérateur a régénéré le manifeste v1, vérifié son engagement `105658d2693f9d66d03c9460b3d447b829822d3138d8af661fe5e03a389836bd`, puis soumis les fiches au relais figé. L'identité Git, les huit blobs montés et les empreintes des messages initiaux ont été vérifiés. Le reçu de réserve a pour SHA-256 `7b32a5778c0385ea7e9eb31a7b73fd4a6812cd9b92a482b817ebdba6eaf122c7`. Il s'agit d'une mesure de l'opérateur après gel du consommateur.

Le [relais](PROTOCOLE.md) est figé à `37220539341f8d5951382325bed4eecb8661d684`. Chaque gel d'attribution a reçu 51 départs en v1, dont deux dialogues X. Les colonnes de jeux comptent les succès physiques. Les colonnes X comptent la réponse justifiée au retour reçu.

| Solveur et format | A | B | C | Deux familles, développement | Deux familles, anciens témoins | Structure, huit témoins | X1 valide | X2 étranger |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Historique `f296ac1c`, v1 | 0/2 | 0/1 | 2/2 | 18/18 | 18/18 | 0/8 | 0/1 | 0/1 |
| A `6191afee`, v1 | 2/2 | 0/1 | 2/2 | 18/18 | 18/18 | 0/8 | 0/1 | 0/1 |
| B `ba2d1e7f`, v1 | 0/2 | 1/1 | 2/2 | 18/18 | 18/18 | 0/8 | 0/1 | 0/1 |
| A+B `615e2493`, v1 | 2/2 | 1/1 | 2/2 | 18/18 | 18/18 | 0/8 | 0/1 | 0/1 |
| Lecteur `2c8168f2`, v1 | 2/2 | 1/1 | 2/2 | 18/18 | 18/18 | 0/8 | 0/1 | 0/1 |
| Même lecteur, v1.1 | 2/2 | 1/1 | 2/2 | 0/18 | 0/18 | 0/8 | 1/1 | 1/1 |

Les deux rejeux du lecteur ont chacun admis 51/51 départs. Sur le v1 d'origine, les journaux sont identiques à A+B, premier écart inclus. Sur v1.1, les réductions A/B/C ont des confirmations déclarées, comme les huit témoins structurels et les dialogues X. Les 36 anciennes instances converties ont toutes leurs commandes matérielles en `undeclared`. Leur arrêt intervient au premier retour matériel sur 36/36 départs. Les deux données de contrôle sur X sont le bon accusé de P, suivi de `valider`, et le libellé de Q substitué sur le fil, suivi de `accusé structuré : unmatched`. Le reçu détaillé des 51 contrôles v1 a pour empreinte `b5c44a6f716a17c7f1a2a622d62a03af6f0132654b8a9583e299f09ebe8fd30d`, celui des 51 contrôles v1.1 `6a8ed2f87c75cede3516eb8daef98a02f11cfc88ec3bc7b3e24f5ec05e2da399`.

**Premiers écarts du lecteur en v1.1.** Sur quatre départs structurels à butée libre, le solveur s'arrête dès la fiche avec `aucune continuation justifiée dans l’horizon 10`. Sur les quatre autres, il exécute l'indexation, reçoit `indexé`, puis donne ce même motif. Le libellé est déclaré et l'exécution confirmée. Sa couverture d'effet est `unknown` car les écritures de la fiche sont conditionnelles.

| Reproduction publique à deux commandes | Premier écart effectivement rejoué avec le lecteur |
| --- | --- |
| [Accusé absent](exemples/absent.json) | Après le geste, arrêt `accusé structuré : undeclared`. |
| [Confirmation à couverture inconnue](exemples/couverture.json) | Après le geste confirmé, arrêt de planification au tour 1. |
| [Condition conjointe](exemples/conjonction.json) | Arrêt de planification au tour 0 dans les deux mondes. En retirant de la garde le prérequis déjà connu et exigé par la commande, le même lecteur réussit 2/2 en deux gestes. |

L'énumération indépendante donne deux gestes pour chacune des quatre exécutions des trois petites fiches. Le contrôle de conjonction isole une différence de formulation sur cette reproduction. Les deux divergences X propres au v1 ont leurs dialogues publics dans le [reçu précédent](../accuses/RECU.md). [Génération et rejeu des trois exemples](ecarts.mjs)

**Premiers écarts.** Sur la réduction A, l'historique et B s'arrêtent avant la première commande, A et A+B indexent puis relisent. Sur la réduction B, l'historique et A s'arrêtent au retour `indexé`, B et A+B valident. Dans chacun des quatre gels, quatre témoins structurels s'arrêtent avant le premier geste et quatre après le retour `indexé`. Dans X1 tous s'arrêtent au bon accusé. Dans X2 tous valident après le libellé étranger. La commande initiale de P avait réussi physiquement dans ce dernier essai.

**Audit du message.** Chaque fiche v1.1 se projette à l'identique sur sa fiche v1. Les quatre fiches structurelles, deux mondes chacune, déclarent toutes les deux commandes d'indexation et les deux d'ouverture. Les règles correspondantes portent une condition. Le relais publie la confirmation avec couverture inconnue et conserve les règles conditionnelles. Le contrôle sur 288 couples état–commande vérifie chaque retour physique, refus, lecture et verdict terminal. Les 24 fiches des deux anciennes partitions ne donnent aucun libellé de confirmation matérielle. Le relais laisse ces déclarations absentes. X1 et X2 présentent exactement la même fiche v1.1.

Le parcours manuel d'A a été rejoué dans deux mondes et repris après chacune des deux valeurs de lecture. Un processus témoin a attesté l'empreinte des deux premiers messages reçus, l'absence de la variable sentinelle de l'opérateur et le refus de lecture hors de son montage. [Rejeu](PROTOCOLE.md)

Le validateur JSON Schema 2020-12 a accepté les 33 messages initiaux du relais. Sur les reçus réellement livrés à l'ancien gel, les deux familles produisent respectivement 44 retours matériels non déclarés en développement et 38 sur leurs anciens témoins. Chacune des deux partitions rend aussi 12 valeurs appartenant au domaine annoncé et 18 verdicts terminaux. Le classement intervient après le rejeu et ne change aucun retour. [Audit des libellés](auditer.mjs)
