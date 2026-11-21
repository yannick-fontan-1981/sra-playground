# Qualification de l’hypothèse morphologique de sélection du curseur

**Origine.** Yannick a proposé la règle : si une pièce porte une marque vive distinctive, que d’autres éléments ont la même forme et que le clic est disponible, supposer que cliquer sur un autre élément change le curseur. Cette hypothèse est apportée par l’utilisateur après v38. L’implémentation et le réglage sont contrôlés sur les jeux sources.

**Prédiction.** SIC compare les silhouettes sous translation, en tenant compte d’un point incrusté, d’une partie colorée ou d’une petite marque attenante. La comparaison utilise la palette visible. La commande cible un pixel de la pièce homologue. L’hypothèse annonce le déplacement de la marque. Pour établir le contrôle moteur, SIC vérifie le déplacement du corps du nouveau sujet et la stabilité de l’ancien. Une première direction bloquée laisse d’autres directions à essayer.

**Arbitrage.** Les commandes naturellement choisies par une autre stratégie peuvent établir la même connaissance. Quand SIC dispose d’une trajectoire en cours, il peut engager le test après plusieurs retours sans nouveau site ou deux directions bloquées. L’échec d’un essai est enregistré. Les formes de même couleur et celles dont les abords se ressemblent sont essayées en priorité.

**Comparaison enregistrée avant les essais Custom 4 de v40.** Utiliser le tag `sic-source100-marked-cursor-v40` et le même moteur que v38. Mesurer les neuf L2 ouverts à froid au plafond de 1 200 commandes. Enregistrer la victoire officielle, le motif d’arrêt, les prévisions de sélection, les transferts de marque et les changements de sujet vérifiés. Pour toute victoire supplémentaire, rejouer la partie et comparer la règle présente puis retirée. Vérifier séparément SS01 L2 en 32 avec les 19 commandes publiques de son L1, SS01 en 44 et SS04 en 60 à froid, les 100 L1 au plafond de 60 et les quatre témoins prioritaires. Conserver SS09 L2 pour la confirmation finale.

La capacité et sa qualification figurent à la ligne 1 du [registre des généralisations manquantes](generalisations-manquantes-custom4.md).
