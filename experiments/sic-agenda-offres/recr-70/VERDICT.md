# Verdict RECR · ligne 70

Le catalogue `8ce7ee35` et le gel `d0e7527c` donnent les mêmes familles, commandes et paquets publics sur 16 gestes. Le ticket historique est N1/T2 `public_ordered_recruitment / ordered_recruitment / OP18`, ACTION6 (35,54). Le moteur gelé porte déjà le choix, la preuve d'ajout et la revalidation du suffixe.

| Situation | Décision et preuve publique |
|---|---|
| N1/T1, ACTION5 de la frontière observée | La tête de type 2 affronte l'unique ennemi de type 0. Le retour passe de COMBAT à RECRUIT, préserve [2,2] et retire l'ennemi. La paire orientée [2,0] reçoit deux références. Le départ n'établit ni les autres duels ni une règle de départage. |
| N1/T2, quota d'un ajout | Trois boutons visibles représentent 2, 1 et 0. Le calcul visite quatre états, dont un seul chemin d'ajout atteint la condition de survie des salles visibles. Il offre le bouton 0 avec une suite de deux gestes et un survivant conditionnel. |
| Retour réel T2 | Le groupe passe de [2,2] à [2,2,0] en conservant le préfixe. Le reçu acquiert l'ajout et confirme la nouvelle salle de combat face à [1,1]. Le suffixe est gardé. Au T3, ACTION5 en reprend le dernier geste et reçoit la frontière officielle. |
| Échanger seulement deux sujets dans le retour T2 | Les occurrences de type 2 et 0 en (40,15) et (36,15), chacune d'un pixel, produisent [0,2,2]. Salles, liens, types, quota, ennemis et paquet réel sont conservés. L'ajout ordonné et le suffixe précédent sont réfutés. Le nouveau calcul émet encore ACTION5, mais son premier duel consomme `enemy:0` au lieu de `ally:0`, et il projette trois survivants au lieu d'un. L'exécution s'arrête avant cette proposition contrefactuelle. |
| Même vrai T2, retour stationnaire présenté | Aucune occurrence ajoutée, suffixe fermé et reprise par la frontière observée. Aucun nouveau recrutement n'est validé. |
| N2/T4–T9 | La nouvelle file [1,0,1] et les ennemis [2,2,1] fournissent un autre calcul, 22 états. Le retour T4 vérifie [0,1] et quota 2. Les deux ajouts T5–T6 reconstituent [0,1,0,0], puis le retour T7 mesure le survivant [0]. T9 franchit la frontière officielle. |

`measureOrderedRecruitment` lie le front et le parcours de salles par leurs supports visibles. `orderedRecruitmentAlternativesCooperative` transmet les files ordonnées à `measureOrderedFrontReductionD`. Les offres survivantes alimentent `RecruitmentPolicy.choose`, qui ne libère aucune commande. `OrderedRecruitment.recordSource` vérifie les références de calibration, l'ajout en queue et la correspondance entre contexte observé et contexte projeté. La réalisation officielle reste indépendante de l'hypothèse de survie.

Quatre préfixes et 177 tests passent. Durée du préenregistrement au reçu 11 min 03 s. Harnais `01f8fd39e4f0813cdb273b4914d9d1cdc6a74b9b`. Reçu local `artifacts/qualification-recr-70/01f8fd39.json`, SHA-256 `d501cc979db6084e2214636ee6791a3aa782c8e550c203e735c9e5972c735762`. [Commande de rejeu](README.md).
