# Candidat B · reconnaître l’exécution du geste demandé

Gel opérateur **`ba2d1e7f3140f1f33d2cf7d47694de395d585bf0`**, base `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. Au premier tour les deux solveurs demandent `indexer P`. La première divergence intervient après `indexé`. Le candidat confirme `indexed(P) = true` et émet `valider`, puis le jeu rend `succès`. [Coupe temporelle](COUPE.md) · [Attendu antérieur au code](ATTENDU.md)

| Rejeu de développement | Gel précédent | Candidat B |
| --- | --- | --- |
| A, effet conditionnel | Arrêt avant le geste, 0/2 | Même reçu dans les deux mondes |
| B, accusé annoncé | Arrêt après l’indexation, 0/1 | 1/1 en deux gestes |
| C, engagement prématuré | Lecture puis succès, 2/2 | Mêmes reçus dans les deux mondes |
| 18 anciens départs | 18 succès, 74 commandes, 12 lectures | Égalité de chaque reçu, y compris des commandes et des retours |

Le libellé disponible sur la fiche B est public. La ligne 3 cite la commande complète et déclare littéralement ce qu’elle renvoie. L’admission normalise **uniquement une déclaration explicite rattachée à cette commande** en une paire libellé/lignes sources. La qualification d’un retour matériel utilise ensuite cette paire pour l’unique commande en vol. Les effets sont ceux des règles structurées applicables. Le texte de l’accusé ne fournit pas de valeurs pour les autres faits. Une absence de déclaration laisse en vigueur les conventions historiques des deux familles. Une déclaration équivoque entraîne un arrêt, y compris si le texte reçu figure dans l’ancien vocabulaire.

Le lecteur expérimental accepte une clause directe `<commande complète> renvoie exactement « <libellé> ».` et la forme attestée en B : `<commande> est disponible si <condition>. La commande <verbe> <arguments> et renvoie exactement « <libellé> ».` Dans la seconde forme, les arguments doivent reprendre ceux de la commande. La ligne appartient aux citations de cette commande. Les caractères de l’accusé sont comparés exactement. Deux annonces discordantes ne permettent aucune mise à jour. Les textes réservés au refus et à la terminaison gardent leur priorité. Cette convention d’entrée interprète une partie déclarative des lignes jusque-là réservées à l’audit. Elle utilise le JSON et le transport v1 existants. Un autre style de prose exige une nouvelle déclaration exploitable.

Le retour accepté sélectionne un seul successeur projeté. Le test compare les faits avant/après en présence d’une seconde référence inconnue. Le refus, le texte vide, le texte d’une autre commande, la déclaration conflictuelle et le renommage complet sont exercés séparément. [Admission](../public-v1/admission.mjs) · [Qualification du retour](../public-v1/solveur.mjs) · [Tests](verifier.mjs)

Depuis le checkout du candidat, avec Node 24 et le checkout de l’opérateur situé en dossier voisin :

```powershell
.\experiments\sic-agenda-offres\retour-public\rejouer.ps1
```

Le rejeu utilise les réductions publiques livrées à `35fd9299` et les deux SHA immuables du consommateur. Pour les anciens départs, l’opérateur du reçu est `16c30e57d72d5dae96c7ff4238f5c06ac68e5d11`. Le script affiche les chemins des deux mesures complètes.

Entrée du montage : `experiments/sic-agenda-offres/public-v1/solveur.mjs`. Dépendances à monter avec leurs chemins relatifs :

```text
experiments/sic-agenda-offres/public-v1/admission.mjs
experiments/sic-agenda-offres/public-v1/planifier.mjs
experiments/sic-agenda-offres/public-v1/schema.json
experiments/sic-agenda-offres/agenda.mjs
src/sic/reasoning-mode.ts
```
