# CGWL · verdict indépendant de la ligne 37

**Le sondage du corps, la reprise et l’attache locale sont qualifiés sur le gel dans leur portée visible.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et sur la révision du harnais `beb11112bc53afdb80d46b843f42d01474254126`. Sept départs et **55 gestes par SHA**, avec parité. Quinze tickets de la famille sur les 16 gestes du catalogue. Trois scénarios construits et 57 retours supplémentaires par SHA. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/a360761e/experiments/symbolic-situations/cgwl-ligne-37/CONTRAT.md)

- Le T1 identifie le corps de couleur 15 et d’aire 32. Le T2 a cinq commandes exploratoires. ACTION2 relie son déplacement physique (0,+4) aux deux observations et ne produit aucune attache. Le déplacement permet l’approche confirmée T3–T8. Retirer l’identité ou la correspondance replie à la frontière au T2. Retirer le déplacement seul au T3 remet une question ACTION3.
- T12 ACTION5 donne une seule relocalisation de la partie visible compatible avec (−1,−6). Le reçu natif énumère **20 points de premier plan distincts** et 21 points inobservables. L’attache reste une hypothèse à côté d’une relocalisation indépendante. Le T13 utilise ses deux références pour l’approche de réception ACTION4. Retirer l’attache, avec l’interaction et le plateau conservés, donne ACTION5 de sondage. Un retour T12 stationnaire n’acquiert aucune attache et choisit ACTION7.
- T14 réfute et scelle le pas prévu. Il acquiert un mouvement conjoint de portée non rigide. T15 repart de l’état remesuré. Aucun gain officiel au plafond de 16 gestes.
- Dans les scénarios construits, deux relocalisations compatibles laissent le besoin en attente, sans objet lié. Deux retours à la même commande de séparation ACTION3 confirment ou réfutent la réception. Les reprises diffèrent, ACTION3 après confirmation et ACTION4 après réfutation.

Verdict en **6 min 2 s**. Le vrai jeu a été rejoué au premier lancement. Le montage du contraste a été relancé avec ses deux fichiers de provenance. Le comptage vérifié de 20 points distincts précise le décompte de 19 du verdict local.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node contraste.mjs d0e7527ca8033bd805a6d7a8bb021eff62e87021 "$reçus/gel.contraste.json"
node contraste.mjs beb11112bc53afdb80d46b843f42d01474254126 "$reçus/candidat.contraste.json"
node verifier.mjs $reçus
```
