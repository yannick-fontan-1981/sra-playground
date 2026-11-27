# Contrat public d’interaction

Tu reçois une fiche de situation. À chaque tour, donne une seule commande parmi celles de la fiche en remplaçant les identifiants exactement comme ils sont écrits. Attends le retour avant de choisir la commande suivante.

L’opérateur renvoie une ligne pour la commande jouée. Un relevé est une observation disponible dès ce retour. Une saisie refusée renvoie `Action indisponible.` et laisse l’état inchangé. Une action matérielle peut terminer immédiatement la partie par l’incident décrit dans la fiche. Le scellement termine également la partie et renvoie `succès` ou `échec`.

Le but et le coût sont ceux de la fiche. Chaque nouvelle partie débute avec sa seule fiche initiale.
