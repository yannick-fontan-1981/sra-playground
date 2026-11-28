# HPDL · ligne 75 · tester une relation de fenêtre courante

Le témoin du catalogue est N1/T4 `public_window_question / window_question / ACTION6`. Le départ est L1 en ouverture native, plafond de session 16 et plafond de niveau 600. Le rejeu compare `8ce7ee35` au gel `d0e7527c`. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères](ATTENDUS.md)

| Tour | Mesure, décision et réponse |
|---|---|
| T3 | L’essai de frontière `ACTION3` fait passer la capacité de la première boîte de 1 à 4. `WindowQuestion.recordSource` observe le retour de cet autre fournisseur. L’édition est liée au couple de références et à la signature de scène. |
| T4 | La scène mesure deux boîtes, de capacités 4 et 2, et le mot de palettes [8,8,9,9]. La méthode acquise au T3 correspond à la forme des boîtes, au pas 2 et à la forme des unités du mot. Le calcul de couverture conditionnelle explore un domaine de huit et libère une offre de coût 4. Le DRM choisit le réglage de capacité en (14,30). Le service vérifie la géométrie, la méthode et le point avant d’émettre le ticket. |
| Retour T4 et T5 | La projection vise une capacité de 2. Le clic T4 mesure d’abord 4→1. L’essai est scellé avec `matched:null`. La vue modifiée autorise une nouvelle question au même point, avec une nouvelle clé. Le retour T5 mesure 1→2. |
| T6–T8 | Le T6 mesure le passage du filtre 8 à 9. Le T7 lance la traversée. Son paquet contient 78 images et le jeu valide N1. Au T8, quatre méthodes de N1 sont disponibles après nouvelle liaison de leur signature au niveau courant. |

La couverture est une projection du noyau `v5-window-processing`. Le DRM `v6.window_question.choose` départage les offres par type, coût, puis ordre de génération. Il émet une décision locale sans autorité de commande. La garde `exact_current_geometry_method_and_payload` régénère l’offre courante. Le reçu du jeu établit les éditions, avec le statut `observed_field_change_not_capture_law`. [Géométrie et couverture](../../../src/logos-engine/v6-window-question-geometry.ts) · [Politique](../../../src/logos-engine/v6-window-question-policy.ts) · [Fournisseur et garde](../../../src/logos-engine/v6-window-question.ts)

| Intervention au T4 | Résultat |
|---|---|
| Retirer la seule méthode de même signature | Même scène et même préfixe physique. Le fournisseur ne lance pas la recherche de couverture et s’abstient. La frontière émet `ACTION4`, puis la fenêtre retrouve le clic (14,30) au T5. |
| Ajouter une méthode sous une signature étrangère construite | Offre et retours T4–T5 identiques au nominal. |
| Rendre l’ancien plateau après le vrai clic T4 | La tentative est enregistrée, aucune édition supplémentaire n’est acquise et la même offre reste fermée à cet état. La frontière émet `ACTION4` au tour suivant. |

**Attribution.** Le gel assemble déjà la preuve de méthode, la couverture conditionnelle, l’offre, le contrôle du point et le retour. Le préfixe HPDL reproduit les dix tickets de fenêtre aux T4–T13. Les méthodes portables restent des hypothèses à relier à la scène courante. La comparaison avec les contraintes FT09 est traitée dans son propre dossier.

## Rejouer

Depuis le checkout, avec Node 24+, Git, tar et Pyodide local.

```powershell
$d = 'experiments/sic-agenda-offres/hpdl-75'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/hpdl-75.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante sans-methode --pyodide $py --recu "$env:TEMP/hpdl-sans-methode.json"
```

Le vérificateur exerce cinq préfixes. Les contre-épreuves utilisent le même service et gardent l’empreinte du paquet physique lorsqu’elles substituent le plateau présenté. [Harnais](operateur.mjs) · [Assertions](verifier.mjs)
