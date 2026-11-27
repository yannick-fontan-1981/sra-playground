# Dialogue public · sra.public/1

Pour entraîner et éprouver le consommateur, les deux familles partagent le même protocole. Le répertoire public contient les 12 messages de développement. Les quatre fiches masquées du cadran et les deux fiches ambiguës de la ressource peuvent être rejouées dans chacun de leurs deux mondes. [Fiches JSON de développement](examples/) · [Contrat du message initial](CONTRAT.md) · [Schéma](schema.json)

## Échanges entre processus

L’opérateur lance un processus neuf pour chaque départ. Les échanges sur l’entrée et la sortie standard sont en UTF-8. Chaque ligne contient un objet JSON à une seule clé. Le solveur écrit au plus une réponse à la fois. Les diagnostics peuvent aller sur la sortie d’erreur.

| Sens | Objet | Signification |
| --- | --- | --- |
| Opérateur → solveur | `{"fiche":{…}}` | Le champ `fiche` contient directement l’objet `sra.public/1` complet. Les fichiers de développement contiennent la valeur de ce champ. |
| Solveur → opérateur | `{"action":"<commande>"}` | Joindre les mots d’une commande proposée par une espace. L’opérateur applique cette seule action au monde courant. |
| Opérateur → solveur | `{"retour":"<texte public>"}` | Retour réel du geste demandé. Une lecture acceptée rend le code observé. Une commande indisponible rend `Action indisponible.` et laisse l’état inchangé. |
| Solveur → opérateur | `{"incompatible":"<raison>"}` | Refus du format au premier tour, avant toute commande. |
| Solveur → opérateur | `{"arret":"<raison>"}` | Fiche admise, abandon volontaire au départ ou après un retour. |

Après le retour terminal, l’opérateur ferme l’entrée. Un abandon et un refus du format terminent immédiatement le dialogue. Une réponse mal formée, un dépassement de cinq secondes par réponse ou de 32 commandes par partie est consigné séparément. Les arguments, le nom du fichier et le numéro du monde ne sont pas transmis au solveur.

## Rejeu de développement

Depuis `experiments/symbolic-situations/public-format`, avec Node.js 24 ou ultérieur :

```powershell
node operator/run.mjs --solveur D:/outils/solveur.mjs
```

Le point d’entrée est un programme Node autonome qui lit et écrit ce dialogue. Pour remettre un consommateur figé composé de plusieurs fichiers, communiquer à l’opérateur le SHA Git complet, le chemin du point d’entrée et les dépendances locales à monter. Il peut ainsi rejouer les octets du commit livré en conservant les imports relatifs. Le développement dispose des deux familles à chaque exécution.

Le bilan distingue l’admission du format, les commandes proposées et exécutées, les retours de lecture effectivement rendus, les décisions ultérieures, les abandons et les résultats terminaux. Une commande bien formée atteste l’admission même si le jeu la refuse. Un message illisible avant la première décision laisse l’admission indéterminée.
