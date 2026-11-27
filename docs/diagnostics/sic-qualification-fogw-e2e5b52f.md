# FOGW · ligne 61, extraction du fournisseur d’attente

**L’extraction `e2e5b52fe4476f169c1ab1988d23a5f5368e305c` conserve le parcours nominal et reproduit la poursuite périmée du gel lorsqu’une nouvelle demande apparaît après T17.** La qualification de parité inclut ce défaut préenregistré. [Archive du banc](sic-fogw-ligne-61-extraction/recus.zip) · [Contrat](https://github.com/yannick-fontan-1981/sra-playground/blob/e2e5b52fe4476f169c1ab1988d23a5f5368e305c/docs/architecture/sic-fogw-ligne-61.md)

Le parent `9303451afe621740ef7203f90ea77d846f8e8b94` fournit la caractérisation sur les sources gelées `a1cbde2afc41532c7c047eb05c8637ef02b584d0`. La branche modifie un seul fichier moteur, `src/logos-engine/v6-reception-service-access.ts`, et son arbre `src` devient `26ee4ebbdb972e7b1b3128f9a1a98c0601166e10`. Les 16 commandes d’inventaire du banc, les retours, les lignes retenues et l’arrêt sont égaux entre gel et branche. Toutes les 16 relèvent de `public_occurrence_recall / reception_service`. Le premier ticket `ACTION1` sonde le contrôle. T15 atteint le support (50,26). T16 mesure une fois le maintien sur place par `ACTION4`. Ce parcours emploie le pack par défaut, L1, graine 0, 16 gestes de session, 600 par niveau.

| Situation du vrai service | Résultat |
|---|---|
| Prolongement nominal depuis L1 | T17 engage un préfixe de huit attentes. La deuxième commande, T18, entraîne la capture. Dans la deuxième image, quatre pixels de l’afficheur passent de 3 à 14 et cinq de 5 à 0. L2 débute, T19 sonde de nouveau le contrôle, avec compteur d’attente à zéro. À T32 la seconde capture fait entrer le jeu en L3. Les deux retours de frontière ont `matched:null`. |
| Remesure alternative sur la branche | À preuves antérieures identiques, le fournisseur rend une offre de remesure unitaire au T17. Le service délivre `ACTION4` pour un seul pas, le retour de position concorde. Le ticket T18 repart à l’indice 0 sur une nouvelle observation. L’intervention est testée sur une trajectoire publique contrôlée. |
| Changement de demande construit au retour T17 | La croix est remplacée par un L visible en (28,26). Le maintien en position reste correct. Le service autorise au T18 `ACTION4`, indice 1 du préfixe de huit préparé pour la croix, avec l’ancienne référence. Les tests reproduisent cette association périmée sur le gel et sur l’extraction. |

Les tests passent 3/3 avec le vrai moteur du gel et le harnais de caractérisation, puis 4/4 sur l’extraction, dont le test de remplacement. Le prolongement jusqu’au tour 32 exécute effectivement le jeu, les situations retouchées interrogent le service sur des observations contrôlées. FOGW/61 est qualifiée séparément des assemblages à six et dix lignes.

## Reproduire

Avec Node 24.22.3, pointer `$moteur` sur un checkout préparé du candidat. Pour le gel, exécuter la capture avec le checkout de `d0e7527c` et les tests depuis `9303451a` dont l’arbre de production est identique. Employer un fichier de sortie neuf pour chaque SHA.

```powershell
node scripts/sic-recapture-strategy-inventory.mjs $moteur ./FOGW-inventaire.json --offer public_occurrence_recall '*' reception_service FOGW
Push-Location $moteur
$env:SIC_RECEIVER_GAME_ROOT = (Get-Location).Path
node --test --test-concurrency=1 tests/sic-reception-fogw-line61.test.ts
Pop-Location
```
