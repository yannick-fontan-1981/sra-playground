# Continuité de marche d’un transport sous contraintes

La capture part du L1 sur `d558c9d8`. Les quatre premières victoires conservent leurs préfixes en **15, 16, 15 et 18 commandes**. Au premier geste du L5 (global65), le rôle a déjà calculé 18 gestes : deux marches précèdent la prise, mais une seule commande est exposée. Après la prise réelle, global68, sept marches de portage déjà calculées sont encore séparées. Les positions des passagers et du porteur sont confirmées à chaque retour.

Les commandes et les observations réelles sont conservées dans `first-public-prefix.json.gz`. L’arrêt borné après74 commandes produit volontairement le message de board changed du contrôleur lorsque canDispatch devient faux ; ce statut de diagnostic ne décrit pas un échec du jeu. Aucun plafond de planification n’a été réduit. Cette capture ne qualifie aucun temps.

Le rôle acquis, la condition de réutilisation et la contradiction qui doit arrêter la série sont précisés dans `first-loss.json`. La prochaine modification expose seulement le préfixe des marches ordinaires ; prises, dépôts et franchissements restent des décisions distinctes.

## Candidat natif

La modification conserve les marches consécutives déjà calculées, avec un maximum de 16 commandes et arrêt avant la prise, le dépôt ou le franchissement. Les gardes chaînent uniquement les retours réellement observés ; l’état appris reste publié une fois, dans l’ordre, à la clôture native. Une absence de prédécesseur acquis interrompt la réconciliation. Les animations contradictoires continuent à apprendre les paires incompatibles.

Les deux salles indépendantes déclarent uniquement un savoir de mouvement et de franchissement antérieur. Elles ne préparent ni route, ni association des passagers, ni paire incompatible. Elles varient formes, palette, positions, pas et commandes ; les tickets natifs montrent la préparation continue, la prise réelle, les marches de portage et la clôture unique. Chacune apprend deux incompatibilités à partir des animations observées puis termine la salle. Quatre contradictions et la référence exacte du prédécesseur sont également vérifiées : **8/8 tests ciblés**.

Une première salle synthétique avait un bord de cadre pouvant être confondu avec un second corps à la prise. Le garde l’a refusé. `fixture-ambiguity.json` conserve les deux composants ; seul le cadre de la fixture est élargi pour garder leurs identités distinctes. La production n’est pas assouplie.

Le rejeu réel chronométré depuis L1, le collecteur de continuité et le contrôle complet restent à effectuer sur ce candidat ; aucune livraison de CGWL n’est annoncée ici.
