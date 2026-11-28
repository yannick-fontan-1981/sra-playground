# CWSE · ligne 45 · rendre un accès de réception exécutable

Le catalogue fixe le témoin `public_occurrence_recall / observed_composition_services / exposed_reception / ACTION4` au N1/T1. Les essais partent de L1, en ouverture native, avec 16 gestes de session et 600 par niveau. Ils comparent `8ce7ee35` au gel `d0e7527c`. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères](ATTENDUS.md)

| Tour | Pré-événement, décision et retour |
|---|---|
| N1/T1 | Le mobile est en (1,2). Les deux zones de réception de palette 9 sont en (4,2) et (6,4). La recherche trouve un trajet de six déplacements, dont le premier est [1,0], mais aucune commande n’est encore liée. La priorité déclarée autorise `ACTION4` comme `control_question`, sans prédiction de retour. |
| Retour T1 | Le mobile et deux corps de palette 9 se déplacent de [1,0]. Le fournisseur lie le vecteur d’`ACTION4` au vrai retour et conserve le déplacement conjoint comme hypothèse. |
| N1/T2 | Le premier déplacement devient exécutable. Le service émet `ACTION4` en mode `access` avec projection. La nouvelle disposition contredit cette projection, d’où `matched:false` et scellement. |
| N1/T3–T4 | À partir de la nouvelle disposition, le service émet deux clics d’exposition. Le T4 valide N1. |
| N3/T13–T16 | La recherche bornée à 8 000 nœuds rend un trajet partiel de huit déplacements. Quatre entrent dans le budget de session. `ACTION2, ACTION1, ACTION4, ACTION1` sont autorisées et leurs quatre projections de réception sont confirmées. Le plafond de session coupe l’accès pendant N3. |

La géométrie d’exposition et la recherche de réception appartiennent à `measureExposedReception` et `pathToReceptions`. `ExposedReceptionMemory` relie les déplacements aux commandes déjà acquises et conserve les résultats des questions. [Mesure](../../../src/logos-engine/v6-exposed-reception-observation.ts) · [Recherche, offre et retour](../../../src/logos-engine/v6-exposed-reception-access.ts)

## Contre-épreuves

| Intervention | Résultat |
|---|---|
| Inverser les deux premières priorités T1 | Le même trajet abstrait est calculé. Le service essaie `ACTION1`, mesure [0,−1] sans mouvement des corps, puis essaie `ACTION4`. |
| Rendre l’ancien plateau après le vrai T1 | Le prochain ticket est une question sur `ACTION1`. Le retour d’`ACTION4` est consigné comme tentative à la même pose et aucun vecteur n’est acquis. |
| Retirer seulement la mesure `ACTION4` de l’entrée du fournisseur T2 | Même scène, même recherche, même commande et même paquet physique. Le ticket devient `control_question` sans projection, puis le service retrouve le clic d’exposition. |

## Contrat commun éprouvé avec CATR

| Ticket réel | Enveloppe | Contrôle sur les mêmes pixels avec une référence étrangère |
|---|---|---|
| CATR/42 N1/T1, `ACTION6(31,47)` | Niveau, score, état et empreinte courants via `observed_composition_services`, et support de point palette 12. | Refus `relation_binding_changed` par `relationalChamberBefore`. |
| CWSE/45 N1/T1, `ACTION4` | Mêmes quatre champs via `observed_composition_services`. | Refus `reception_binding_changed` par `exposedReceptionBefore`. |

Les deux tickets prouvent le même contrat de liaison de l’offre initiale à l’observation courante. Le wrapper écrit leurs quatre champs `expected_before` et remet les gardes propres aux plans. Le garde de chambre vérifie aussi l’édition et les pixels du contrôle. Celui de réception vérifie la disposition, puis la projection et l’orientation pour la continuation. Les dossiers attestent des choix distincts. [Producteur partagé](../../../src/logos-engine/v6-shared-series.ts) · [Verdict CATR et reçu de référence](https://github.com/yannick-fontan-1981/sra-playground/blob/c7358457/experiments/sic-agenda-offres/catr-42/VERDICT.md)

**Attribution.** Le gel consomme déjà le trajet abstrait, l’effet acquis et le contrôle du retour. Le calibrage du T1, le refus de projection au T2 et le préfixe confirmé en N3 établissent cette chaîne.

## Rejouer

Depuis le checkout avec Node 24+, Git, tar, Pyodide local et le reçu vérifié du dossier CATR.

```powershell
$d = 'experiments/sic-agenda-offres/cwse-45'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$catr = '../sic-catr-42/artifacts/qualification-catr-42/9186a49e.json'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --catr $catr --recu "$env:TEMP/cwse-45.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante sans-effet --gestes 4 --tour 2 --commande ACTION4 --pyodide $py --recu "$env:TEMP/cwse-sans-effet.json"
```

Le vérificateur contrôle l’empreinte du reçu CATR et joue cinq préfixes CWSE. Le reçu CATR est reproductible avec son vérificateur au SHA `9186a49e`. Les variantes sont limitées au processus opérateur. [Harnais](operateur.mjs) · [Assertions](verifier.mjs)
