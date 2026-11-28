# SK48 · ligne 64 · calibrer et engager l’accès initial

Le catalogue depuis L1 attribue N1/T1 à `public_occurrence_recall / observed_composition_services / rooted_line`. L’ouverture native a 16 gestes de session et 600 par niveau. L’opérateur coupe à T5 pour suivre le passage du premier calibrage au premier plan. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères](ATTENDUS.md)

## Ce que le gel consomme

Avant T1, le support se trouve en [11,36,16,41], sa pointe en x=22, avec trois pièces mesurées. L’ordre demandé est [8,14,9]. La famille cherche une commande simple encore inconnue. La priorité déclarée donne `ACTION1, ACTION4, ACTION3, ACTION2`. Au T1, elle propose `ACTION1` sans prédiction de retour. La garde vérifie géométrie, référence et commande. La réponse translate la racine de six pixels vers le haut et conserve l’étendue. La famille lie l’effet [−6,0] aux deux observations du ticket. Le T2 lit cet acquis et teste `ACTION4`.

| Intervention | Résultat dans le service |
|---|---|
| Inverser les deux premières priorités déclarées au T1 | `ACTION4` devient le premier calibrage. L’étendue augmente de six pixels et la racine reste en place. La reprise teste `ACTION1`. |
| Rendre l’ancien plateau après le vrai `ACTION1` | La question devient une tentative, avec aucun vecteur acquis. Le T2 teste `ACTION4`. Le reçu conserve l’empreinte du paquet physique distincte de l’image présentée. |
| Retirer seulement l’effet d’`ACTION1` à l’entrée du fournisseur T5, après quatre vrais gestes | Les quatre commandes restent tentées. Le fournisseur émet le refus bloquant `rooted_control_effect_unresolved`. Le service suspend le parcours sur `frontier_unknown`. |
| Quatre effets appris, état nominal T5 | Le fournisseur calcule une composition conditionnelle de onze gestes en 282 expansions. Le service autorise `ACTION1` et confirme la projection physique du premier pas. Aucun besoin ni contre-exemple de récupération n’est encore présent. |

[Acquisition, offre et garde](../../../src/logos-engine/v6-rooted-line-access.ts) · [Projection](../../../src/logos-engine/v6-rooted-line-mechanics.ts)

## Ce que couvre déjà 4946cf02

Le même départ sous permutation 9↔14 conserve les quatre commandes et leurs paquets physiques. Au T5, les quatre effets sont acquis. Le plafond de session 16 laisse douze gestes. Sur le gel, la recherche atteint sa borne de profondeur après 792 expansions et refuse avec `rooted_contact_plan_unresolved`. Le rejeu antérieur de l’accès initial, où le plafond global était omis, atteignait la borne de 1 000 expansions. Le raccord déjà publié à `4946cf02` autorise le premier pas conditionnel après 282 expansions. Il inscrit `compatible_unordered` pour la station partagée et le vrai retour T5 confirme le pas. L’ordre des pièces à l’intérieur de cette station reste indéterminé. Sur le départ nominal, le candidat et le gel émettent les mêmes cinq commandes avec les mêmes paquets.

Le calibrage, ses effets, l’admission du premier plan et son refus sont déjà composés sur le gel. Le transfert à cette permutation est couvert par `4946cf02`. Ces preuves portent sur la ligne 64. Le dossier 96 commence plus tard, lorsque le jeu contredit une projection de contact. [Qualification publiée du premier plan](https://github.com/yannick-fontan-1981/sra-playground/blob/4946cf02/experiments/sic-agenda-offres/projection-initiale/README.md)

## Rejeu opérateur

Depuis le checkout avec Node 24+, Git, tar et Pyodide local.

```powershell
$d = 'experiments/sic-agenda-offres/sk48-64'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/sk48-64.json"
& $node24 "$d/operateur.mjs" --moteur stations --variante palette --pyodide $py --recu "$env:TEMP/sk48-64-palette.json"
```

Le vérificateur exerce huit préfixes. Il scelle les faits fournis au planificateur, puis consigne le ticket et le retour. Le rejeu utilise les variantes du fournisseur dans le service natif. [Opérateur](operateur.mjs) · [Assertions](verifier.mjs)
