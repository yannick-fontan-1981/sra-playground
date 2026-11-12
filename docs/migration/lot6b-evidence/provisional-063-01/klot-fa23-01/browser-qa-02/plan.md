# KLOT fa23 — support de QA navigateur02, préparé sans exécution

Le root relit ce support avant de lancer la commande déclarée. QA01 reste intacte : le root a constaté que le CLI start émet son URL puis demeure vivant comme lease ; attendre son exit0 était incorrect. Aucun reçu01 ni registre n’a été ouvert par cette préparation02. Aucun navigateur, preview, jeu, rapport ou ledger KLOT n’a été ouvert pendant cette préparation. Le nom du fichier d’horloge est une métadonnée ; son contenu n’est pas lu ici.

## Intervalle unique

Registre unique fourni par le root : docs/migration/lot6b-evidence/klot-case-clock.json. Ce chemin est maintenant lié à la commande ; son contenu reste non lu par cette préparation.

Le root acquiert le verrou partagé existant après garde fraîche 5C/10C, puis lance run-case-command avec une borne de 600 secondes. Il conserve ce processus et ce verrou ouverts pendant tous les appels CUA. Le helper attend le fichier de fermeture ; run-case-command facture ainsi l’intervalle complet au même compteur, sans nouvelle horloge. Ne pas lancer la commande avant de vérifier que le compteur est inactif et dispose de la réserve exigée par le wrapper (borne +20 secondes).

Le root conserve la propriété exclusive du seul preview géré pendant cet intervalle. Le helper refuse de remplacer un preview actif. La documentation Sites gérée décrit exactement sites-preview start CHECKOUT_ABSOLU, sites-preview status et sites-preview stop (sans argument pour status/stop). Le root a observé avant cette déclaration un status exit0 avec stdout exactement Sites preview stopped suivi d’un saut de ligne ; toute autre forme est refusée. Aucun appel CLI n’a été fait par cette préparation.

## Exécution et fermeture

1. Démarrer la commande déclarée sous SH en cellule conservée. Attendre preview-ready.json, qui conserve l’URL exacte du CLI, les stdout/stderr observés étant dans preview-start.json et les flux complets dans preview-start.stdout.log / preview-start.stderr.log. Le CLI est lancé avec Popen : le helper attend seulement une URL réelle non ambiguë, dans une ligne complète terminée par un saut de ligne, pendant60s au plus, et exige le lease encore vivant à cette observation. Il n’attend pas exit0 pour annoncer ready. Aucun host ou port n’est choisi.
2. Ouvrir par CUA le champ qaUrl : il ajoute uniquement la sélection UI autorisée ?game=KLOT&level=1 à l’URL exacte. Cela évite de charger le jeu fermé par défaut. Aucun autre chemin, serveur, port ou CDP n’est lancé.
3. Le root effectue la QA prévue et conserve ses observations. Cible : fin de QA avant360 secondes depuis le lancement du helper. Le helper ne décide d’aucune action de jeu et ne qualifie aucune réussite fonctionnelle.
4. Avant480 secondes, le root ferme effectivement le tab CUA. Dès l’issue CUA observée, il fournit le completion_summary requis par l’outil. Il exécute ensuite sites-preview stop (borne30s), puis sites-preview status (borne15s), et conserve les sorties réelles. Il crée operator-close.json seulement APRÈS fermeture observée du tab et arrêt du preview confirmé. Il y inscrit le tabId réel et le qaUrl exact. Il écrit d’abord le JSON complet dans un fichier temporaire voisin, puis le renomme atomiquement en operator-close.json pour éviter toute lecture partielle.
5. Le helper enregistre cette attestation, exécute son propre stop borné dans finally, attend son seul processus Popen (10s), puis lui envoie terminate (5s) et kill (5s) seulement si nécessaire. Il conserve pid, chronologie, état vivant initial, codes/signaux réels et empreintes des logs dans preview-lease-terminal.json, puis vérifie de nouveau le status arrêté. Le root attend le reçu terminal run-case-command. Ne jamais utiliser un succès du helper comme preuve de réussite KLOT.

Schéma du fichier de fermeture (valeurs entre chevrons à remplacer par les observations réelles, aucun fichier signal précréé) :

    {"schema":"logos-engine.lot6b-browser-qa-operator-close.v1","recordedAt":"<UTC réel>","tabId":"<tab réellement fermé>","qaUrl":"<qaUrl de preview-ready.json>","tabClosedObserved":true,"previewStoppedObserved":true}

## Bornes et limites

Status initial15s, attente d’URL start60s sans attendre la terminaison du lease, stop final30s, récolte de notre seul Popen10+5+5s au maximum, puis status final15s. Après la limite d’attente525s, ce nettoyage nominal totalise65s au plus, sous la borne externe600s. Objectif QA360s ; fermeture normale et signal reçus avant480s. Le helper conserve la facturation de l’attente jusqu’à525s au plus pour enregistrer un éventuel défaut ; un signal tardif reste un échec. Les 600s externes sont une borne de secours. Le wrapper SIGTERM/SIGKILL ne garantit pas l’arrêt du daemon détaché et ne peut pas fermer le worker navigateur. Si une fermeture échoue, le root doit réellement fermer CUA et arrêter le daemon, conserver l’échec et ne revendiquer aucune preuve de fermeture à partir de l’expiration du temps. Aucun bail logiciel ne remplace l’observation UI.

## Entrées réellement figées

browser-watch.json conserve sans retrait toutes les empreintes du watch QA01, lui-même additif du functional-watch KLOT. Les fichiers01 et leur échec ne sont ni modifiés ni requalifiés. Il ajoute uniquement le support02 ; aucun rapport01 n’est incorporé comme résultat positif. Il ajoute les entrées locales pertinentes HTML/content/public et migration du build-watch-attempt03, les pages HTML générées présentes, ce helper, ce plan, la déclaration, les deux watches parents et le manifeste de source KLOT. Les entrées ajoutées sont liées par empreinte ; le wrapper vérifiera toutes les entrées lors du lancement et à la fin. Aucun helper externe de build n’est ajouté : le CLI ne l’appelle pas. Le daemon, son exécutable externe et l’image hôte restent une dépendance d’environnement, sans prétention de gel intégral.

Le package possède un scripts.dev non vide : préparation des assets Python, génération des pages/gallery, puis Vite. Le preview sert donc les sources et les workers TypeScript (v6-agent-worker.ts/game-worker.ts), déjà figés ; les workers construits de dist ne sont pas servis par ce chemin. Ils ne sont pas ajoutés pour faire croire à une QA du paquet publié. Cette QA reste locale au candidat fa23 ; elle n’atteste aucune publication.
