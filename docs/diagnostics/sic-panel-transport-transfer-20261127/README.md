# RSWP — priorité du transport déjà observé

## Première décision problématique

La référence `4a546a13` gagne **4 niveaux sur 6**, puis s'arrête au niveau 5
après ses 36 commandes autorisées, pour un total de 69 commandes. La capture
diagnostique conservée part du niveau 1 sur `de736c62` et s'arrête volontairement
après 23 commandes : les niveaux 1 à 3 sont gagnés en **3, 8 et 8 commandes**.

À la commande globale 15, le retour public confirme le transport des matières
entre les panneaux et établit son glyphe. La victoire du niveau 3, à la
commande 19, conserve ce rôle. Pourtant, les trois premières décisions du
niveau 4 sont des prévisualisations `ACTION5` de branches du même ancien
transport, alors que les nouvelles activités ne sont pas préparées. Les
changements de 8, 8 et 10 pixels concernent le compteur ; les matières ne sont
pas déplacées. La commande 23 reprend enfin la préparation du panneau par un
clic en `(45,17)`.

## Correction bornée

Le transport acquis conserve maintenant explicitement ses deux références
publiques avant/après. Elles restent présentes dans les tickets même quand
la petite fenêtre de retours locaux évolue. Une entrée antérieure aux
prévisualisations exige ces deux références distinctes dans le même scope,
le compteur de niveaux courant et le même transport que celui de la proposition.
Elle accepte seulement une préparation ou une application de chaîne, ou une
opération d'atelier déjà reconnue par le planificateur existant. Les gardes des
sélections, stocks, transports et retours ne sont pas remplacés.

La correction est sauvegardée au commit local
`ab6e4df7b2ff6cd26c8d206ed0d7bb76dde2b71e`, distant
`dcbf1bfab24bc9efac6c8dac13004659dcf43732`, arbre
`f8dc57ceb931a7b21dd46c1addf1737e74c599ef`.

## Validation et limites

Les **12 tests natifs et d'arbitrage passent**, ainsi que `npm run typecheck`.
Deux scénarios reprennent les 19 commandes publiques d'acquisition dans le
moteur natif et l'ordre réel des groupes. Le second change le glyphe de
transport, toutes les couleurs, la position et les clics. Le premier geste
du niveau suivant prépare le panneau, avec les deux preuves du transport
dans son ticket. Son retour sélectionné est réconcilié et clôturé une fois.
Les refus couvrent deux interfaces ambiguës, la commande d'application
absente, les références manquantes ou étrangères et un retour contradictoire.
Les faits antérieurs restent conservés.

Le retour positif de ce premier clic dans le test réemploie la configuration
publique capturée après les trois attentes : il s'agit d'une construction
fonctionnelle déclarée, pas d'une mesure chronométrée ni du premier clic réel.
Le candidat n'a pas encore de rejeu strict dans cette version de l'archive.
La continuité complète et le viewer restent à vérifier lors de l'intégration.
Aucun nouveau bilan complet des 107 jeux n'est annoncé.

## Sources

`report.json` décrit les compteurs, le rôle et ses conditions. `manifest.json`
donne les empreintes stockées et décompressées. Le résultat de référence et
la capture publique bornée sont archivés. La capture conserve toutes les
grilles et animations, commandes, propositions, retours natifs et états du
rôle ; elle omet les entités géométriques recalculables, les mémoires sans
rapport et les traces globales dupliquées. L'empreinte du fichier original
figure dans l'extraction.

Commande de qualification :

```bash
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs RSWP auto result.jsonl 1
```

Les références et plafonds n'ont pas été modifiés.
