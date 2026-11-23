# État de SS18

**SS18 — La Galerie Résonante**, version **0.1.2**, utilise le trio Marchand / Magicien / Barde et succède au laboratoire SS17. Le dossier de référence est `experiments/sinking-star-ss18`.

## Livraison autonome

La révision 0.1.1 a échangé les anciennes salles 1 et 3 : « Les trois pièces du chœur » ouvre la campagne, et « Le jardin des trois issues » occupe la troisième place avec son tutoriel de 27 découvertes. Cet ordre est conservé.

La révision 0.1.2 renforce uniquement la huitième salle. Les trois caisses et le miroir doivent assurer les quatre poids d’un même accord, dont une presse sur un but impose le maintien jusqu’à la victoire. Un appui immergé initial sert au franchissement sans sacrifier de caisse. La réserve nord-est devient nécessaire par ce bilan matériel. La glissière de la caisse du bas interdit la poussée directe par-dessous ; le témoin organise son transport puis une seconde libération du Barde par échange. Le miroir est réaffecté à la quatrième commande après la visée. La carte garde le retour hydraulique, la séparation du chant du Barde et la cour centrale ; les niveaux 1 à 7, le tutoriel et les règles du moteur restent identiques.

L’audit documente deux victoires qui contournaient la version 0.1.1 sans extraire la réserve : le miroir utilisé comme poids de remplacement et les deux caisses accessibles transformées en appuis au sud. Le durcissement corrige ces deux familles par les contraintes visibles de l’accord final.

Le périmètre de ce lot est la campagne de huit salles, le moteur du trio, le tutoriel au niveau 3, les témoins et audits de conception, l’interface autonome et ses rapports de qualification. Les sources sont conservées sur GitHub. Le fichier jouable est généré par `npm run build` dans `dist/SS18-demo.html`.

La demande de variété guide la conception : tri de caisses sans dispositifs, contrôleur à distance autour d’un bassin, cour octogonale, départs croisés, arène de contrepoids, miroir itinérant, navette à alcôves et synthèse à destinations centrales. Les géométries sont comparées à SS14–17 pour détecter les répétitions exactes, en complément des relectures de mécanismes.

## Intégration native

- [x] SS18 suit SS17 dans Custom 4. Le sélecteur, les liens directs et la galerie reprennent les huit salles de la version 0.1.2.
- [x] L’adaptateur et le dispatcher correspondent au laboratoire sur 739 entrées, dont 89 sélections, et 2 096 images avec leurs durées. Chaque fin de salle et la victoire finale sont annulables.
- [x] Les deux anciens raccourcis du niveau 8 sont bloqués par l’accord à quatre poids. Une contre-branche montre la presse expulser le Magicien du but quand le Marchand quitte le bouton après la perte d’une caisse. La variante archivée du niveau 7 reste gagnante.
- [x] Edge confirme la victoire manuelle depuis le niveau 1, les 27 découvertes du niveau 3, les huit vignettes, les commandes tactiles et les interruptions en mode manuel et en mode agent.

Le parcours de référence compte 650 coups hors sélection. Les huit salles en demandent respectivement 56, 82, 94, 78, 83, 46, 43 et 168. La qualification du mode agent couvre le pas à pas et le retour au mode manuel.

## Publication

La publication se fait sur le Site SRA Playground existant, depuis la branche canonique intégrée. Le compte rendu de livraison consigne la version Site, le SHA source et leur correspondance avec GitHub.

[Ouvrir SS18 dans SRA Playground](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS18#playground)

## Limites explicites

Les témoins démontrent huit victoires reproductibles. Ils n’établissent ni minimum de coups, ni unicité, ni nécessité globale de chaque capacité montrée. Les variantes élaborées restent légitimes. En N8, la nécessité des trois caisses et du miroir découle du nombre de poids requis à la victoire ; elle ne démontre pas que tous les détails du témoin sont obligatoires. Les découvertes pédagogiques ne constituent pas des verrous cachés. La qualification du laboratoire couvre Happy DOM et la revue de l’intégration couvre Edge sur ordinateur et sur un écran tactile de 390 px.
