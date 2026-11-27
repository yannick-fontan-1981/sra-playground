# VALV · portée du témoin de frontière de la ligne 48

**La fausse paire 9→11 change la première décision au T11 de L2 sur `495ea14890c1d0cd69de356d40a3b243e0b86f6d`. La vraie paire 10→11 conserve le transfert.** Sur le parent moteur `699ac89e70be0e3cd9bceafa16689552576310a0`, les deux paires autorisaient le transfert. Le préenregistrement `9f127358332a36df6815fcc73f79ece30d1b3351`, parent Git direct du correctif, conserve les sources de `699ac89e`. Le correctif change un fichier moteur, `v6-field-service-access.ts`. [Contre-exemple antérieur](sic-qualification-valv-699ac89e.md) · [Reçus des quatre parcours](sic-valv-495ea148/recus.zip) · [Index](sic-valv-495ea148/banc.json)

Le banc charge le vrai jeu depuis L1 et crée un service neuf par bras. Au retour officiel du T10, la sonde remplace uniquement la référence de départ du témoin du modèle par la référence effectivement enregistrée au T9. Les deux moteurs reçoivent la même intervention. Le reçu indépendant du retour, les observations, la famille choisie et les dix premières décisions concordent entre moteurs. La première différence entre les deux parcours altérés est le champ `kind` du ticket T11, puis la question et les coordonnées. Le premier changement de trame produite par les deux parcours survient après cette commande.

| Paire revendiquée au T11 | Parent `699ac89e` | Correctif `495ea148` |
|---|---|---|
| 10→11 authentique | `field_service_transfer_experiment / revalidate_source_access`, `ACTION6(11,35)`. | Même ticket et même retour physique, 35 pixels modifiés. La commande suivante en (32,51) en modifie 34. Les 16 décisions, 16 retours et 17 empreintes de trame du nominal concordent. |
| 9→11 altérée, image L2 identique | Même transfert en (11,35), puis service conditionnel en (32,51). | `nested_control_experiment / test_unique_nested_compact_motif`, `ACTION6(32,51)`. Le reçu de cette commande cite les révisions 11 et 12 et mesure zéro pixel changé. T12 passe à `observed_frontier` en (10,35). T13 revient au test imbriqué en (32,51). |

Les 3/3 décisions de 44 et 6/6 de 47 conservent leurs retours. Les six décisions nominales de 48 concordent aussi. Les tests de restauration rejouent les acquisitions avant et après la liaison du contexte de transfert aux T11 et T12. Le contexte authentique est accepté aux deux points. Les altérations du récepteur, de l’époque d’acquisition, du progrès officiel, de l’époque de service et du champ sélectionné retirent l’offre. Le banc observe les alternatives jusqu’au retour du T16 sous le budget historique de 16 commandes. [Contrat et cas de restauration](https://github.com/yannick-fontan-1981/sra-playground/blob/495ea14890c1d0cd69de356d40a3b243e0b86f6d/docs/architecture/sic-valv-ligne-48-portee.md)

## Rejouer

Depuis le checkout préparé du banc avec Node 24.22.3 et Pyodide, choisir deux fichiers de sortie neufs. Dans les JSON, comparer `nominal` entre les deux SHA et comparer `boundary.rows` dans l’ordre. `boundary.altered` rattache les deux paires aux trames effectivement observées. Le même lanceur accepte une révision d’assemblage.

```powershell
node scripts/sic-capture-valv-offers.mjs 699ac89e ./valv-parent.json --frontiere
node scripts/sic-capture-valv-offers.mjs 495ea148 ./valv-correctif.json --frontiere
```

Dans un checkout propre de `495ea148`, avec les générateurs Python aux fins de ligne Git et les actifs du jeu préparés, les suites se rejouent ainsi.

```powershell
$env:SIC_VALV_GAME_ROOT = (Resolve-Path .).Path
node --test --test-concurrency=1 tests/sic-valv-field-service-lines.test.ts tests/v6-field-service-kernel.test.ts tests/v6-field-service-reference.test.ts
```

Les 254 tests des trois suites passent, sans test sauté. Les sorties originales se trouvent dans `artifacts/qualification-valv-495ea148/`.
