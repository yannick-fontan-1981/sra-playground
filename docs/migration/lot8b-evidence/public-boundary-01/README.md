# Complément 8B : qualification du trajet public BranchRouting

## Résultat courant : trajet positif qualifié, réserve structurelle ouverte

La [lecture indépendante](qualify-02/review/qualification.json) réussit
**661 groupes de contrôles**, sans échec, avec le statut
`passed_in_revised_positive_scope`. La [synthèse](validation-summary.json)
lie les captures, les preuves, leurs limites et la feuille de route.

| Preuve nouvelle | Résultat observé |
| --- | --- |
| Trajet de production | Bundle worker publié inchangé, service, client et contrôleur réels, dans des threads Node |
| Scénarios froids | Trois : simple, sélection/préfixe triple, retour contraire |
| Retours, tickets consommés et acquisitions BranchRouting | **18 / 18 / 18**, répartis 6 + 7 + 5 |
| Inspection des graphes | **58 inspections, 2 578 deltas**, 36 graphes uniques reliés à 116 références sans perte |
| Refus récupérables | **7/7**, avec ticket et graphe conservés |
| Pause | **4/4** : trois avant dispatch et une pendant un dispatch engagé |
| Préfixe triple | Six retours reçus pour cinq acquisitions, puis sept acquisitions au scellement après le septième retour |
| Contre-retour | Révision de `ACTION1` de `[0, -2]` vers `[0, 2]`, puis question de calibration effectivement autorisée |
| Fermeture positive | Trois réponses `host_session_closed`, puis trois threads terminés et acquittés |
| Ensemble des tentatives | Cinq threads créés, cinq fermés, y compris les deux observations terminales |
| Identité de publication | 331 fichiers natifs, 74 membres du build et six sources publiques identiques au publié 0.67 |

Les deux questions finales supplémentaires sont inspectées puis fermées, sans
exécution. Aucun niveau réussi n'est ajouté. La capture positive a pris
53,742 secondes, son superviseur 54,106 secondes et la lecture indépendante
66,345 secondes ; ces durées instrumentées ne sont pas des mesures officielles
de performance.

La [sonde séparée de palette](terminal-probe-01/probe/receipt.json) confirme
`internal: A public pixel is not a palette index.`, puis `resume` et `close`
refusés comme `stale`, sans retour physique valide. Le contre-exemple de
dimensions reste conservé en échec. **La récupération après ces erreurs
structurelles n'est pas qualifiée.** Les deux paquets présentent aussi un écart
avec leur dernière image d'animation : le message exact identifie la validation
prioritaire atteinte, sans prétendre isoler un seul défaut dans ces paquets.

La [publication observée](site-observation.json) reste **Site 108 / native 0.67**,
active et privée au propriétaire. Cette étape n'a modifié aucun fichier de
production, exécuté aucune nouvelle mesure officielle, acquis aucun verrou
global ni effectué une nouvelle publication. Les coûts officiels 0.67 acceptés
dans leur fenêtre antérieure restent distincts.

**Prochaine étape fonctionnelle : 9A `chart_navigation`**, puis 9B et 9C. Le
lot 7 est livré dans ses périmètres annoncés ; la consolidation globale du
lot 11 reste ouverte. La réserve structurelle ci-dessus reste un suivi commun
explicite et ne réouvre pas LKEY.

## Périmètre déclaré avant exécution

Cette étape complète le lot 8B publié dans **Site 108 / native 0.67.0**,
source `8462204043aa368faa7df280d796bb706eb53b38`. Elle ne commence pas la
consolidation globale du lot 11. Les transferts 7A/7B et le complément Workshop
0.61 sont livrés ; les trois entrées du lot 9 restent ouvertes dans le registre
publié. La [feuille de route](../../v6-delivery-roadmap.md) distingue ces statuts.

Le trajet à qualifier est le contrôleur `BrowserV6Agent`, le client
`BrowserV6WorkerClient`, un vrai thread Node chargeant le **bundle worker publié
inchangé**, le service public et le factory natif réel. L'adaptateur ne fournit
que les API d'environnement et les octets exacts des deux assets déclaratifs
du build. Les requêtes, réponses, tickets, commandes réellement adressées à
l'hôte et inspections du graphe sont conservés. Aucun état acquis n'est injecté.

