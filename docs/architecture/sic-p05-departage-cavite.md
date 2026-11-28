# Départage P05 entre deux directions de cavité

## Témoin et résultat attendus avant modification

Référence moteur `162e45506cd9196171c15cb2402cf2ca1ee4266d`. AS66 depuis N1, mode natif V6, au tour global 6 (N2/T1). Sur l’image `fb4c841eea2f859a`, la méthode de cavité récompensée est retenue, ACTION2 et ACTION3 ont un effet mesuré, le corps et la surface sont liés et la route reste à établir. Les commandes publiques ACTION1 et ACTION4 sont toutes deux sans mesure et sans essai à cette clé géométrique. Elles partagent les mêmes prémisses et coûtent chacune un geste.

Le moteur de référence atteint la même vue dans deux départs natifs. Au second, le dossier local marque seulement l’offre ACTION1 comme déjà essayée dans cette géométrie au moment de produire les offres. Le paquet envoyé au moteur et la disponibilité publique des commandes sont identiques. Cette intervention ne crée ni mesure de direction ni nouveau retour.

| À la vue du tour 6 | Offre attendue et action jouée | Vrai retour |
|---|---|---|
| Les deux offres sont ouvertes | ACTION1, première dans l’ordre historique | 80 pixels changés, empreinte `9e25d42a95c97b84`, direction mesurée [-1,0] en ordre ligne, colonne. T7 soumet ensuite ACTION4. |
| La seule offre ACTION1 est retirée | ACTION4 seule, même garde de cavité | 82 pixels changés, empreinte `1d4db55871a6a88a`, direction mesurée [0,1]. T7 libère ACTION2 sous `sliding_cavity_access` et en confirme le retour. |

Le classement doit considérer les offres effectivement admissibles à cette même observation et garder l’ordre historique à coût et preuves égaux. Le budget P05 nul s’abstient. Le shadow doit publier les deux évaluations en conservant le ticket natif. Une seule commande passe au garde et au retour. Au tour 7 nominal, ACTION1 est mesurée et la nouvelle observation ne fournit plus qu’ACTION4.
