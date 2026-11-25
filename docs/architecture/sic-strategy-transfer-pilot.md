# Banc de transfert de stratégies SIC

Lancer un cycle avec Node 24.

```powershell
npm run test:sic-transfer
npm run test:sic-transfer -- --cycles 4 --state artifacts/sic-transfer
```

Le banc conserve un rapport JSON par cycle. Le rapport indique la révision, l’empreinte des entrées, les paramètres des cas, les résultats appariés, les preuves et l’état des 98 lignes de l’inventaire. La reprise utilise la graine suivante si le cycle précédent a réussi. Si le candidat change après un échec, le banc rejoue d’abord la graine qui a échoué. Le jalon pilote demande un gain sur au moins deux stratégies et la réussite de chaque contrôle.

## Première capacité évaluée

SIC peut reconnaître une période après un démarrage transitoire de un à trois échantillons. Il exige trois observations cohérentes par phase et un témoin immédiatement antérieur qui contredit la prolongation de la période vers le passé. Une phase masquée ne compte pas comme témoin. Le début transitoire reste explicite dans l’horloge des arrivées. Pour un support commandé, le plan repart de la dernière phase observée au lieu de repartir de la phase initiale.

La mesure d’une période, avec ou sans transitoire, est commune aux deux stratégies. Elle produit des phases et un contrat de preuve qui donne l’index de début et le nombre de témoins par phase. Le banc vérifie ce même contrat pour attribuer un gain.

Le pilote est relié aux démarches 6 et 88 de l’inventaire. Il passe par la mesure et la planification des arrivées ainsi que par la sélection et la vérification des commandes de support. L’environnement de test fournit des images publiques et vérifie l’arrivée simultanée ou le franchissement effectif. Les deux mécanismes sont synthétiques. Les variantes croisées portent sur la période, l’emplacement et les couleurs du support. Le banc exécute les mêmes cas contre le candidat et contre ce même code avec la primitive commune désactivée dans un autre processus.

Les autres lignes de l’inventaire restent à couvrir. L’extension doit apporter des cas réellement distincts et des jeux réservés. Le verdict pilote établit les résultats des cas synthétiques comparés. La continuité du catalogue s’exécute séparément avec `npm run test:sic-continuity`.
