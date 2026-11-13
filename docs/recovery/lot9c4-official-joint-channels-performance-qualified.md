# Lot 9C4 — qualification officielle de performance `joint_channels`

Date : 13 novembre 2026 (America/Recife)

Branche de qualification :
`recovery/lot9c4-official-joint-performance-20261113`

Commit mesuré et accepté :
`f98f490359908fd30e2177d819b98fdd958f6f20`

## Conclusion

Le périmètre reconstruit `joint_channels` est **officiellement qualifié en
performance** sur les deux corpus publics réels STCK et SMLP.

L'augmentation globale de session du candidat reste strictement inférieure à
`+10.000 %` pour chaque jeu :

| Jeu | Médiane A | Médiane B | Delta global | Résultat |
| --- | ---: | ---: | ---: | --- |
| STCK | `46.80000000001746 ms` | `49.40000000000509 ms` | `+5.5555555555270475 %` | PASS |
| SMLP | `99.29999999999563 ms` | `99.20000000000073 ms` | `-0.10070493453666618 %` | PASS |

Aucune compensation entre jeux n'a été utilisée. Aucun échantillon mesuré n'a
été supprimé. Aucun retry n'a été introduit dans le protocole.

## Identités A/B

Référence A :

`lot9c4-strict-joint:A:2c7219c7ebf0104fbb8ef7136ec9a6a38f873b7646417c79dcf680ce8bb3fa0a`

Candidat B :

`lot9c4-strict-joint:B:2c7219c7ebf0104fbb8ef7136ec9a6a38f873b7646417c79dcf680ce8bb3fa0a:60162233df3b98bb76863dd67b4e9ccf8198397528fbe48cedbbb36055a9ed2e`

Invariants :

- même checkout ;
- même transport BrowserGameRuntime, Worker, Pyodide et `game_bridge.py` ;
- même archive `public/python/custom-games.zip` ;
- même seed `0` et même niveau initial ;
- même politique publique de cible ;
- même corpus et mêmes actions physiques ;
- même préfixe STCK des deux côtés ;
- seule différence mesurée : B traverse `JointChannelOwner`,
  `CommonCampaignOwner`, l'autorité OP28 et l'acquisition du retour par les deux
  canaux, alors que A omet ce seam.

Les racines de source sont :

- commun : `2c7219c7ebf0104fbb8ef7136ec9a6a38f873b7646417c79dcf680ce8bb3fa0a` ;
- candidat : `60162233df3b98bb76863dd67b4e9ccf8198397528fbe48cedbbb36055a9ed2e`.

## Protocole officiel

Ordre :

`A1 -> B1 -> B2 -> A2`

Compteurs :

- 40 invocations ;
- 8 sessions de chauffe ;
- 24 actions de chauffe exclues ;
- 32 sessions mesurées ;
- 400 actions mesurées ;
- 8 échantillons A et 8 échantillons B par jeu ;
- seuil strict : chaque jeu doit rester sous `+10.000 %` ;
- exactement `+10.000 %` échoue ;
- suppression d'échantillon : `0` ;
- retries : `0` ;
- compensation inter-jeux : interdite ;
- dépassement interne de phase : visible mais non bloquant lorsque le global du
  même jeu passe.

## Portée chronométrée

### STCK

Chaque cycle cible démarre après une session native fraîche et le même préfixe
public de trois actions `ACTION6(x=4, y=52)`. Ce préfixe est exclu du chronomètre
pour A et B et reste conservé dans les métadonnées.

Le chronomètre couvre ensuite :

- la sélection publique de l'unique carte ;
- pour B, la préparation jointe ;
- l'action cible Browser/Pyodide `ACTION6(x=4, y=50)` ;
- la conversion de l'observation retournée ;
- pour B, l'acquisition du retour par les deux canaux.

### SMLP

Après l'observation publique initiale, le chronomètre couvre les boucles de
sélection de cible, préparation jointe éventuelle, action Browser/Pyodide,
conversion du retour et acquisition éventuelle.

## Couverture causale du candidat

STCK :

- 86 décisions jointes ;
- 86 acquisitions ;
- 86 cycles cibles ;
- 258 actions de préfixe explicitement exclues ;
- 10 sessions de protocole terminées.

