# Enfant typé pour la mesure P05

## Contrat préenregistré

Le lot part de `09b9a509e5e07894b9fccf170f22ae26cbeffbda`. Premier raccord dans `sic_verify_remote_replay` en mode actif. Le besoin parent est celui du contact distant en cours. L’enfant reçoit l’identité du parent, le porteur reconnu, sa position, l’échelle d’un pas, l’observation courante, la commande disponible et un geste hérité. Le ticket et la paire d’observations restent ceux du service natif.

| Témoin | Attendu |
|---|---|
| G50T N1/T1 | L’essai ACTION1 s’ouvre avec une unité et reste en attente avant le retour. Le porteur reste immobile. Le résultat laisse le contrôle inconnu et le parent ne reçoit aucun vecteur. |
| G50T N1/T5 → T6 | Le ticket P05 ACTION4 ouvre un enfant pour le porteur courant. À la clôture du vrai retour, la même pièce s’est déplacée de [6,0]. Le parent enregistre le vecteur sous ACTION4 avec la référence du retour. T6 conserve la marche P07 avec la même commande et le point attendu (26,8). |
| Contre-épreuves | Une preuve de commande, de sujet ou d’observation étrangère ou périmée reste inutilisable. Zéro geste local laisse la décision au repli déjà qualifié. Une référence d’un autre épisode ne rouvre pas un enfant. |

L’observation et les références viennent du service. La famille reste responsable de la réidentification du sujet, de l’unité du pas et de la lecture de la mesure. Le premier raccord ne change pas l’admission ni le plan P07. L’Agenda prépare séparément le parent de pression DC22 N4 dans les fichiers de phases et de route. Une preuve déjà acquise dans `prerequisite` ne crée pas un enfant en attente.

## Ouverture, retour et consommation

`openControlEffectChild` construit un besoin enfant avec l’identité standard `SicNeed`. La famille fournit la signature du porteur, sa position de départ et la longueur d’un pas. L’ouverture exige un geste disponible, le besoin parent assigné et l’offre liée à la vue. L’identifiant du besoin et la référence d’ouverture distinguent la répétition d’un même essai d’un retour réutilisable. [Contrat de l’enfant](../../src/sic/control-effect-child.ts)

La garde et le service délivrent le ticket avant que `nativePlanReceipt` expose l’enfant en attente. À la clôture, `record` retrouve la même signature dans les projections natives successives. Le résultat lie le besoin parent, l’enfant, la commande, le sujet, l’époque et la paire exacte. Un déplacement axial d’un pas donne `observed_translation`. Une immobilité, un pas incompatible ou une réidentification indéterminée donne `unresolved`. Une provenance incompatible écarte le résultat. [Ticket natif](../../src/sic/native-plan-receipt.ts) · [Raccord du rejeu](../../src/sic/replay-access.ts)

Avant de publier `control_effect_return` dans le reçu de composition, le moteur rapproche l’enfant du ticket autorisé et remesure l’effet dans les deux observations natives. Une destination et un vecteur inventés restent irrecevables même s’ils sont cohérents entre eux. Le parent G50T écrit le vecteur et sa référence dans ses champs existants à partir du résultat typé. La suite lit ces champs pour chercher son accès. [Clôture native](../../src/logos-engine/v6-native-runtime.ts)

## Vérification

Le rejeu officiel G50T depuis N1, en SIC et avec un plafond global de 16 gestes, compare le moteur au parent `09b9a509` avec un geste local P05 dans les deux cas. Les 16 commandes, leurs paramètres, les 16 retours et les 17 observations concordent. Les tickets de l’enfant ajoutent leur métadonnée d’attente. Six enfants sont clos dans le préfixe, quatre avec déplacement observé et deux avec résultat indéterminé.

Le test du service reproduit T1 immobile, le vrai retour du T5 et le pas P07 du T6. Une autre exécution conserve le même retour T5 avec une ouverture remplacée par une référence périmée. Le parent n’acquiert plus ACTION4 et le ticket suivant ne porte plus P07. Les tests refusent aussi les substitutions de sujet, de parent, de commande, d’époque, de référence et d’effet. [Tests du lot](../../tests/sic-p05-typed-child.test.ts)

Le parent de pression DC22 et le retour de connexions à `switchContact` suivent leurs propres raccords. Ils peuvent utiliser le même point d’ouverture d’une offre et la même clôture native. Leur mesure doit attester l’effet propre à leur besoin.

```powershell
$nodeSic = (Get-Command node.exe -All)[-1].Source
& $nodeSic --test tests/sic-p05-typed-child.test.ts tests/sic-p05-agenda-shadow.test.ts tests/sic-native-resolution.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-recorded-pulse.test.ts
npm.cmd run typecheck
```
