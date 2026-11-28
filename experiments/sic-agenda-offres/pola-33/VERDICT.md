# POLA/33, qualification locale du gel

Préenregistrement `0e24fac7`, harnais vérifié `dfc144ce46139e887d0f48fff9ae3ac2d42d3c3d`. Six préfixes natifs, le contraste public `kernelCold` et 136 tests axiaux passent. Les 16 gestes du catalogue `8ce7ee35` et du gel `d0e7527c` concordent, dont six tickets axiaux. 7 min 31 s jusqu'au reçu, passe agrégée réussie au premier lancement après les contrôles en développement.

| Point du parcours | Observation et décision |
| --- | --- |
| N1/T3, `observed_frontier / ACTION5` | Un pixel change sur le centre (21,25). `recordObserved` acquiert la sélection pour le niveau courant, avec les références avant et après le geste. |
| N1/T4, `public_axial_question / axial_question / ACTION4` | `OP18`, but officiel. Corps en (21,25) d'axe [−1,0], pair en (41,25) d'axe [0,1], but intermédiaire (26,25). L'axe est codé dans l'ordre vertical, horizontal des pôles. Deux offres, aucune méthode de rotation acquise. Sous a priori, ACTION4 aligne en un quart de tour contre trois pour ACTION3. Le DRM propose ce test. La garde native exige le même corps, les mêmes repères et la commande courante. |
| Retour réel N1/T4 | Sur cinq trames, le moteur attribue seulement l'ordinal 0 à l'ancienne scène. Le corps passe à [0,1], centres inchangés dans cette trame et quart de tour acquis. Le score officiel passe à 1, le ticket reste scellé avec `matched:null`. L'attraction, la translation et le résultat global n'étaient pas prédits. |
| Retrait de l'attestation ou axe du pair tourné | À T4 le propriétaire n'émet aucune offre. Même entrée publique du service et mêmes commandes. Dans le deuxième cas, la perception du seul propriétaire reçoit le pair avec axe perpendiculaire, centres et marqueur conservés. Repli sur le vrai clic de frontière ACTION6(11,10). |
| Retour T4 stationnaire construit | Aucun quart de tour acquis. La tentative est mémorisée et le service propose l'autre offre, ACTION3. |
| N2, premier ticket axial (geste 8 global) | Le but extérieur justifie une orientation opposée, à distance 2 dans les deux sens. Le rappel du quart de tour observé en N1 départage en faveur d'ACTION4 après revalidation. Avec le seul rappel retiré, le même pré-état donne ACTION3. Les deux parcours terminent N2 au geste suivant. |
| Contraste géométrique public indépendant | Un vrai retour du cas public de tests donne le sens −1 après l'a priori +1. Avec cette acquisition la reprise donne ACTION4, contre ACTION3 avec le reçu retiré. Inverser les offres déplace l'index retenu et conserve le choix. |

Le gel relie déjà perception, offres, DRM, garde exacte, acquisition et reprise, avec une méthode réutilisée de N1 en N2. L'expérience ajoute des témoins causaux et la comparaison avec le catalogue. Aucun fichier de production modifié.

[Commande de rejeu](README.md). Reçu local `artifacts/qualification-pola-33/dfc144ce.json`, SHA-256 `f8acbbba30f4c88ffc2e04af2b84f90dff7d3f53a96929ab8b1d32ca22dcd27e`.
