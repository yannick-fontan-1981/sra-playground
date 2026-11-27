# Lecture évitable · qualification indépendante de bd61ff40

Le montage isolé utilise le point d'entrée et les cinq dépendances Git du candidat `bd61ff40b0a9fbc243787ea269b4e89225206dd8`. Seul `planifier.mjs` diffère dans ce montage par rapport à `f296ac1c`. Chaque départ dispose d'un processus neuf.

| Partition | Cadran | Ressource | Commandes exécutées / proposées | Lectures rendues et suivies d'une commande |
| --- | ---: | ---: | ---: | ---: |
| Développement | 12/12 succès | 6/6 succès | 74/74 | 12/12 |
| Témoins opérateur des deux familles | 12/12 succès | 6/6 succès | 68/68 | 12/12 |

Les deux sorties de la variation à tampon commun conduisent à deux marquages puis à une validation, en trois commandes sans lecture. Les deux sorties du témoin à tampons opposés exigent une lecture au premier tour, suivie du marquage correspondant, et aboutissent en quatre commandes. Ce témoin figure déjà dans le développement. L'énumération indépendante sur chaque paire accepte les traces effectivement produites et confirme les deux minimums. Les départs opérateur avaient déjà servi à qualifier le gel précédent.

Depuis `public-format`, avec Node 24 et le dépôt du consommateur en argument :

```powershell
node operator/preuve-commune.mjs D:/dev/ARC-AGI/SRA-Playground/sic-agenda-preuve-commune
```

L'opérateur peut ajouter `--temoins-operateur` pour le rejeu de son ancienne partition.
