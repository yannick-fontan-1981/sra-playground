# Qualification aveugle d’Agenda sur la réserve

**Six départs tentés, six incompatibilités à la lecture de la fiche, zéro commande proposée.** La mesure porte sur l’interface publique du gel Agenda `475044aa609fe2934101b6286a96ae544aa24250`, avec les situations du gel `fa6270875cd2341ac969ba5e3ab2bb5a9db0d5dc`.

**Protocole public de mesure.** À chaque départ, l’opérateur ouvre un processus neuf avec le même exécutable. Il lui transmet la fiche dans le champ `fiche`. Le solveur répond par une seule `action` et attend le champ `retour` avant sa décision suivante. Il peut signaler `incompatible` dès l’initialisation. L’opérateur conserve le premier écart et compte séparément les admissions, les gestes réellement exécutés et les verdicts terminaux. La sélection du monde reste du côté opérateur.

| Mesure | Résultat |
| --- | ---: |
| Fiches distinctes / départs indépendants | 4 / 6 |
| Fiches refusées à l’initialisation, comptées par départ | 6 |
| Commandes proposées / exécutées / refusées en cours de jeu | 0 / 0 / 0 |
| Succès terminaux / échecs terminaux d’action | 0 / 0 |
| Interruptions techniques | 0 |

Le premier écart est le même aux six départs. Le constructeur livré `PartiePublique(markdown)` lève `Contrat public non reconnu` avant l’appel à `next()`. Le lanceur d’origine désigne la fiche du cadran par un nom fixe. Le branchement opérateur lui substitue uniquement le transport de la fiche et des retours, puis appelle le constructeur et les méthodes de l’adaptateur extrait du commit. Chaque départ utilise les mêmes octets de solveur et repart dans un processus neuf. [Interface au gel](https://github.com/yannick-fontan-1981/sra-playground/blob/475044aa609fe2934101b6286a96ae544aa24250/experiments/sic-agenda-offres/transfert/fiche-publique.mjs)

En contrôle positif, ce même transport et ce même solveur atteignent `succès` en quatre actions dans chacun des deux mondes du cadran d’origine. Un exécutable témoin reçoit un refus en tentant de lire un fichier privé. Il reçoit ensuite uniquement la fiche et les retours de ses propres commandes. Les tests distinguent une saisie refusée, un échec terminal et une incompatibilité initiale.

Cette mesure localise le premier obstacle à l’admission de la fiche. La planification de cette famille après admission reste à mesurer. Toute adaptation ultérieure se développe sur le jeu de développement avant une nouvelle mesure identifiée par son propre commit. [Contrat public d’interaction](../INTERACTION.md)
