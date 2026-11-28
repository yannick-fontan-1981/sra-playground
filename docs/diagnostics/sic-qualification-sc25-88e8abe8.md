# SC25 · ligne 21, réemploi du lien avant l'ouverture

**Réemploi causal confirmé dans une même époque construite.** Le scénario passe avec le vrai service du gel puis avec `88e8abe8389ba9e5809de6aa8e2f911053f14959`, même arbre moteur. Le harnais totalise 202 tests réussis. Critères `17579803`. [Contrôles](sic-sc25-88e8abe8/banc.json) · [Journaux](sic-sc25-88e8abe8/recus.zip)

- Au retour T5, deux trames et une boîte de récepteur stable lient le motif [0,3] à l'obstruction déjà mesurée. Le propriétaire acquiert cette hypothèse et cite la révision 6. Les deux bras atteignent [7,5] par les mêmes gestes. La voie visée demeure fermée.
- Au T8, retirer seulement le lien récepteur–motif conserve le raster, les vecteurs, la référence d'invocation et les deux motifs admissibles. Le service choisit [0,3] avec le lien et [1,2] sans lui. Les deux choix sont joués jusqu'à l'invocation. Ils effacent les bits. Six pixels de support s'ouvrent pour [0,3].
- Au T10, le vrai ticket `walk ACTION4` amène le corps sur le support neuf, de [7,5] à [9,5]. Le reçu confirme ce pas. Cet effet vient du terrain de test et conserve un score de zéro.

Le témoin couvre une obstruction et deux poses dans le même environnement construit. [Terrain ouvert et marche directe](sic-qualification-sc25-4dcc6591.md) · [Parcours SC25 officiel](sic-qualification-sc25-6172e2d3.md)

Depuis le checkout `88e8abe8`, Node 24. `$g` désigne le checkout propre du gel.

```powershell
$env:SIC_SC25_TRANSFER_ENGINE_ROOT = $g
node --test tests/sic-sc25-motif-transfer.test.ts
$env:SIC_SC25_TRANSFER_ENGINE_ROOT = (Get-Location).Path
node --test tests/sic-sc25-motif-transfer.test.ts tests/v6-motif-access-kernel.test.ts tests/v6-motif-access-contract.test.ts tests/v6-motif-access-reference.test.ts
```
