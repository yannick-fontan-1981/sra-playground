# SK48 · verdict indépendant de la ligne 64

**Le gel compose les preuves de calibrage et libère le premier geste de contact.** Sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, les quatre mesures de T1 à T4 alimentent le plan conditionnel au T5, sous `public_occurrence_recall / observed_composition_services / rooted_line`. L’ACTION1 de T1 mesure une translation de −6 pixels sans changer l’étendue. Au T5, le plan propose 11 gestes après 282 expansions. Le premier est réellement joué et le retour le confirme. La reprise de la ligne 96 commence plus tard. [Présélection indépendante](https://github.com/yannick-fontan-1981/sra-playground/blob/163ad06c/experiments/symbolic-situations/sk48-ligne-64/CONTRAT.md)

- Réordonner les priorités au même T1 fait jouer ACTION4. Le vrai retour mesure +6 pixels d’étendue et le service essaie ensuite ACTION1.
- Rendre stationnaire le retour de la même ACTION1 conserve la tentative sans effet acquis. Le ticket suivant essaie ACTION4. Au même plateau T5, retirer seulement l’effet ACTION1 des quatre acquis bloque la composition. Le service rend `frontier_unknown` après `rooted_control_effect_unresolved`.
- Sous 9↔14, les quatre gestes et leurs paquets physiques coïncident. Le gel s’arrête avant T5 à 792 expansions sur la borne de profondeur, avec un reste de 12 gestes sur 16. `4946cf0297734b9464fc52256af6fb27846f3bad` libère ACTION1 à 282 expansions, sous `compatible_unordered`, et le premier effet est confirmé. L’ordre interne de la station reste inconnu.
- Le témoin public 8↔13 atteint T5 et confirme le geste sur les deux SHA. Le vérificateur rejette aussi un faux reçu de T5 qui inverse le verdict de projection.

Six départs sur chaque SHA. Le gel exécute 21 gestes et le correctif 22. À l’échelle des trois palettes complètes, le premier plan est confirmé sur **2/3 au gel et 3/3 sur le correctif**. Le verdict vérifie le premier geste, le calibrage et l’effet mesuré. Il est distinct de la victoire. Mesure indépendante obtenue en environ 1 min 30 s, au premier rejeu.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide de la racine du Banc et `$reçus` un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs stations $py $reçus
node verifier.mjs $reçus
```

L’opérateur monte le harnais figé `1cf241c7625a1e76e4aa4828a50e0ec7ee2d099f`. Pour le témoin du Banc, il paramètre uniquement la paire de couleurs à échanger. Il applique les mêmes assertions aux deux moteurs.
