# ISOS · ligne 10, provenance du passage corrigée

**Ligne 10 qualifiée sur la branche `640bd882150f8164b2e6a1a7de6b85b16c52711f`.** Le parent `5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f` reproduit les trois défauts attendus. Le correctif passe les six tests et change uniquement `src/logos-engine/v6-facet-examples.ts`. Critères `4bf2d49d`. Rejeu indépendant du 27/11 23:59:43 au 28/11 00:05:02 (UTC−3). [Reçus](sic-isos-provenance-640bd882/recus.zip) · [Contrôles](sic-isos-provenance-640bd882/banc.json) · [Défaut sur le gel](sic-qualification-isos-5161917e.md)

| Cas | Premier écart mesuré | Parent | Correctif |
|---|---|---|---|
| Référence immédiatement antérieure au vrai T3 | N2/T4 | Facettes, ACTION6(27,14) | Frontière, ACTION6(10,14) |
| Ancienne référence authentique du gain de N1, présentée au vrai T7 | N3/T8 | Facettes, ACTION6(33,23) | Frontière, ACTION6(10,14) |
| Gain du T3 avec méthode retirée du ticket qui a marqué | Retour N1/T3 | Le reçu de passage est attribué au portable | Le retour garde le gain, champ de passage absent, repli de frontière |

Les deux premières paires conservent les mêmes préfixes, paquets et scores jusqu’aux décisions indiquées. Les vrais retours des deux tickets de repli restent dans le niveau courant. Avec les références authentiques, les douze tickets, retours et trois passages concordent. Le préfixe de catalogue, avec un budget effectivement transmis de 16, concorde également sur le gel et le correctif. Le contrôle compare les champs capturés et les empreintes de paquets. Les deux défauts injectés et le gain sans méthode sont traités séparément.

Départ N1, curiosité native, graine implicite 0, six niveaux visés et 600 gestes par niveau. Depuis la branche du banc avec Node 24 et Pyodide, `$c` désigne un checkout propre au SHA `640bd882`.

```powershell
$out = 'artifacts/rejouer-isos-provenance'
py -3.11 scripts/test-sic-catalogue-lines.py 5161917e --game ISOS-PROVENANCE $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py 640bd882 --game ISOS-PROVENANCE $out --game-root ../sic-main-delivery
node scripts/sic-recapture-strategy-inventory.mjs ../sic-main-delivery "$out/catalogue-gel.json" --target-levels 6 ISOS
node scripts/sic-recapture-strategy-inventory.mjs $c "$out/catalogue-correctif.json" --target-levels 6 ISOS
py -3.11 scripts/check-sic-isos-provenance.py $out
```

Le premier appel produit volontairement les trois échecs du parent. Le vérificateur exige leurs reçus avant de valider ceux du correctif.
