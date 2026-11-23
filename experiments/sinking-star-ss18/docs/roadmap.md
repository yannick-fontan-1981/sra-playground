# État de SS18

**SS18 — La Galerie Résonante**, version **0.1.2**, utilise le trio Marchand / Magicien / Barde et succède au laboratoire SS17. Le dossier de référence est `experiments/sinking-star-ss18`.

## Livraison autonome

La révision 0.1.1 a échangé les anciennes salles 1 et 3 : « Les trois pièces du chœur » ouvre la campagne, et « Le jardin des trois issues » occupe la troisième place avec son tutoriel de 27 découvertes. Cet ordre est conservé.

La révision 0.1.2 renforce uniquement la huitième salle. Les trois caisses et le miroir doivent assurer les quatre poids d’un même accord, dont une presse sur un but impose le maintien jusqu’à la victoire. Un appui immergé initial sert au franchissement sans sacrifier de caisse. La réserve nord-est devient nécessaire par ce bilan matériel. La glissière de la caisse du bas interdit la poussée directe par-dessous ; le témoin organise son transport puis une seconde libération du Barde par échange. Le miroir est réaffecté à la quatrième commande après la visée. La carte garde le retour hydraulique, la séparation du chant du Barde et la cour centrale ; les niveaux 1 à 7, le tutoriel et les règles du moteur restent identiques.

L’audit documente deux victoires qui contournaient la version 0.1.1 sans extraire la réserve : le miroir utilisé comme poids de remplacement et les deux caisses accessibles transformées en appuis au sud. Le durcissement corrige ces deux familles par les contraintes visibles de l’accord final.

Le périmètre de ce lot est la campagne de huit salles, le moteur du trio, le tutoriel au niveau 3, les témoins et audits de conception, l’interface autonome et ses rapports de qualification. Les sources sont conservées sur GitHub. Le fichier jouable est généré par `npm run build` dans `dist/SS18-demo.html`.

La demande de variété guide la conception : tri de caisses sans dispositifs, contrôleur à distance autour d’un bassin, cour octogonale, départs croisés, arène de contrepoids, miroir itinérant, navette à alcôves et synthèse à destinations centrales. Les géométries sont comparées à SS14–17 pour détecter les répétitions exactes, en complément des relectures de mécanismes.

## Étape suivante : intégration native

Le laboratoire ne vaut pas inscription au catalogue natif, essai autonome SRA ou publication du Site. L’intégration doit réutiliser les cartes et le contrat qualifiés, ajouter le raccordement réel du jeu, préserver les animations et le tutoriel, puis passer par la chaîne :

**travail → tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**.

La publication se fait sur le Site SRA Playground existant. Le prompt de `codex-integration-prompt.md` décrit le travail attendu, les précautions de compatibilité et le compte rendu vérifiable. Il faut partir du `main` distant courant et préserver les avancées concurrentes.

## Limites explicites

Les témoins démontrent huit victoires reproductibles. Ils n’établissent ni minimum de coups, ni unicité, ni nécessité globale de chaque capacité montrée. Les variantes élaborées restent légitimes. En N8, la nécessité des trois caisses et du miroir découle du nombre de poids requis à la victoire ; elle ne démontre pas que tous les détails du témoin sont obligatoires. Les découvertes pédagogiques ne constituent pas des verrous cachés. La qualification Happy DOM n’est pas une revue CSS dans un navigateur natif ; ce dernier contrôle reste à effectuer dans l’environnement autorisé d’intégration.
