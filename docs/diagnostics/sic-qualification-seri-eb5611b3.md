# SERI · ligne 93, preuves de reprise distinctes

**Correctif qualifié par le Banc sur `eb5611b3ff76409fbd67680ac29a5f6a17586422`.** Seul `v6-visual-sequences.ts` diffère du gel. Critères `fdc703aa`, état caractérisé `67e19d58`. [Contrôles](sic-seri-provenance-eb5611b3/banc.json) · [Reçus](sic-seri-provenance-eb5611b3/recus.zip)

À même N2/T5, le journal des complétions [2,3,3] et la frontière 5 donnent [3,3,5] sur le gel. Le correctif cite [2,3,5] dans `sequence_plan.continuation_witnesses` et dans `bundle_template.evidence`. Les deux références correspondent maintenant à des questions distinctes. La mémoire d'une seule question dupliquée laisse la reprise sans continuation. Le nominal publie toujours [3,4,5].

Les trois variantes jouent ACTION6 (46,54) et donnent le même remplissage réel. Le rejeu nominal et les contrôles du retrait et du retour stationnaire concordent avec le gel. La première divergence mesurée est donc la preuve publiée du ticket T5. [Défaut caractérisé](sic-qualification-seri-provenance-aa9c4cfe.md)

Node 24 et Pyodide local. Depuis le Banc, `$g` désigne les actifs du gel et `$out` un nouveau dossier de reçus.

```powershell
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c "$out/duplicate" --game SERI --duplicate-completion --game-root $g
py -3.11 scripts/test-sic-catalogue-lines.py eb5611b3 "$out/duplicate" --game SERI --duplicate-completion --corrected-duplicates --game-root $g
py -3.11 scripts/test-sic-catalogue-lines.py eb5611b3 "$out/nominal" --game SERI --game-root $g
```
