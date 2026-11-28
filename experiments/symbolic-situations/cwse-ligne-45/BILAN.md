# CWSE · verdict indépendant de la ligne 45

**Le calibrage et l’accès partiel de réception sont qualifiés sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `71e15295d2fd38996147a524e4b0cd63e2991cc5`. Sept départs et **38 gestes par SHA**, mêmes tickets et retours. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/da3fac98/experiments/symbolic-situations/cwse-ligne-45/CONTRAT.md)

- Au T1, aucun contrôle n’est appris. Le trajet abstrait compte six pas. La première question ACTION4 mesure (1,0) pour le mobile et les deux corps. Changer uniquement la priorité fait essayer ACTION1 et mesure (0,−1), sans déplacement des corps. Présenter un retour stationnaire au vrai T1 n’acquiert aucun vecteur. T2 essaie alors ACTION1.
- Au T2 nominal, le service réutilise la mesure d’ACTION4 pour projeter un accès. Le vrai retour le réfute et scelle le préfixe. Retirer seulement cette preuve à T2 conserve la recherche, ACTION4 et le même paquet physique, mais le ticket devient un sondage sans projection. Dans les deux départs, T3 reprend par un clic d’exposition et T4 valide N1.
- En N3, les quatre gestes T13–T16 sont confirmés. Ils couvrent quatre des huit pas du trajet partiel trouvé sous la borne de 8 000 nœuds. Le plafond coupe la session en N3 après deux niveaux accomplis. Présenter un retour stationnaire construit au T13 scelle le premier pas. Le service propose ensuite une nouvelle ACTION2 à l’indice 0 au lieu de continuer le plan à l’indice 1.

## Liaison à l’observation

Le vrai ticket CWSE T1 et le vrai ticket CATR T1 utilisent les mêmes quatre champs d’enveloppe, niveau, score, état et empreinte du plateau. Avec les mêmes pixels et une référence étrangère, leurs gardes respectifs refusent. Dans CWSE, l’injection du refus dans le service empêche l’émission au T1, et au T3 sur le clic (49,55) de palette 5. Les raisons et les supports de point restent propres aux deux familles. [Qualification séparée CATR/42](https://github.com/yannick-fontan-1981/sra-playground/blob/6a25d460/experiments/symbolic-situations/catr-ligne-42/BILAN.md)

Verdict en 3 min 55 s au premier rejeu.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide du Banc. Utiliser des dossiers de sortie neufs.

```powershell
node ../catr-ligne-42/qualifier.mjs gel $py $reçusCatr
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus "$reçusCatr/gel.nominal.json"
```
