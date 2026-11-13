# Lot 9C1 — contrat borné de décision `joint_channels`

Date : 13 novembre 2026 (America/Recife)

Branche de travail : `recovery/lot9c1-bounded-joint-channels-20261113`

Base canonique : `d7ba12eef7063cf86dfa55f43879c29bc1dfa87d`

## Positionnement

L’audit 9C0 n’a admis aucune implémentation produit historique ni aucun contrat historique récupérable. Le présent lot ne prétend donc pas restaurer une sémantique ancienne. Il introduit un **premier contrat nouveau, borné et explicitement vérifiable**, compatible avec les garde-fous déjà établis : aucune priorité cachée, aucune fusion de propositions propriétaires incompatibles et aucune action inventée.

## Besoin couvert

Plusieurs canaux symboliques peuvent apporter des preuves différentes en faveur de la même action. Le caller commun ne doit cependant pas considérer ces contributions compatibles comme plusieurs propriétaires rivaux, car cela créerait une ambiguïté artificielle. Inversement, il ne doit jamais fusionner des contributions seulement parce que leurs noms ou leurs actions se ressemblent.

Le lot introduit un propriétaire interne `joint_channels_v1` qui représente plusieurs canaux comme **une seule proposition** uniquement lorsque leur compatibilité est démontrée.

## Contrat minimal

Une proposition jointe exige au moins deux canaux explicites et distincts. Chaque canal produit :

- une identité de canal stable ;
- une identité de contribution ;
- une référence de liaison `jointRef` ;
- une référence d’action ;
- un payload complet destiné à l’autorité native.

Les contributions ne sont jointes que si elles ont :

1. la même `jointRef` ;
2. la même référence d’action ;
3. la même session publique ;
4. la même révision d’observation ;
5. une action actuellement disponible ;
6. un contrat de libération natif exactement identique : action, bundle, état symbolique et identité d’observation.

Le champ de corrélation propre à chaque producteur n’est pas utilisé pour établir l’équivalence. Le propriétaire joint remplace cette corrélation par une enveloppe bornée contenant uniquement les identités des canaux et contributions réellement joints.

## États observables

- `none` : aucun canal ne contribue ;
- `incomplete` : un seul canal contribue ;
- `incompatible` : plusieurs canaux contribuent mais au moins une condition de jointure échoue ;
- `joint` : au moins deux canaux sont compatibles et une proposition unique peut être présentée au caller commun.

`incomplete` et `incompatible` ne produisent aucune action et aucun appel Logos.

## Chaîne causale démontrée

**Besoin identifié** : plusieurs canaux soutiennent une même action sans devenir artificiellement des propriétaires rivaux.

**Données produites** : contributions typées et liées à une révision publique.

**Appel justifié** : le propriétaire joint vérifie la compatibilité exacte, puis émet une seule proposition OP28.

**Résultat** : l’autorité native peut libérer le bundle admis.

**Consommateur** : `CommonCampaignOwner`, puis `V6CommonCampaignDecisionPort`.

**Effet sur la décision** : avec deux canaux compatibles, l’action atteint le worker ; avec un canal absent, une révision périmée, une action différente ou un propriétaire indépendant rival, aucune action n’est libérée.

## Acquisition du retour

Après libération, le même `needId` et la même identité de proposition sont conservés. Le retour physique sélectionné est distribué une seule fois à chacun des canaux ayant contribué. Le mécanisme de déduplication du caller commun reste autoritaire : rejouer exactement le même retour ne rappelle pas les canaux.

## Intégration produit

`V6CommonCampaignDecisionPort` accepte désormais deux options facultatives :

- `jointChannels` : les canaux explicites à enregistrer ;
- `jointContextByChannel` : les données publiques ou symboliques transmises explicitement à chaque canal pour l’observation courante.

Aucun canal n’est installé par défaut. Le comportement existant reste donc inchangé tant qu’un consommateur ne fournit pas explicitement ces options.

Une proposition jointe reste un propriétaire ordinaire pour le caller commun. Si un autre propriétaire indépendant propose simultanément une action, le résultat global demeure `ambiguous`, même lorsque l’action proposée est identique.

## Bornes

- minimum : 2 canaux contributeurs ;
- maximum : 32 canaux enregistrés ;
- aucune recherche combinatoire ;
- aucune priorité, aucun score et aucun classement ;
- aucune conservation interne de payload après la proposition ;
- aucune déduction d’équivalence entre contrats de libération différents.

## Hors périmètre

Ce lot ne démontre pas :

- la parité avec un ancien `joint_channels` ;
- une loi générale de composition de canaux ;
- une décision périodique, modulaire ou multi-étapes ;
- un producteur public générique capable de choisir seul une action ;
- une amélioration de score ARC ;
- une qualification de performance.

La performance ne sera mesurée qu’après validation fonctionnelle et sélection d’un corpus exerçant réellement la jointure.

## Critères de qualification 9C1

- deux contributions compatibles produisent exactement une proposition et une action ;
- supprimer l’une des contributions supprime l’action ;
- des actions ou révisions incompatibles ne sont pas fusionnées ;
- un propriétaire indépendant rival conserve l’ambiguïté globale ;
- le retour sélectionné atteint chaque canal une seule fois ;
- le chemin réel `V6CommonCampaignDecisionPort → CommonCampaignOwner → Logos → action` est exercé ;
- build de production et suite TypeScript complète réussis ;
- aucun changement du compteur des 76 points d’entrée et aucune publication Site.

## Étape suivante

Après qualification de ce contrat minimal, 9C2 devra raccorder de vrais producteurs symboliques à des canaux distincts, puis démontrer qu’ils apportent des informations non redondantes sur un corpus public déterminé. La mesure de coût viendra ensuite, avec le même seuil global strict de moins de +10 % par jeu.
