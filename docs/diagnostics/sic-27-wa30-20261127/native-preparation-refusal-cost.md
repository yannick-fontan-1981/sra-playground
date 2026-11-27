# Coût des refus de préparation dans WA30

Le profil CPU reproduit la campagne sur la source `8fd38588`. Sur les sept fragments L9, la rétention de JSON natif représente 8,250 s échantillonnées. La préparation commune domine ce poste. L'état de sa famille est parfois copié, puis conservé à nouveau lors de la publication de la décision suivante, même quand son examen n'a proposé aucune action ni modifié de fait.

Le commit `f15b3fd2` garde le point de reprise natif validé pendant les refus qui se terminent en lecture. Un changement de niveau et les aides capables de modifier l'état reçoivent toujours une copie détachée. Le contrat de restauration conserve ses mêmes données et autorisations.

Le diagnostic charge 73 retours publics WA30 archivés jusqu'au dernier geste avant la transition L8→L9. Il compare, pour les quatre groupes de préparation, 12 répétitions de restauration, proposition et conservation de l'état. Les deux versions refusent chaque essai. L'état et le graphe canonique sont identiques, avec le SHA-256 `327a1c3eb13fa5ac6b5d28b57f93f9b995be09c3f1760864962db55beed97a15`.

| Groupe de préparation | Médiane de 12 refus sur `8fd38588` | Médiane sur `f15b3fd2` |
| --- | ---: | ---: |
| Couverture mesurée | 380 ms | < 1 ms |
| Effet déjà observé | 382 ms | < 1 ms |
| Revalidation d'un aperçu transféré | 385 ms | < 1 ms |
| Expérience après des retours improductifs | 381 ms | < 1 ms |

L'économie d'environ 32 ms par refus s'applique aux appels où les conditions de lecture aboutissent sans aide d'écriture. Le diagnostic se déroule hors campagne et la part de ces appels reste à mesurer pour le niveau 9. Une passe plus générale de réduction d'allocations dans la rétention procurait seulement un gain local d'environ 4 % dans ce seul poste. Elle a été écartée de ce candidat.

Pour reproduire, extraire le répertoire `src` de `8fd38588` dans un dossier de référence et lancer depuis le checkout candidat, avec Node 24.

```text
node docs/diagnostics/sic-27-wa30-20261127/benchmark-native-preparation-refusals.mjs <dossier-de-référence>
```
