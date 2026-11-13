# Transport des preuves 5A après refus de taille

Le dépôt a accepté les trois premiers envois normaux, jusqu'au commit
`0d69767970bff5cdc95c163bd5a02614bb661bd4`, puis refusé le quatrième : un
objet de **39 817 093 octets** dépasse sa limite individuelle de **33 554 432
octets**. Le plan initial bornait le volume total de chaque envoi à 40 Mio,
mais ne connaissait pas cette limite individuelle. Les trois reçus de succès,
le plan initial et le rejet effectif restent conservés dans ce dossier.
Ces envois de sources n'ont créé aucune publication intermédiaire : le Site
publié est encore le 83 au moment de cette réparation.

Le JSON `performance/diagnostic/shared-fragment-first-creator.json` conserve
son empreinte originale
`bdfa9286d7a03715282b7e8c7ef49a3c90ccd4eb1e4d7ac1149aa59085127163`.
Ses **45 morceaux de 900 000 octets au maximum** et son manifeste remplacent
seulement sa représentation dans le dépôt. L'index de preuves antérieur et
les reçus de coûts ne sont ni recalculés ni réécrits. Il faut reconstruire ce
JSON avant de réexécuter un lecteur qui vérifie son chemin original.

Depuis la racine du checkout :

```bash
python -B docs/migration/lot5a-evidence/restore-retained-transport.py restore \
  --repo . \
  --manifest docs/migration/lot5a-evidence/final/transport/shared-fragment-first-creator.manifest.json
```

Le commit complet original `33d91ef1b8a6343c554b5c18beacd051816e11b9`
reste dans sa branche locale et dans un **bundle Git incrémental exact**.
Ce bundle conserve aussi les objets des commits créés par l'ancien plan,
y compris les étapes refusées ou non envoyées ; les trois étapes déjà
envoyées sont ses prérequis. Le bundle fait **609 621 octets**, SHA-256
`0022c18ceb57f6c8cae83a247860632be61c379ba602ed35b69f670d0641c317`.
Il est transporté comme un morceau binaire opaque, et non comme l'ascendance
Git du nouveau commit. Ajouter directement `33d91` à cette ascendance
rendrait à nouveau l'objet trop grand accessible au serveur.

```bash
python -B docs/migration/lot5a-evidence/restore-retained-transport.py restore \
  --repo . \
  --manifest docs/migration/lot5a-evidence/final/transport/retained-original-history.manifest.json
git bundle verify docs/migration/lot5a-evidence/final/transport/retained-original-history.bundle
```

Les trois prérequis du bundle sont `bc19974c910711f20385d9a40168a0927ec22057`,
`bed48116585da864dd5c412ed11dd6990a950e8e` et
`0d69767970bff5cdc95c163bd5a02614bb661bd4`. Le nouveau commit de livraison
conserve comme parents les sources déjà envoyées (`0d697`) et l'historique
natif avant ajout final des preuves (`bc199`) ; `bed481`, Site 83, est leur
ancêtre. Aucun envoi forcé ni déplacement d'une branche publiée n'est requis.
Le code, les tests, les dépendances et le build validés restent identiques.

Le [reçu de reconstruction](reconstruction.json) prouve un aller-retour
effectif dans un répertoire neuf, la comparaison de tous les octets, et la
validation Git du bundle reconstruit. Le restaurateur refuse d'écraser un
original différent et vérifie chaque morceau ainsi que leur concaténation.
La nouvelle variante du plan contrôle **32 Mio par objet** et conserve la
borne de **40 Mio d'objets manquants par envoi**, en comptant toutes les
ascendances. La publication utilisera uniquement son état final complet.
