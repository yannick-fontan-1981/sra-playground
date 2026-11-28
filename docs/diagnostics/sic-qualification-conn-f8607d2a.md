# CONN · deux offres de série sur le moteur du gel

**Les deux lignes sont attribuées au gel.** La branche de preuve `f8607d2ac0dac47900da3504365b3968a523a549` et le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` ont le même arbre `src`, `a1cbde2afc41532c7c047eb05c8637ef02b584d0`. Le code du jeu, les politiques de référence et le chargeur sont identiques. Le contrat `4c49986916ef043917021f8b6f9b36e585da4719` précède les tests et les deux paquets publics de retour alternatif. [Index des preuves](sic-conn-f8607d2a/banc.json) · [Captures des sessions](sic-conn-f8607d2a/recus.zip)

| Ligne | Décision et preuve datée | Substitution, retour et reprise |
|---|---|---|
| **63 · N1 T1, 5/5** | La famille `public_occurrence_recall` propose `repeated_line_completion`. Quatre champs soutiennent l’extension d’une série de couleur 11, de longueur 3 à 4. La garde `pointed_series_bound` autorise (15,13). Son retour confirme la continuation. Le T4 réfute une extension locale. La frontière officielle du T5 est la première à produire le reçu `repeated_line_scored` de longueur 4. | Au même T1, retirer le premier point du domaine du producteur fait gagner (47,22). Le vrai jeu confirme cette extension. Le prochain ticket revient à (15,13). Retirer l’offre entière donne au contraire une expérience de frontière en (1,61). Sur un seul champ, même motif conservé, la frontière choisit (11,15). |
| **66 · N3 T13, 4/4** | `supported_line_preparation` réemploie la longueur créditée au T5 et les trois échantillons acquis en N3 aux T10–T12. Ils proviennent de clics de la famille frontière, avec une extension bloquée au T12. La garde `supported_preparation_bound` libère (38,46). Le vrai retour date la contribution 11 et la réponse compatible 8. | Sur le même plateau et avec les mêmes mesures, retirer (38,46) du domaine fait préparer (31,46). Le jeu confirme la contribution et le service reprend en (52,32). Retirer seulement l’offre de préparation donne la frontière en (10,25). Conserver uniquement les images finales des trois arrivées efface leur ordre et donne aussi (10,25), malgré le score acquis. |

Le nominal et les deux points alternatifs sont exécutés sur le vrai jeu. Les autres conditions réutilisent les observations publiques avec le vrai service. La capture de l’édition de preuve et celle du gel concordent sur les sept sessions. Le test nominal confronte les 17 paquets publics, animations comprises. La session démarre en L1 au catalogue natif par défaut, avec la graine catalogue 0, 16 commandes au total et un plafond de 600 par niveau. Le reçu de victoire historique des 107 pour CONN compte 6 niveaux et 66 commandes. Les essais ci-dessus s’arrêtent à leur budget ou au premier ticket de reprise.

## Rejouer

Depuis un checkout de `f8607d2a`, avec Node 24 et les actifs préparés, indiquer la racine du vrai jeu. La sonde du banc observe chaque ticket après l’autorisation et le retour après l’exécution. Les sept tests peuvent aussi être exécutés directement avec `node --test tests/sic-conn-series-lines.test.ts`.

```powershell
$banc = (Resolve-Path ../sic-comparison-bench).Path
$env:SIC_CONN_GAME_ROOT = $banc
$env:SIC_CONN_SOURCE = (Get-Location).Path
$env:SIC_CONN_RECEIPT = Join-Path $env:TEMP ("conn-" + [guid]::NewGuid() + ".json")
$sonde = ([uri](Join-Path $banc scripts/sic-observe-conn-series.mjs)).AbsoluteUri
node --import $sonde tests/sic-conn-series-lines.test.ts
```

Pour exercer les sources du gel directement, monter les deux fichiers `tests/sic-conn-series-lines.test.ts` et `tests/fixtures/sic-conn-alternate-returns.json.gz` de la révision de preuve sur un checkout jetable du gel. Les reçus locaux sont dans `artifacts/qualification-conn-f8607d2a/`. [Contrat des deux lignes](https://github.com/yannick-fontan-1981/sra-playground/blob/f8607d2ac0dac47900da3504365b3968a523a549/docs/architecture/sic-conn-lignes-63-66.md)
