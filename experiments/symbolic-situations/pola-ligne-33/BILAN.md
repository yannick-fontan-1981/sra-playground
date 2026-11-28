# POLA · verdict indépendant de la ligne 33

**La mesure axiale et son réemploi entre les niveaux sont qualifiés sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et sur la révision du harnais `dfc144ce46139e887d0f48fff9ae3ac2d42d3c3d`. Six départs, **47 gestes par SHA** et un contraste construit par SHA. Les deux moteurs concordent, dont six tickets axiaux sur les 16 gestes du catalogue. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/ccfbc989/experiments/symbolic-situations/pola-ligne-33/CONTRAT.md)

- T3 atteste la sélection du corps (21,25). T4 choisit ACTION4 sur deux offres. Des cinq trames du vrai retour, seule la première est attribuée à l’ancienne scène. Les centres restent fixes dans cette comparaison et l’axe passe de (−1,0) à (0,1), soit le quart +1. Le gain officiel de N1 est enregistré séparément, avec `matched:null` sur l’action axiale.
- Retirer l’attestation ou tourner seulement l’axe du pair à l’entrée de la famille supprime les offres T4. Le service garde le plateau public et joue le repli (11,10). Au même vrai ticket T4, présenter un retour stationnaire n’acquiert aucune rotation et rend ACTION3 disponible.
- En N2, T8 emploie le quart portable de N1 pour départager deux offres à distance 2. ACTION4 donne réellement +1. Retirer le seul rappel à même entrée fait choisir ACTION3, qui donne réellement −1. Le score reste 1 après T8 dans les deux départs, puis 2 après T9. Un retour T8 stationnaire construit ne mesure aucun quart et déclenche ACTION3.
- Dans le contraste public construit `kernelCold`, l’a priori +1 rencontre un quart −1 mesuré. La mesure change la reprise par rapport au retrait. Permuter les offres déplace l’indice de choix et conserve la commande.

Verdict en **4 min 28 s**, au premier rejeu. Le contraste construit est exécuté séparément du vrai jeu.

## Rejeu

Sous Node 24, depuis ce dossier. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus
```
