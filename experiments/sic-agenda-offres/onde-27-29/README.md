# ONDE · Mesurer une phase, l'exploiter et sonder un canal

Le catalogue initial rapporte trois décisions de la famille `periodic_sums`. L'essai repart de ONDE au niveau 1 avec l'agenda actif du Playground, la curiosité d'ouverture native, 600 commandes par niveau et surtout **16 commandes pour la session entière**. Le numéro de geste est global. Le code chargé par le jeu et le code de l'agent sont ceux de la révision examinée. Seuls les paquets publics franchissent la frontière vers le service. [Parcours et prise des reçus](parcours.mjs)

| Référence | SHA |
|---|---|
| Catalogue historique, 100 parties | `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` |
| Gel de comportement et base de la branche | `d0e7527ca8033bd805a6d7a8bb021eff62e87021` |
| Attendus des trois décisions avant modification du fournisseur | `592e8e1903fb32f30c3bf7fdfbedcbfee0d8c9e8` |

## Les trois seuils de preuve

| Ligne | Preuves avant émission | Question ou exploitation | Retour et reprise |
|---|---|---|---|
| **28** · N1 geste 1 | Deux profils de période 8, focus sur le premier. Au détecteur x=25, les contributions 1 et 0 donnent 1 pour une cible de 5. Aucune loi de commande acquise. | `periodic_sum_initial_control_question`. Les questions ACTION3 et ACTION4 sont neuves. La priorité déclarée donne ACTION3. Aucun déplacement prédit. | Le jeu donne un décalage unique `[-1,0]`. La sonde est close avec `matched:null`. La famille enregistre la loi individuelle, référence le retour et s'en sert au geste 2. |
| **29** · N1 geste 2 | La somme mesurée est désormais 3 pour la cible 5. ACTION3 décale le profil focalisé de −1. La recherche conserve 11 préimages de la cible parmi les 64 affectations de phase. | `periodic_sum_joint_phase_target`. ACTION3 atteint le vecteur relatif `[7,0]` en un geste. La proposition contient les profils attendus. | Le jeu franchit le niveau. Le reçu indique `official_boundary` et `matched:null`. Au N2, la même recherche traite deux détecteurs et le premier déplacement y est confirmé physiquement. |
| **27** · N3 geste 7 | Périodes 10 et 12, deux détecteurs, sommes 3 et 1 pour des cibles 2 et 3. Trois préimages sur 120. La loi individuelle connue ne conduit à aucune cible dans le budget restant. Les deux lois collectives sont inconnues. | `periodic_sum_channel_question`. Deux occurrences collectives en (48,3) et (57,3), puis la commande individuelle ACTION4. Le fournisseur essaie la première occurrence par ordre de position. Les couleurs des canaux désignent les profils mesurés. | Le clic en (48,3) donne `[-1,-3]`. Le fournisseur rattache ces gains à cette forme et aux deux profils. Au geste 8, il redemande le même clic avec une prédiction. Le jeu la confirme. |

Le préfixe contient deux contre-exemples à une classification par la commande seule. ACTION3 mesure au geste 1 et exploite au geste 2. Le clic en (48,3) mesure au geste 7 et exploite au geste 8. La classe publie des questions et des plans. `PeriodicSums.before` contrôle la liaison, les profils, le focus et la commande, puis le service délivre le ticket. Le reçu enregistre séparément le plan, le garde et `PeriodicSums.after/record`. [Fournisseur et gardes](../../../src/logos-engine/v6-periodic-sums.ts)

## Expériences et attribution