SMLP :

- 126 décisions jointes ;
- 126 acquisitions ;
- 126 cycles cibles ;
- aucun préfixe exclu ;
- 10 sessions de protocole terminées.

Le corpus préserve les preuves fonctionnelles précédentes :

- STCK : deltas de préfixe `211`, `138`, `95`, puis delta cible `64` ;
- SMLP : delta cible `9` ;
- les deux canaux sont nécessaires ;
- le retour sélectionné est acquis une fois par chaque canal.

## Phases

STCK :

- seam candidat B : médiane `0.9000000000050932 ms` ;
- action jeu A : médiane `46.80000000001746 ms` ;
- action jeu B : médiane `47.95000000001528 ms`, soit `+2.457264957259375 %`.

SMLP :

- seam candidat B : médiane `1.5500000000101863 ms` ;
- action jeu A : médiane `98.19999999999709 ms` ;
- action jeu B : médiane `96.74999999998909 ms`, soit `-1.4765784114134872 %`.

Le seam candidat apparaît comme un dépassement de phase parce que sa référence A
est nulle. Conformément au contrat, ce signal reste visible mais ne bloque pas
la qualification lorsque la session globale du même jeu reste sous le seuil.

## Première tentative rejetée et optimisation

Le run initial `43366018422`, job `131690494127`, a été rejeté honnêtement :

- STCK : `+13.0826 %` environ ;
- SMLP : `+22.9652 %` environ.

Les compteurs causaux étaient corrects. Aucun seuil n'a été relâché et aucun
échantillon n'a été retiré. L'optimisation a ciblé uniquement les allocations du
seam candidat :

- perception publique réutilisée pour la même observation ;
- candidat et payload immuables ;
- un seul payload OP28 partagé entre les deux canaux ;
- compatibilité complète conservée pour les payloads génériques distincts ;
- copies d'acquisition supprimées uniquement pour les canaux déclarés en lecture
  seule ;
- comportement détaché historique conservé par défaut.

Des tests dédiés démontrent à la fois le partage qualifié et la conservation du
chemin générique détaché.

## Preuve GitHub Actions

Run accepté :

- run : `43366962676` ;
- job : `131693534425` ;
- commit : `f98f490359908fd30e2177d819b98fdd958f6f20` ;
- Chrome : `156.0.8078.79` ;
- build et typecheck : PASS ;
- tests des seams SMLP/STCK : PASS ;
- requalification des corpus réels : PASS ;
- contrats ABBA, runners et identités de source : PASS ;
- suite TypeScript complète : PASS ;
- protocole navigateur officiel : PASS ;
- artefact : `lot9c4-official-strict-joint-channels-abba` ;
- artefact ID : `14010801556` ;
- digest de l'artefact :
  `sha256:9b85ab0a249da7b1f7e0362eb190bcc5ad6c768d04c8cea26f8e464c10826a1f` ;
- SHA-256 du rapport brut :
  `sha256:bff263b416755eddcbbb3f16f8aef03c31c51535283f3c58d44d6c53f9c31566`.

Le rapport brut de 40 invocations reste dans l'artefact GitHub. Le résumé durable
versionné est :

`docs/recovery/lot9c4-official-joint-channels-performance-proof.json`

Il contient les seize durées mesurées par jeu, les médianes, les deltas, les
compteurs, les identités A/B et la disposition finale. Les tests recalculent les
médianes et les deltas au lieu de faire confiance aux seuls nombres résumés.

## Disposition

- `joint_channels` 9C0 à 9C4 : terminé dans le périmètre reconstruit ;
- parité avec l'ancienne implémentation perdue : non revendiquée ;
- compteur historique des 76 : inchangé ;
- publication Site : non effectuée ;
- amélioration de score ARC : non revendiquée.

## Étape suivante

Reconstituer le registre courant des points d'entrée depuis les preuves GitHub
durables avant toute nouvelle affirmation de compteur. Les lots fonctionnels et
leurs qualifications doivent être cartographiés au registre sans déduire que les
anciens `70/76` ou `71/76` correspondent automatiquement à l'état reconstruit.
