# Complément 8B : qualification du trajet public BranchRouting

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

Aucun résultat positif complet n'est encore revendiqué dans ce jalon.
