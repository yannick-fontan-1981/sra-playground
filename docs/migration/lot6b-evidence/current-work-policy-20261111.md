# Lot 6B : travail courant et exclusivité officielle

## Règle prospective du 11 novembre 2026

L'instruction explicite de l'utilisateur remplace l'ancienne obligation de verrou
global pour le **développement, les tests fonctionnels, les commits et les push**.
Ces opérations s'effectuent sans SH et sans EX global, dans le checkout propre
`/workspace/sites/sra-lot6b-20261111/.sites-checkout`, sur la branche locale
`lot6b-selected-rigid-064`. Les sauvegardes vont sur la branche distante
`lot6b-selected-rigid-checkpoint-20261111`, par commits cohérents et push vérifiés.
Elles n'attendent ni la publication d'un autre lot ni un ancien silence préparatoire.

Le nouveau transport est
[source-workflow-20261111/checkpoint-transport.mjs](source-workflow-20261111/checkpoint-transport.mjs).
Il lance directement un worker Node dans son propre groupe de processus, sans
`flock`. Il conserve les délais, la fermeture des descendants, les contrôles du
dépôt et de la branche, les hooks Git, le push sans force et la vérification du SHA
distant. Les secrets restent en mémoire et hors des reçus. Les commits ordinaires
utilisent Git dans le checkout propre et des chemins explicitement sélectionnés.

## Fenêtres officielles seulement

L'exclusivité est conservée pour **les mesures officielles de performance et
l'acte de publication**. La préparation, les revues et le traitement ordinaire
des résultats ne détiennent pas le verrou de mesure. Chaque fenêtre a un
propriétaire, un identifiant, un début et une échéance fixe adaptés à l'opération.
Le propriétaire relâche ses descripteurs après terminaison vérifiée de ses enfants,
y compris en cas d'échec ou de dépassement. Aucun fichier de verrou existant n'est
supprimé, recréé ou remplacé pour obtenir une acquisition.

Le statut de coordination expose une fenêtre effectivement active sous la forme :

```json
{
  "official_window": {
    "id": "identifiant-unique-de-la-fenetre",
    "owner": "lot6b",
    "kind": "performance",
    "state": "active",
    "startedAt": "date-UTC-de-debut-effectif",
    "deadlineAt": "echeance-UTC-fixe",
    "releasedAt": null
  }
}
```

`kind` vaut `performance` ou `publication`. À la clôture, le propriétaire enregistre
`state: "released"` et la date réelle de libération. Une simple préparation,
`quiet_requested`, ou un drapeau historique `performance_started` ne bloque plus
le travail courant. Une déclaration active invalide ou expirée est un incident
explicite à faire clôturer par son propriétaire, sans attente automatique ni vol
de verrou.

Le garde
[source-workflow-20261111/official-window-guard.mjs](source-workflow-20261111/official-window-guard.mjs)
lit ces seules déclarations et n'acquiert aucun verrou. Il ne rend pas les lectures
de statuts atomiques avec les démarrages. La coordination de passage reste donc
nécessaire : le lot déclare son unité bornée active avant de contrôler les fenêtres ;
un propriétaire officiel prêt à démarrer vérifie des attestations fraîches de fin
des commandes et de tous les workers avant le premier échantillon ou la publication.
Si le passage immédiat n'est pas disponible, il diffère sa tentative et libère son
annonce ; il ne maintient pas un silence préparatoire indéfini.

## Portée et traçabilité

Les plans épinglés, scripts archivés et reçus des exécutions terminées gardent leurs
octets historiques. Leurs anciens préfixes SH ne sont plus des consignes de
lancement courant. Toute réutilisation future passe par la règle prospective et
une nouvelle empreinte de lanceur. Le wrapper `run-case-command.py` n'acquiert déjà
aucun verrou ; sa documentation est alignée, sans changement de logique de budget,
de supervision ou de conservation des échecs.

Cette règle ne modifie pas le moteur natif, les preuves fonctionnelles acquises,
le compteur cumulatif des cas, ni les conditions d'acceptation d'une publication.
La comparaison officielle reste liée au prédécesseur réellement publié. Pour
chaque jeu, l'augmentation de la médiane globale d'une session complète doit rester
**strictement inférieure à 10 %**. Une phase peut dépasser 10 % si ce global passe ;
aucune compensation entre jeux ou suppression d'échantillon défavorable n'est admise.

Le checkpoint de source du lot 6B peut ainsi avancer indépendamment des publications.
La publication proposée en 0.64 reste soumise à la réconciliation de la 0.63
effectivement publiée, à la chaîne complète de coût et aux mesures officielles.
