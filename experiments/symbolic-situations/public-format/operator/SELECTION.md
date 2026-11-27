# Registre opérateur · partition v1

Ce registre fixe l’échantillon avant la première mesure du consommateur `sra.public/1`. Le format et ses deux frontaux sont ceux du commit `ac0235bfe521b52b4caa58534e95744fd122f96b`.

- **Développement.** Toutes les fiches publiques livrées des graines 107 (cadran) et 17 (ressource), soit respectivement 8 et 4 fiches. Les exemples ainsi que leurs variantes ambiguës peuvent être utilisés librement durant l’adaptation.
- **Rejeu historique.** La réserve ressource de la qualification `d775a89b` a déjà servi au diagnostic d’admission. Son reçu demeure celui de cette mesure. Elle est exclue du nouveau décompte en aveugle.
- **Réserve prospective.** L’opérateur a tiré une clé de 32 octets uniformes. L’engagement est le SHA-256 du préfixe UTF-8 `sra.public/1.partition.v1`, suivi d’un saut de ligne LF et des octets bruts de la clé. Empreinte déposée : `86886e265599c0fdf1eda6483e31550b4a5cc96bd156c1ccfdb89eb8170ef597`. La clé est conservée localement chez l’opérateur.

La dérivation utilise SHA-256 de la clé brute suivie du séparateur NUL puis du libellé ASCII. Pour le cadran, les libellés sont `dial/0`, `dial/1`, etc. Prendre le premier entier non signé big-endian lu dans les quatre premiers octets qui dépasse 107. Pour la ressource, prendre `public1-` suivi des 32 premiers caractères hexadécimaux du condensat pour le libellé `resource/0`. Ce préfixe distingue cette graine des graines numériques de développement et du tirage historique préfixé `r-`.

Conserver les **huit** cas de la campagne standard du cadran et les **quatre** cas de la suite ressource. Pour chaque famille, trier par identifiant ASCII et jouer tous les mondes compatibles dans l’ordre du simulateur. La mesure couvre ainsi 12 fiches et 18 départs, dont 6 paires ambiguës. L’engagement, la composition et l’absence de recouvrement avec le développement sont vérifiés côté opérateur. Une indisponibilité de la clé ou une empreinte différente interrompt la qualification.

Le premier passage sur cette partition utilise l’exécutable extrait d’un commit identifié du consommateur, après son gel. Les solveurs de contrôle s’exercent sur la partition de développement. Les transcriptions et résultats détaillés de réserve restent du côté opérateur. Le résultat qualifie des instances inédites des deux familles connues.