Le corpus synthétique original est conservé octet pour octet. Une présentation
distincte ajoute du fond zéro à droite et en bas, sur chaque image, jusqu'à
64 × 64. Les pixels utiles et les coordonnées restent fixes, mais la limite
géométrique devient **32 au lieu de 14**. Cette qualification ne revendique donc
pas l'identité intégrale du modèle agrandi avec le composant original. Les
cas miroir sont hors périmètre.

Trois sessions froides sont déclarées :

| Cas | Retours prévus | Objet |
| --- | ---: | --- |
| Simple positif | 6 | Quatre calibrations, mouvement puis propagation |
| Préfixe triple | 7 | Quatre calibrations, sélection, mouvement en deux actions et acquisition différée au scellement |
| Retour contraire | 5 | Quatre calibrations puis réponse contraire et révision de la commande suivante |

Les refus de ticket erroné ou consommé, de session/séquence incohérente et de
paquet public invalide sont insérés sans ajouter de retour physique valide.
La pause est vérifiée avant dispatch et pendant une action engagée. Il n'existe
pas de délai d'expiration du ticket à tester : sa validité dépend de la session,
de la séquence et des identités du graphe et de l'exécutable.

## Limites

Ces retours sont synthétiques : aucun nouveau niveau réussi ni nouveau jeu
n'est compté. La qualification du thread Node ne prouve pas le chargement HTTP,
les règles CSP, le lancement du Worker par un navigateur ou son rendu. Les
inspections montrent le graphe conservé et sa suite ; elles ne comptent pas
des appels internes de restauration. Les ablations et expirations natives
instrumentées restent dans leurs preuves antérieures distinctes.

Le code de production et ses octets publiés doivent rester identiques. Il
s'agit d'une vérification fonctionnelle, sans mesure officielle de performance,
sans publication nouvelle et sans verrou global. Les budgets natifs et de
recherche restent inchangés. LKEY demeure fermé.

## Première tentative conservée : réserve de validation structurelle

La [première capture](capture-01/capture/receipt.json) est **en échec**, après
initialisation réelle et **zéro retour physique**. Les refus de mauvais ticket,
de mauvaise session, de mauvaise séquence et de compteur incohérent ont conservé
l'autorisation et le graphe. L'image de hauteur 63 a ensuite produit l'erreur
`internal: The public game frame must be 64 × 64.` ; la reprise a répondu
`stale`. Le worker a été fermé proprement, et les sources sont restées identiques.

La [réserve vérifiable](structural-validation-reservation.json) conserve les
requêtes/réponses exactes et la provenance. `toAgentObservation` lève un
`TypeError` sur les dimensions ou la palette du raster principal ; le service
ferme la session lorsqu'une erreur n'est pas un `V6AgentError`. Le contrat de
conservation de tous les tickets invalidés était donc trop large. **Il n'est
pas déclaré réussi**, et aucune correction du moteur publié n'est introduite.

La déclaration révisée distingue les trois parcours positifs et les sept refus
récupérables, d'une vérification terminale de la palette dans une session
séparée. La première tentative, ses outils et sa déclaration restent intacts.
Cette révision ne change ni les 18 retours synthétiques, ni les attentes de
commandes, de gardes, d'acquisition, de tickets ou de graphes des parcours
positifs. Une fermeture structurelle reste une réserve de récupération.

Le premier journal contient 196 581 258 octets non compressés, essentiellement
des copies répétées du même graphe complet. La révision retient chaque graphe
intégral une seule fois par empreinte, dans un artefact compressé. Les références
du journal sont résolues et vérifiées avant lecture sémantique. Il s'agit d'un
encodage de conservation sans perte, sans modification des messages réellement
échangés, des réponses ou du code du worker. La borne de conservation devient
2 Gio pour le journal et les graphes uniques non compressés ; les limites
de 45 secondes par RPC et 360 secondes de capture restent identiques.

Le résultat révisé en tête de document complète ce premier constat sans changer
son statut historique d'échec ni ses octets.
