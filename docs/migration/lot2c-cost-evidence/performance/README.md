# Lot 2C : protocole de clôture du budget de coût

## Déclaration avant mesure officielle

Cette validation porte sur la correction générique de la livraison 63 (moteur 0.35.0). Les résultats antérieurs restent inchangés dans `lot2c-evidence/performance/` : comparaison initiale 14/16 médianes conformes, puis suivi STCK avec cinq dépassements sur huit. Ils ne sont ni remplacés ni requalifiés comme réussis.

La clôture conserve la référence du budget de 2C : **publication 62**, commit `e56118da8b5f596b9727ca78a037e930bc333860`, natif 0.34.0, digest `17252e294212a1563b75037a0b0dd782c2ecbc8cc4e1997a4f2bb2103bdf4e8b`. Une nouvelle mesure complète de cette référence est exécutée dans son checkout isolé, puis une mesure complète du candidat gelé. Les scripts `measure-native-loop-costs.mjs` et `compare-native-loop-costs.mjs` ne sont pas modifiés.

Les deux versions utilisent exactement le manifeste `docs/migration/lot2b-evidence/performance/cases.json` : STCK10 actions, SMLP15, LIFE49 ; trois répétitions à connaissance froide par cas et trois actions d'échauffement. Le même contrôleur, worker, déclarations, traces publiques, disponibilités, commandes vérifiées et points Pause/inspection sont conservés. Chaque version représente 222 actions mesurées et neuf actions d'échauffement. Aucune réponse correspondant à une autre commande ne peut être fournie.

Le seuil reste **+10 % sur chacune des seize médianes STCK/SMLP** : session, nouvelle décision, continuation du service, requête de continuation, garde, acquisition avec persistance, persistance, restauration. LIFE reste le diagnostic de session plus longue, rapporté avec ses hausses éventuelles. Un excès bruité reste non résolu ; le bruit ne s'ajoute pas à la tolérance. Les effectifs, extrêmes, dispersions et p95 admissibles sont conservés. Les coûts imbriqués ne s'additionnent pas.

## Ordre et fenêtres

Après les diagnostics et la validation fonctionnelle du candidat : référence V62 fraîche, puis candidat gelé, un seul passage complet de chaque version. Pendant chacune de ces mesures, les autres tâches du projet se limitent à la lecture et à la rédaction légère : aucun test, build, campagne, export ou jeu navigateur concurrent. L'hôte est partagé ; son activité extérieure n'est pas isolée. Chaque fenêtre est enregistrée avec ses commandes, versions, empreintes, sorties et éventuels chevauchements constatés.

La comparaison V63/candidat instrumentée dans `../diagnostic/` localise les travaux retirés et vérifie les valeurs conservées. Sa session unique, son instrumentation et ses appels directs de service ne sont pas une mesure officielle du budget.

Si une métrique de contrôle reste hors limite, son résultat demeure dans le dossier. Un éventuel suivi doit répondre à une question identifiée avec un protocole déclaré avant exécution ; aucun meilleur résultat ne sera choisi en effaçant les autres essais. La clôture exige un résultat conforme, sans modifier le seuil ni retirer une métrique gênante. Une correction supplémentaire aurait un nouveau gel et de nouveaux reçus.

## Portée

Les durées de jeu, le rendu navigateur et la publication sont exclus. Les inspections couvrent service et transport, sans rendu de l'inspecteur. Pause est vérifiée au début de planification et à la première action engagée, pas comme borne générale d'interruption de toute recherche. Une session LIFE finie ne prouve pas la stabilité mémoire sur plusieurs heures.

Les durées globales, les gardes et les règles d'acquisition doivent être examinées séparément. Une baisse globale ne compense pas un dépassement local. Une optimisation de travail redondant préexistant peut rétablir le budget sans démontrer la cause unique de toutes les variations V62/V63.
