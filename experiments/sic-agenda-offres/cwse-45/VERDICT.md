# CWSE · verdict de la ligne 45

Le gel émet `exposed_reception / ACTION4` au N1/T1 comme question de contrôle. Il a déjà un trajet de six déplacements vers les zones de réception (4,2) et (6,4), mais sa première translation [1,0] attend une commande mesurée. Le retour T1 fournit ce lien. Le T2 émet le même geste pour l’accès et son retour de disposition scelle la projection. Les deux clics d’exposition qui suivent terminent N1. [Protocole et commande](README.md) · [Critères](ATTENDUS.md)

Le retrait de l’effet [1,0] au T2 conserve le trajet abstrait et le paquet physique. Il change la décision d’accès en question de contrôle. Le retour stationnaire T1 garde la tentative sans effet et le fournisseur passe à `ACTION1`. En N3/T13, le service émet quatre pas du trajet borné. Les retours confirment les quatre projections.

Le reçu associe le vrai T1 CWSE au vrai T1 CATR du dossier `c7358457`. Leurs enveloppes portent les mêmes champs de liaison. À pixels identiques, changer seulement la référence d’observation fait refuser les deux gardes. CATR lie aussi son point de clic et son édition de chambre. CWSE lie sa disposition et contrôle l’orientation à la continuation. Le contrat de liaison initiale est commun aux deux tickets. Leurs mesures d’accès relèvent de leurs fournisseurs propres.

Cinq préfixes CWSE et 130 tests passent. L’empreinte du reçu CATR est vérifiée et le dossier conserve les deux tickets. La branche de qualification a le même arbre de production que le gel.

Harnais testé à `71e15295d2fd38996147a524e4b0cd63e2991cc5`. Reçu écrit le 27 novembre 2026 à 23 h 13 min 34 s (UTC−3), après 5 min 58 s. L’agrégat a réussi au premier lancement. Reçu local `artifacts/qualification-cwse-45/71e15295.json`, SHA-256 `000c30d2771a604b75270179675cde781183861e2c48339b16c0566e3862cb11`.
