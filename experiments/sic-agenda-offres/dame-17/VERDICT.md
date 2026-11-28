# Verdict DAME · ligne 17

Le catalogue `8ce7ee35` et le gel `d0e7527c` donnent les mêmes familles, commandes et paquets sur les 16 gestes. Le ticket N1/T1 est `invited_reduction / invited_population_reduction / OP18`, ACTION6 (31,19). Le gel porte déjà l'invitation, l'acquisition de la réduction et la composition conditionnelle.

| Situation | Décision et retour |
|---|---|
| N1/T1, cinq membres, pas 7, origine (14,16) | Le service sélectionne (31,19), cellule [2,0]. Les cinq mêmes membres restent en place. Deux destinations vides changent d'indicateur, [0,2] et [4,2]. Ce retour fonde le focus et ses invitations et aucune loi de prise. |
| N1/T2 réel | L'ordre des destinations privilégie [0,2], clic (17,33). Le service annonce un test sans effet prédit. Le retour retire [2,0] et [1,1], et met à [0,2] un mobile de même type et même rang que le focus. Il acquiert la transaction locale de décalages [-1,1], [-2,2]. La population passe de 5 à 4. |
| Même paquet réel de sélection, invitation [0,2] seule retirée du retour présenté | Le service conserve le focus et l'autre invitation, et propose (45,33). La population est toujours de cinq. |
| Même paquet de sélection, les deux invitations retirées | Le focus reste indéterminé. Le service propose de sélectionner un autre membre en (24,26). |
| Même vrai T2, le seul membre intermédiaire est restauré dans le retour présenté | La destination [0,2] reste occupée et l'origine reste vide. La population vaut à nouveau cinq. Aucune relation de prise n'est acquise et le geste suivant est une sélection en (24,26). |
| N1/T3–T7 | Le service cite le retour T2, calcule huit états et propose la prise symétrique vers [2,4]. Les quatre membres deviennent trois au retour T3 conforme. Les vérifications locales continuent. Le T7 donne la frontière officielle. |
| N2/T8–T15 | La géométrie du second niveau est remesurée avec sept membres. Le service réutilise les relations de même rang, explore 33 états et engage huit gestes. T9 confirme une réduction de sept à six au sein du préfixe. T15 reçoit l'avancement officiel. |

`measureReductionScene` et `retainedReductionScene` lient les occurrences à la grille. `InvitedReduction.record` compare le domaine affiché après sélection ou la disparition et l'apparition de membres au retour d'une prise. `InvitedReduction.propose` consomme les invitations ou les relations étayées, via `measureRayCaptureDomain` dans le parcours de projection. Les symétries et la fin de réduction restent conditionnelles. L'avancement officiel est reçu à part.

Cinq préfixes et 158 tests passent. Il y avait deux invitations dans le premier retour, le protocole distingue le retrait de la première du retrait des deux. Le premier lancement des tests en checkout partiel manquait du corpus V52. Durée du préenregistrement au reçu 7 min 43 s. Harnais `775f40c5505add040d3b1c1aac5aba8d0dd0a027`. Reçu local `artifacts/qualification-dame-17/775f40c5.json`, SHA-256 `32580685b78da3a62df7ad03dc8126c5b72746adb0ad6c8882a5d0cea23eb4ab`. [Commande de rejeu](README.md).
