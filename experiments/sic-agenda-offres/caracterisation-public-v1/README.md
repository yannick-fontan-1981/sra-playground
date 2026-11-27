# Qui choisit de marquer ou de lire ?

Au gel `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`, **la recherche choisit entre agir et observer** sur les deux cadrans de développement étudiés. La projection établit quelles actions sont applicables et ce qu’elles produisent. L’agenda reçoit les premières actions qui réalisent déjà le coût minimal calculé. Avec le cadran visible, son départage détermine encore **quelle case** marquer en premier.

| Étage de la décision | Sortie visible | Sortie masquée |
| --- | --- | --- |
| Admission du message | 8 commandes, 2 cases vierges, sortie X4c94cf observée | Mêmes commandes et déclarations, sortie inconnue |
| Projection au départ | Les 6 marquages et la lecture sont applicables. Valider donnerait un échec. | Même résultat |
| Recherche pour le besoin « réussir dans chaque situation compatible, en un minimum de gestes dans le pire cas » | Marquer avec X03a3e1 coûte 3 gestes, sur l’une ou l’autre case. Lire d’abord en coûte 4. Un autre tampon rend la validation inaccessible. | Lire coûte 4 gestes au pire. Un marquage effectué avant la lecture engage irréversiblement un tampon qui ne garantit pas la bonne sortie. |
| Offres qui contribuent au besoin transmis à l’Agenda | 2 marquages sur 7 offres applicables | 1 lecture sur 7 offres applicables |
| Arbitrage de l’Agenda | Égalité explicite. L’identifiant croissant fait marquer X022d46 avant Xfc26f3. | `lire` est la seule offre qui contribue. |

Le besoin opérationnel reçu par `Agenda.decide` est `objectif_au_moindre_cout`. Les décisions prématurées sont écartées à deux instants distincts. La projection refuse la validation des cases vierges. La recherche refuse d’attribuer la contribution minimale à un engagement incompatible avec une des sorties, même lorsque le geste est immédiatement jouable. Son calcul inclut chaque valeur révélable par la lecture. Dans ces deux cas le mode vaut `solving`, toutes les offres ont le même groupe et aucune ne porte de préférence de mode. [Projection et recherche du gel](../public-v1/planifier.mjs) · [Arbitrage](../agenda.mjs)

## Preuves et perturbations

Les fiches `dial-c939c746ea676bf167d6.json` et `dial.json` sont celles du jeu de développement `62af0801`. Le rejeu vérifie leur égalité intégrale après substitution de la seule observation `dial` et de sa ligne de provenance. Inverser la liste des commandes conserve la décision complète, les ex æquo et les compteurs sur les deux fiches.

Avec le but, les règles, les domaines et la liste des commandes fixés, chaque cas possède un seul ensemble minimal d’observations conservant la commande, son coût, ses finalistes et sa qualification. La réduction teste les sous-ensembles par inclusion.

| Cas | Observations décisives | Règles publiques utilisées pour l’interprétation |
| --- | --- | --- |
| Sortie visible | Les deux marques valent `null` (L7), le cadran indique X4c94cf (L11), cette sortie exige X03a3e1 (L9). | Marquer engage la case et contraint les marques suivantes (L15). La validation exige les deux marques du tampon demandé (L17). |
| Sortie masquée | Les deux marques valent `null` (L7). Les deux sorties exigent des tampons distincts, X03a3e1 et Xa16dcd (L9–10). | Le cadran a deux valeurs stables (L8). Une lecture les distingue (L16). Les mêmes règles de marquage et de validation s’appliquent. |

L’omission de l’observation `dial` laisse ici la même incertitude que son statut `unknown`. L’autre exigence de tampon est dispensable quand la sortie est connue. Les observations `available_stamp` ne sont nécessaires à aucune des deux décisions une fois le répertoire de commandes fixé. La sortie brute du consommateur cite **les neuf lignes** de la fiche pour chaque cas. Cette provenance globale ne fournit pas à elle seule les ensembles minimaux ci-dessus. [Reçu compact](recu.json)

## Budget à reproduire

