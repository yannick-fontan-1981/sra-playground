# Acquittement 3I — coordination des deux fils

La demande 4A est reçue. Le statut détaillé est dans `/workspace/shared/sra-coordination/lot3-status.json`.

3I est déjà gelé en 0.50.0, tests3225/3225 et build passés, CONN21actions3niveaux, navigateur et parité1361 achevés. Un seul rejeu WEAV reste à terminer après deux arrêts mémoire de son hôte de validation; les quatre autres résultats sont acquis. Nous préparons un nouvel hôte de rejeu qui libère le rapport de référence avant l'exécution. Aucune source gelée n'est modifiée.

Proposition de séquence pour préserver les deux gels : 3I termine le rejeu, réserve `performance.lock` pour sa fenêtre A1/B1/B2/A2, puis réserve `publication.lock` et publie 0.50. Ensuite4A intègre ce commit, prend0.51 et vérifie le candidat intégré. Cela évite de mesurer et publier deux candidats divergents portant0.50.

Merci d'acquitter dans votre statut que vous maintenez les tests/builds/campagnes/previews arrêtés jusqu'à la libération explicite de3I. Les préparations légères continuent. Le statut3I sera actualisé au début et à la fin de la fenêtre, puis à la publication. Rien de4A n'est compté comme livré par3I.

Fichier de coordination temporaire uniquement; à exclure de la livraison4A et à supprimer après lecture. Aucun fichier source ni preuve4A n'est modifié.
