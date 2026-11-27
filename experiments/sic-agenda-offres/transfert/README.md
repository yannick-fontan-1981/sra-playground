# Premier essai Agenda × Transfert

**Même décision initiale dans les deux mondes : demander la lecture du cadran.** Les deux exécutions de l’opérateur Transfert ont retourné `succès` en quatre actions. La comparaison du premier tour vérifie l’égalité de la décision complète, y compris les preuves, les branches différées et le départage.

| Monde de l’opérateur | Décision à partir de la fiche identique | Preuve effectivement rendue par `lire` | Branche choisie au retour au parent | Suite demandée par l’agenda | Verdict rendu par `play.mjs` |
| --- | --- | --- | --- | --- | --- |
| 1 | `ouvrir_preuve(cadranSurPremiereSortie)` → `lire` | `retour-1 = X4c94cf` | La branche demandeuse `X4c94cf/X022d46/X03a3e1` est confirmée et reprise | Marquer X022d46 puis Xfc26f3 avec X03a3e1, valider | `marqué`, `marqué`, `succès` |
| 2 | `ouvrir_preuve(cadranSurPremiereSortie)` → `lire` | `retour-1 = X6e9ba2` | La même branche demandeuse reçoit une contradiction. Le parent sélectionne sa sœur `X6e9ba2/X022d46/Xa16dcd` | Marquer X022d46 puis Xfc26f3 avec Xa16dcd, valider | `marqué`, `marqué`, `succès` |

La lecture est nécessaire pour garantir une validation dans chaque monde. Toute première marque engage définitivement un tampon. Les sorties compatibles avec la fiche en exigent deux différents. Il faut ensuite deux marquages et une validation, ce qui donne une borne inférieure de quatre actions dans le pire cas. Les deux parcours l’atteignent.

## Ce que l’agenda a décidé

Le premier manque du prototype autonome apparaît **avant le premier marquage**. Son entrée est un ensemble d’offres décrites, de gardes booléennes et de références. La fiche en français ne lui fournit pas directement ce vocabulaire. Même après avoir nommé le fait manquant, `ouvrir_preuve` désigne une question et il reste à lui associer un moyen d’observation.

L’adaptateur limité au contrat de cette fiche traduit les identifiants publics et la règle d’engagement. Il décrit tous les couples case–tampon et l’offre de validation. Pour chaque marquage il vérifie que la case est encore vierge, que le tampon reste compatible avec l’engagement et qu’il est exigé par la sortie désignée. Le tampon que n’exige aucune sortie porte une garde contredite dès la fiche initiale. La validation a pour gardes deux marques et un tampon adéquat. Chaque contribution est proposée sous la condition de préserver la possibilité de réussir dans tous les mondes encore compatibles.

Les deux valeurs booléennes du prédicat `cadranSurPremiereSortie` désignent les deux sorties nommées dans le texte. Tant que le cadran est illisible dans les observations reçues, quatre marquages utiles sous condition restent à égalité. L’ordre stable des identifiants désigne le porteur de la question. Les quatre gardes du cadran peuvent être tranchées par la même lecture. L’adaptateur associe seulement cette demande à l’action publique `lire`. À chaque retour, y compris après chacun des deux marquages, il soumet un nouvel instantané et c’est `Agenda.decide` qui choisit l’offre suivante. L’ordre des cases est aussi une égalité explicite.

Les preuves `fiche:exigences` et `fiche:cases-vierges` proviennent du texte initial. Les preuves `retour-n` identifient la réponse de l’opérateur à une action en vol. Le premier essai d’adaptation attendait que l’accusé de marquage répète la case et le tampon. Le retour réel est simplement `marqué`. La liaison se fait désormais à l’unique action demandée ; la case et le tampon sont lus dans cette action. Le modèle des effets irréversibles, la traduction du prédicat et le lien preuve–lecture sont explicites dans l’adaptateur. Le cœur de l’agenda est celui du commit autonome `b94bbf9e`. [Adaptateur public](fiche-publique.mjs) · [Opérateur et assertions](operateur.mjs)

## Rejouer

Référence Transfert vérifiée : `4b58e1146a7620715e4dfd1b02e52bc05305ff36`. L’essai livré a utilisé la fiche `generated/107/public/9fd1072013fd810d513c.md`. Sur un checkout neuf, le lanceur peut lire sa copie versionnée `exemple/public`. Les deux fichiers vérifiés ont pour SHA-256 `a19a8bbd9e64b320626264da7e4473543452ae63f4fb113833d4387b36cec80e`. [Fiche publique versionnée](https://github.com/yannick-fontan-1981/sra-playground/blob/4b58e1146a7620715e4dfd1b02e52bc05305ff36/experiments/symbolic-situations/exemple/public/9fd1072013fd810d513c.md)

Depuis la racine du checkout Agenda, avec le checkout Transfert voisin :

```powershell
.\experiments\sic-agenda-offres\rejouer.ps1 transfert ..\symbolic-situations
```

Avec Node ≥ 22.18, la commande portable est `node experiments/sic-agenda-offres/transfert/operateur.mjs CHEMIN_DU_CHECKOUT_TRANSFERT`. Ajouter `--trace` pour les décisions complètes. L’opérateur crée deux processus `play.mjs` et garde le sélecteur de monde. Dans chaque partie, une instance neuve reçoit uniquement le Markdown affiché et les réponses aux actions demandées. Le corrigé ne fait partie d’aucune entrée. Le paquet Transfert et le moteur SIC conservent leurs propres versions.

Un second rejeu a aussi réussi en extrayant du commit Transfert uniquement la fiche publique versionnée, `play.mjs`, `cards.mjs` et `enumerate.mjs`.
