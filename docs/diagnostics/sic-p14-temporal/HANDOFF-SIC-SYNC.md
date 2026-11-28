# Remise P14 à SIC SYNC

**Destinataire logique : SIC SYNC.** Dossier publié sur la branche `feat/sic-p14-temporal-dev-20261128`. Le canal de réception direct n'a pas été identifié dans les références accessibles ; cette publication ne vaut pas accusé de réception du destinataire.

## Référence à examiner

- Base : `20433007224accc36e3d7976696d9ee7a783a227`.
- SHA du code évalué : **`05b9e74ad2a293ac91420d6f727b873f82c99686`**.
- Graine : **26112814**.
- [Bilan complet](BILAN.md), [rapport JSON](development-report.json), [reçus](development-receipts.jsonl.gz), [six régressions](regressions.json).
- [Campagne GitHub Actions](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46152308332), neuf jobs réussis dont huit lots de familles et l'agrégation.

## Résultat et portée

8 000 situations certifiées, 1 000 par famille, deux mondes par situation. Figé **767 / 8 000** ; candidat **7 844 / 8 000** ; **7 083 gains, six régressions**. Aucun échec candidat retiré. Les 13 doublons et 44 propositions non certifiées sont écartés avant la comparaison. Les 32 translations d'origine sont des contrôles séparés.

Le figé utilise la primitive temporelle native inchangée ; le candidat et le figé partagent le même adaptateur et P09. Les gardes sont consommées avant les mouvements réellement joués dans le simulateur. **Aucune victoire native qualifiée, aucune intégration dans l'arbitrage de production.**

13 970 ablations de témoins réellement cités : 19 pertes de franchissement, 6 947 suites d'actions modifiées, 6 889 inspections supplémentaires, 7 023 réussites avec les mêmes actions. 3 395 302 contrôles indépendants concordants, dont 3 349 332 transitions jouées et 45 970 observations initiales. Zéro preuve invalide ou garde manquante.

## Point à reprendre

Les six régressions viennent d'une période 2 ou 3 extrapolée depuis un transitoire. Une confirmation d'une phase fermée ne suffit pas à confirmer la prochaine ouverture consommée par une action irréversible. Les cas et leurs premières gardes contredites sont conservés pour la prochaine correction à plafonds identiques.

La faisabilité oracle est une existence de politique sur les deux mondes déclarés. Le pilote illustre aussi une fenêtre initiale manquée avant acquisition complète : cette preuve ne garantit pas une acquisition à temps pour toutes les lois possibles. Le bruit est signalé et une inspection fiable est accessible dans cette version.

## État de synchronisation

Branche isolée publiée ; base commune préservée ; aucun merge de ce lot sur `main` ; aucune publication Site. Les règles de transfert natif et de continuité s'appliqueront avant une intégration. Les 2 000 situations de l'opérateur indépendant et SS08–SS25 restent sous scellés.

Empreinte déterministe : `defe844d64e8ffbe9cd2656a054d324bc96bba9df3141ea025c1f7b3376a85e4`.
