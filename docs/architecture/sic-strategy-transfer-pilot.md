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

## Campagne générée

Avec Node 24, la commande suivante exécute 1 000 comparaisons appariées. Chaque comparaison utilise le même cas pour la référence et la candidate.

```powershell
npm run test:sic-campaign -- --count 1000 --workers 4
```

La file SQLite et le rapport JSON sont écrits dans `artifacts/sic-transfer-campaign`. Relancer la même commande reprend les comparaisons restantes. Une réservation abandonnée expire après 45 secondes. Une comparaison est sauvegardée lorsque les deux exécutions ont répondu. Utiliser `--state` pour une nouvelle file et `--seed` pour une autre campagne reproductible. La file conserve la révision, l'empreinte du code, la graine, les cas et les décisions. Elle accepte plusieurs processus de travail et déduplique les configurations par leurs règles.

Les 800 premiers cas composent des portes périodiques en série, des délais de déplacement, des états de support partiellement accessibles, des contraintes de commande et des phases perturbées. Les scénarios déterminent le résultat physique avec un simulateur de test. SIC mesure ses phases sur les images rendues et exécute les planificateurs de production à partir d'une scène initiale reconnue. Les cas incluent des contrôles stationnaires, des retours contradictoires et des historiques trop courts. Sur le support commandé, un obstacle renvoie le plateau inchangé pour permettre au planificateur de réviser le trajet.

Le banc regroupe les échecs par premier stade observable et garde pour chaque groupe un cas représentatif de faible complexité. S'il rencontre au moins trois échecs de mesure après un transitoire long dans chacune de deux stratégies, il sélectionne la variante qui étend la fenêtre d'observation de trois à six échantillons. Il la compare à la politique courante sur les 200 situations du second lot, générées avec une autre graine. Le seuil de preuve reste de trois témoins par phase. Le rapport indique les gains attribués à cette preuve, les cas précédemment résolus qui régressent, les admissions sur les cas qui appellent une abstention et les nouvelles erreurs pendant l'exécution. Une qualification pilote exige des gains prouvés dans plusieurs stratégies et zéro nouvelle régression sur ces contrôles. La politique expérimentale reste dans le banc. L'ajout de nouvelles stratégies, de jeux réservés et de nouvelles familles de candidates prolonge ce mécanisme de sélection.
