# ISOS · verdict indépendant du correctif de provenance

**Les trois contre-épreuves de provenance passent sur `640bd882150f8164b2e6a1a7de6b85b16c52711f`.** Le parent `5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f` reproduit les trois écarts. Cinq départs et **36 gestes par SHA**. La suite auteur confirme trois réussites et trois échecs discriminants sur le parent, puis six réussites sur le correctif. Un seul fichier de production diffère entre les SHA. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/24f4d3ec/experiments/symbolic-situations/isos-ligne-10-provenance/CONTRAT.md)

| Cas, même gain et même raster au passage | Parent | Correctif |
|---|---|---|
| T4 avec la référence d’avant le vrai passage T3 | Reprise de facette (27,14). | Repli de frontière (10,14). |
| T8 avec l’authentique passage du premier niveau, devenu ancien | Reprise de facette (33,23). | Repli de frontière (10,14). |
| Passage T3 acquis avec la méthode retirée de la proposition transmise à l’enregistrement | Le gain est acquis et la référence attachée à la méthode. Reprise de facette. | Le gain reste acquis. La méthode ne reçoit aucune référence de passage et le service replie. |

Les trois replis du correctif sont joués au vrai jeu. Le retour revient à la frontière et le score reste celui du niveau atteint. Le troisième cas intervient sur la preuve portée par la proposition à l’enregistrement. Un contrôle distinct présente le paquet d’un vrai gain T3 avec l’identifiant du ticket T2 déjà utilisé. Les deux SHA refusent cette attribution, puis acceptent le même paquet avec le ticket T3 en vol.

Le catalogue authentique concorde ticket par ticket, sur les 16 gestes, les 12 tickets de facette, les trois gains officiels et les rendus locaux. Les reprises authentiques T4 et T8 citent chacune la bonne frontière et le vrai retour confirme leur rendu. La qualification de la provenance est acquise sur la branche du correctif. [Verdict partiel du gel](https://github.com/yannick-fontan-1981/sra-playground/blob/949c08db/experiments/symbolic-situations/isos-ligne-10/BILAN.md)

Verdict en **5 min 45 s**. Le contrôle de la liste des fichiers modifiés a été corrigé pour utiliser un chemin Git ancré à la racine du dépôt.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f','640bd882150f8164b2e6a1a7de6b85b16c52711f')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','ticket')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
