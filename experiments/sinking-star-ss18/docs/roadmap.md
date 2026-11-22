# État de SS18

**SS18 — La Galerie Résonante** utilise le trio Marchand / Magicien / Barde et succède au laboratoire SS17. Le dossier de référence est `experiments/sinking-star-ss18`.

## Livraison autonome

Le périmètre de ce lot est la campagne de huit salles, le moteur du trio, le tutoriel au niveau 1, les témoins et audits de conception, l’interface autonome et ses rapports de qualification. Les sources sont conservées sur GitHub. Le fichier jouable est généré par `npm run build` dans `dist/SS18-demo.html`.

La demande de variété guide la conception : cour octogonale, contrôleur à distance autour d’un bassin, tri de caisses sans dispositifs, départs croisés, arène de contrepoids, miroir itinérant, navette à alcôves et synthèse à destinations centrales. Les géométries sont comparées à SS14–17 pour détecter les répétitions exactes, en complément des relectures de mécanismes.

## Étape suivante : intégration native

Le laboratoire ne vaut pas inscription au catalogue natif, essai autonome SRA ou publication du Site. L’intégration doit réutiliser les cartes et le contrat qualifiés, ajouter le raccordement réel du jeu, préserver les animations et le tutoriel, puis passer par la chaîne :

**travail → tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**.

La publication se fait sur le Site SRA Playground existant. Le prompt de `codex-integration-prompt.md` décrit le travail attendu, les précautions de compatibilité et le compte rendu vérifiable. Il faut partir du `main` distant courant et préserver les avancées concurrentes.

## Limites explicites

Les témoins démontrent huit victoires reproductibles. Ils n’établissent ni minimum de coups, ni unicité, ni nécessité globale de chaque capacité montrée. Les variantes élaborées restent légitimes. Les découvertes pédagogiques ne constituent pas des verrous cachés. La qualification Happy DOM n’est pas une revue CSS dans un navigateur natif ; ce dernier contrôle reste à effectuer dans l’environnement autorisé d’intégration.