| Mesure du premier choix | Sortie visible | Sortie masquée |
| --- | ---: | ---: |
| Premiers horizons essayés, en gestes | 1, 2, **3** | 1, 2, 3, **4** |
| États distincts visités, racine comprise | 20 | 28 |
| États distincts développés, racine comprise | 17 | 28 |
| Appels récursifs / dont réponses du cache | 66 / 9 | 106 / 22 |
| Appels à la projection d’une commande | 183 | 388 |

Un état est la paire formée par les valeurs des faits et les compteurs d’usage. Un état atteint à profondeur restante zéro compte comme visité. Un état développé a fait l’objet d’une recherche de successeur ou de la projection initiale à la racine. Un même état atteint à plusieurs profondeurs compte une fois dans ces deux lignes. Les appels récursifs et les projections comptent toutes les exécutions sur les horizons successifs. Les mesures portent sur le premier choix. Les réductions de preuves et les recherches où l’on impose un premier geste ont leurs propres exécutions, exclues des compteurs.

Pour un rejeu manuel dans ChatGPT, prendre deux cases vierges A et B, deux sorties fixes E et F, trois tampons R, S, T. E exige R et F exige S. Une fois marquée, une case est définitive et l’autre doit recevoir le même tampon. Une lecture indique la sortie. Valider termine et ne réussit que si les deux marques conviennent. Donner le premier geste garantissant la réussite en trois gestes quand E est connue, puis en quatre gestes au pire quand la sortie est cachée. Indiquer tous les premiers gestes également courts. Les ordres A puis B et B puis A sont ex æquo dans le premier cas.

## Contre-exemple conservé

Une variation du cadran masqué donne aux **deux sorties la même exigence** X03a3e1. Le fichier de variation conserve le fait avant/après, sa ligne publique et le plan témoin. Les conditions et le répertoire de commandes restent ceux de la fiche. [Variation rejouable](contre-exemple.json)

Le plan commun marque les deux cases avec X03a3e1 puis valide. Trois gestes sont nécessaires : chaque case est initialement vierge, chaque commande de marquage remplit une seule case et la validation est un geste distinct. Les deux instanciations du domaine public donnent `success` pour la même séquence.

Le gel choisit pourtant `lire` avec un horizon de **4**. Après les deux bonnes marques et avant toute lecture, chaque terme conditionné par une valeur particulière du cadran reste indéterminé dans `truth`. La projection de `valider` rend alors `effet conditionnel indéterminé`. La recherche ne certifie aucun chemin de trois gestes et attribue le coût quatre à la lecture et aux deux bons marquages. L’Agenda départage ensuite ces trois offres par identifiant. Le compteur d’actions surestime donc le minimum, avant l’arbitrage final. Le témoin établit une limite de planification sur une variation publique construite.

## Rejouer

Avec Node 24.22.3, depuis ce checkout, sous PowerShell :

```powershell
node experiments/sic-agenda-offres/caracterisation-public-v1/rejouer.mjs ../symbolic-public-format/experiments/symbolic-situations/public-format/examples
```

La commande ouvre exactement les deux fichiers de développement nommés. Elle vérifie les compteurs contre le reçu, les horizons immédiatement insuffisants, chaque projection et la variation. `--json` écrit le reçu compact sur la sortie standard. Le module d’instrumentation vérifie le blob Git du planificateur puis charge en mémoire une seconde copie munie de compteurs. Le choix mesuré doit être identique, champ par champ, à la sortie du module d’origine. L’arbitre réel est invoqué une seule fois par décision. [Compteurs](compter.mjs) · [Expériences](rejouer.mjs)

L’opérateur indépendant a communiqué un bilan agrégé de **18 succès sur 18 en réserve**, avec 68 commandes exécutées. Les six paires ont des préfixes identiques jusqu’à la lecture, puis divergent en fonction du retour. Ces chiffres attestent le comportement du consommateur entier sur ces départs. Sur les deux cas de développement instrumentés, l’anticipation des résultats et le choix d’observer dépendent de la projection et de la recherche. L’Agenda rend la contribution et les égalités visibles, puis résout l’égalité résiduelle. La caractérisation a utilisé les deux fiches publiques et leur variation.
