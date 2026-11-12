# Attribution temporelle — préparation des quatre consommateurs

**État : source préparée, non exécutée.** Aucun résultat de qualification, coût, test natif ou jeu n'est revendiqué.

Le contrat accepté porte exclusivement sur « exact_except_attributed_trace_envelope_created ». Les clés exactes, le composant native_reasoning_trace, le chemin /value/root/members/created/bits, l'horloge Date.now() / 1000, les deux fichiers source, la clé de stabilité et allOtherFieldsExact:true sont obligatoires. L'ancien contrat exact n'est pas accepté par une alternative permissive.

Chaque implémentation locale vérifie les empreintes déclarées du qualificatif, ses entrées et les deux sources d'horloge contre **les deux inventaires natifs capturés**. Ces sources ne figurent pas directement dans inputsBefore des captures retenues ; leur liaison se fait par les inventaires complets déjà vérifiés, comme dans le qualificatif. Les reçus et rapports sont des entrées exactes du qualificatif. Leurs rôles, identités natives, sessions, fenêtres et compteurs de points sont liés aux records émis.

Le registre exige un schéma exact, des nombres float64 finis correspondant aux millisecondes, des dates canoniques dans la fenêtre du bon rôle, l'unicité par rôle/session/trace et les deux rôles de chaque trace. Chaque session capturée doit être représentée. La couverture des points est non vide, ordonnée et exhaustive par rapport aux compteurs de captures et inspections effectivement conservés. Aucun nombre de traces n'est déduit d'une formule.

## Frontière de preuve

Ces fonctions contrôlent les **records émis**. Elles ne relisent pas les corps des graphes. L'absence de toute autre différence, la stabilité à chaque occurrence, l'exhaustivité des traces, les origines par rôle, les chaînes et les tickets restent les garanties du qualificatif dont les empreintes et entrées sont vérifiées par les consommateurs. Les deux membres d'une paire ne permettent pas, seuls, de démontrer qu'aucune autre trace n'a été omise. Les reçus complets et l'empreinte de l'attribution sont donc conservés ; cette limite n'est pas remplacée par un compteur inventé.

Les quatre fichiers conservent leurs contrôles existants hors de l'ancien bloc de comparaison exact. Aucun import partagé supplémentaire n'est ajouté. Les trois fonctions Python sont locales et utilisent uniquement la bibliothèque standard ; le consolidateur JavaScript conserve sa fermeture existante. Les contrats, déclarations et précontrôles futurs doivent lier les **nouveaux octets** des outils. Aucun ancien reçu n'est réécrit.

## Préparation de vérification

Les copies originales se trouvent dans before/, chaque diff dans un fichier .patch du nom de l'outil. preparation.json identifie la portée et l'état non exécuté. Les fragments local-python-validator.txt et local-javascript-validator.txt facilitent une revue source ciblée.

synthetic-policy-cases.json contient un cas positif avec des horodatages distincts valides et 50 mutations sémantiques refusées attendues. Les tests contrôlent également que les fonctions ne modifient aucune preuve reçue. Ils ne simulent pas un succès de graphe ni une mesure.

Après revue et autorisation, sous la coordination et le verrou partagé appropriés :

    python -B docs/migration/lot6b-evidence/provisional-063-01/cost-time-attribution-01/downstream-01/temporal-policy-consumers.test.py
    node --test --test-concurrency=1 docs/migration/lot6b-evidence/provisional-063-01/cost-time-attribution-01/downstream-01/temporal-policy-consumers.test.mjs

153 cas Python et 51 cas JavaScript sont attendus, tous encore non exécutés.

Un passage ultérieur sur la véritable attribution qualifiée doit conserver ses propres sorties neuves. Il ne constitue ni une mesure officielle ni une qualification du prédécesseur publié encore manquant.
