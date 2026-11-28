# CATR · ligne 42 · accéder à la cible par les relations entre chambres

Le témoin du catalogue est N1/T1 `public_occurrence_recall / observed_composition_services / chamber_relations / ACTION6`. Le départ est L1, ouverture native, plafond de session 16 et plafond de 600 par niveau. Le protocole suit quatre tickets du vrai service et compare `8ce7ee35` au gel `d0e7527c`. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères](ATTENDUS.md)

## Du domaine inverse au retour

| Tour | Mesure, décision et réponse |
|---|---|
| T1 | La scène mesure quatre commandes, huit axes, dont six cibles, et deux valeurs de réglage. La mémoire ne contient aucune édition apprise. L’inverse examine 16 réglages finis et 35 relations. Il retient une seule configuration conditionnelle, avec trois commandes à changer. Le service émet le premier clic, (31,47), qui lie la commande `relation:9:12` à la transition 12→10. |
| Retour T1 | La projection des relations est confirmée. Le jeu a changé cette seule commande, ce qui établit une édition de support 5 de 12→10 et la lie aux deux observations. |
| T2–T3 | Le fournisseur réutilise la même édition acquise pour proposer (27,51) puis (35,51). Le T2 confirme la projection. Le T3 valide officiellement N1, scelle le pas et donne `matched:null` à la comparaison de relations. |

Le T1 reste une expérience pour la liaison de commande 12→10, même quand la relation entre états permet de prédire la projection. L’inverse utilise les tables partielles apprises sur la vue et les cibles structurées. Il n’atteste aucun effet sur le jeu sans retour. [Construction inverse](../../../src/logos-engine/v6-relational-chamber-access.ts) · [Mesure de la scène](../../../src/logos-engine/v6-relational-chamber-observation.ts)

## Contre-épreuves

| Intervention | Résultat natif |
|---|---|
| Retirer le résultat du seul fournisseur de chambre au T1 | Le service choisit `animated_contact / ACTION6(31,51)`. La chambre émet (31,47) au T2 et la projection est confirmée. |
| Ajouter une ligne de relation contradictoire pour le même contexte et les mêmes réglages | La mesure courante contredit cette ligne. Le fournisseur émet `shared_relation_rows_contradicted` avec blocage des essais étrangers. Le service s’arrête avant tout ticket. |
| Présenter l’ancien plateau après le vrai (31,47) | La projection diverge et l’édition de 12→10 reste inconnue. La clé de cet essai est mémorisée. Au tour suivant, (27,51) est une nouvelle expérience. Au nominal, le même clic réutilise la relation acquise. |
| Évaluer la garde du vrai T1 sur les mêmes pixels avec une référence d’observation étrangère | Refus `relation_binding_changed`. Le harnais sonde le garde et conserve le ticket réel intact. |

L’offre passe par `SharedSeriesConstraint.observedPropose`, qui fixe niveau, score, état et empreinte du plateau. Le clic reçoit aussi un support de point, ici (31,47) de palette 12. Le choix de commande et la validation spatiale appartiennent à `RelationalChamberMemory` et au garde `relationalChamberBefore`. Le gel consomme déjà l’unique offre mesurée, son repli et sa reprise. [Enveloppe partagée](../../../src/logos-engine/v6-shared-series.ts)

## Rejouer

Depuis la racine du checkout avec Node 24+, Git, tar et Pyodide local.

```powershell
$d = 'experiments/sic-agenda-offres/catr-42'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/catr-42.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante stationnaire --pyodide $py --recu "$env:TEMP/catr-42-stationnaire.json"
```

Le vérificateur exerce cinq préfixes. Il scelle les faits avant la sélection locale et relève séparément les offres, les tickets et les retours. Les interventions sont limitées au processus opérateur. [Harnais](operateur.mjs) · [Assertions](verifier.mjs)