| Ligne | Intervention contrôlée | Attendu et constat sur les cases de développement |
|---|---|---|
| 28 | Inverser les deux hypothèses dans la déclaration native | Sur gel et candidat, ACTION4 donne `[+1,0]`. Le geste suivant l'exploite et son retour concorde. Le gel consomme donc déjà un ordre de questions remplaçable. |
| 28 | Choisir la seconde **offre admissible**, à déclaration inchangée | Le candidat délivre ACTION4. Sur le gel cette interface d'offres est absente et le ticket reste ACTION3. En fixture, deux retours identiques au plateau initial épuisent successivement les questions. Effacer les repères de focus conserve les deux profils et suspend la proposition locale. |
| 29 | Retirer la seule préimage `[7,0]` du domaine transmis à la recherche au geste 2 | Sur gel et candidat, les 10 autres solutions sont conservées. Le premier ticket devient un clic en (4,32), une sélection à vérifier. Le retour confirme un changement de focus à décalages nuls. ACTION3 termine le niveau au geste 3. |
| 29 | À horizon d'un geste, inverser uniquement le signe de la loi individuelle dans la fixture | La loi mesurée permet une exploitation directe. Avec le signe opposé, la famille propose de mesurer un canal. Retirer l'acquisition retransforme ACTION3 en sonde sur les profils du geste 2. |
| 27 | Garder un seul gain connu pour l'occurrence de gauche, puis lui fournir les deux gains nuls dans la fixture | La loi partielle laisse cette question ouverte. La loi complète décale la question vers (57,3). Un retour stable à gauche conduit aussi à la question de droite sans acquérir de loi collective. |
| 27 | Choisir la seconde offre au geste 7 | Le candidat essaye (57,3) et mesure `[+1,+3]`. Au geste 8 le service sélectionne `public_occurrence_recall`. Le gel conserve (48,3) quand l'intervention ne dispose d'aucun raccord. |
| 27 | Porter la limite de session de 16 à 64 | Même observation et mêmes lois au geste 7. Un trajet de douze commandes devient accessible. ACTION3 est exploitée immédiatement. Aucune sonde collective n'est requise à ce tour. |

Les périodes et les contributions sont déterminées par les profils et leurs échantillons. Le renommage 8↔9 conserve les huit premières commandes et leurs coordonnées. Une famille neuve au N3 peut poser la question initiale sur des périodes 10 et 12. Une fixture de profils `[1,2,1,2]` et `[2,1,2,1]` admet plusieurs décalages et `periodicOffsets` s'abstient. Cette dernière vérification porte sur la primitive de retour. Le témoin de focus équivoque teste l'abstention du fournisseur complet. [Variations sur les états publics](variations.mjs)

**Attribution.** La ligne 28 réutilise dès le gel une priorité déclarée et un retour d'acquisition. Le candidat ajoute la liste des questions encore admissibles après filtrage. La ligne 29 réutilise dès le gel le domaine de `PeriodicSums.targets` dans `PeriodicSums.search`. Sa substitution est éprouvée jusqu'au retour et à la reprise sur les deux moteurs. Pour la ligne 27, le gel apprend déjà une loi et varie sa sonde, mais arrête une boucle locale sur la première occurrence admissible. Le candidat rend cet arbitrage remplaçable et vérifie le reçu de l'autre occurrence. Les lignes 27 et 28 partagent le petit sélecteur `PeriodicQuestionSelector`. Chacune construit ses offres selon son propre seuil. La recherche des cycles, le domaine de préimages et les gardes restent ceux du gel. [Attendus figés](ATTENDUS.md)

## Remise opérateur

Depuis la racine de la branche, Git, tar, Node.js 24.22.3 et le paquet local Pyodide 314.0.7 suffisent. Le reçu agrégé confronte le parcours historique, sept fiches sur le gel et les sept mêmes fiches sur le candidat. Les témoins conservent les identifiants d'observation, les périodes, les contributions aux détecteurs, les lois déjà enregistrées et les références du vrai retour. Les rapports ne contiennent que des mesures réduites.

```powershell
$d = 'experiments/sic-agenda-offres/onde-27-29'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/onde-qualification.json"
& "$d/lancer.ps1" operateur --moteur candidat --fiche "$d/public/autre-canal.json" --pyodide $py --recu "$env:TEMP/onde-canal.json"
```

Le [corpus public](public) utilise `sic.onde/1`. `gestes` borne la lecture du parcours et `budget` borne le planificateur pour la session entière. `couleurs` est vide ou contient les deux identifiants à échanger sur tous les paquets. `substitution` donne un geste et un indice d'offre à partir de zéro. `inverserQuestionsInitiales` inverse la déclaration de priorité au premier apprentissage. `retirerPreimage` indique le geste et le vecteur relatif à retirer s'il appartient effectivement au domaine. `variations` ajoute des contre-épreuves locales sur des copies de l'état avant le ticket. Elles ne fournissent aucune acquisition au parcours natif. Les moteurs disponibles sont `historique`, `gel` et `candidat`. [Entrée opérateur](operateur.mjs) · [Vérificateur](verifier.mjs)

Le résultat qualifie ces décisions, ces bornes et ces retours sur ONDE. Après un changement d'époque, les références cumulées du fournisseur et les mesures du nouveau plateau sont visibles dans le reçu. Elles ne prouvent une loi pour un nouveau contrôle collectif qu'après un retour qui lui est attribuable.
