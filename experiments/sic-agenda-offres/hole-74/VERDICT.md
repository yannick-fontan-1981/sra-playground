# Verdict HOLE · ligne 74

Le catalogue `8ce7ee35` et le gel `d0e7527c` donnent les mêmes familles, commandes et paquets sur 16 gestes. Les cinq premiers gestes relèvent de `containment`. Le ticket historique est N1/T6 `public_topological_recolor / topological_recolor / OP18`, ACTION6 (22,59). Il teste un puits. L'autorisation de peindre arrive au geste suivant.

| Situation | Décision et preuve publique |
|---|---|
| N1/T6, pigment actif 14 | La légende lie les régions à zéro poche fermée au pigment 9 et celles à une poche au pigment 10. Les trois offres de puits sont [9,10,9] dans l'ordre des régions. Cette relation utilise la connexité à quatre voisins du complément de la région. Le service sélectionne le premier puits 9. |
| Retour réel T6 | 44 pixels modifiés dans l'enveloppe des puits, aucun au-dehors. Le nouvel indicateur actif vaut 9. Les deux références du retour bornent la méthode de sélection, avec effet inconnu avant le geste. |
| T6 avec retour stationnaire ou pixel extérieur seul ajouté | Le stationnaire change zéro pixel. Le pixel extérieur donne 45 changements, dont un hors enveloppe. Aucun des deux ne confirme la méthode. Le premier propose l'autre pigment 10 au T7, le second propose encore le puits 9. Dans les deux cas, aucune peinture T7 n'est justifiée. |
| N1/T7–T8 nominal | Le service revalide la forme des puits et l'indicateur, puis choisit les régions à zéro poche en (18,14) et (20,32). Les retours mesurent 133 et 95 pixels recolorés en 9, dans chaque région et sans effet extérieur. |
| Pixel (36,11) présenté ouvert à partir de l'observation T6 | Même légende, mêmes deux gestes T6–T7. La poche de 12 pixels de la région [36,8,51,15] rejoint l'extérieur par quatre voisins. Sa relation passe de 1 à 0 et sa cible de 10 à 9. Dès T8 le service choisirait la peinture de cette région en (43,11) avec le pigment 9, avant l'autre région. Le vérificateur arrête cette branche avant le geste différent. |
| N1/T9–T10 nominal | Le service sélectionne 10 puis peint la région [36,8,51,15]. Le niveau avance officiellement après le vrai T10. Le reçu pose une frontière de niveau. |
| N2/T16 nominal | La nouvelle légende donne 0→9, 1→14, 2→11. Le pigment 14 est actif, la méthode de sélection N1 est revalidée par la nouvelle géométrie des puits. Le geste (43,7) peint 89 pixels dans la région à une poche. |

`measure` dans `v6-topological-recolor-geometry.ts` établit la correspondance de voisinage à partir des poches et de la légende. `TopologicalRecolor.offers` prépare les offres avant `RecolorPolicy.choose`. Le service consomme les variantes de puits ou de peinture, tandis que `before`, `after` et `recordSource` lient leur portée et les retours au contexte courant. La reprise après le puits dépend d'une preuve de sélection, la reprise après la peinture dépend d'une nouvelle mesure. Le reçu du changement local garde l'acceptation officielle séparée.

Cinq préfixes et 102 tests passent. Le contrôle d'ouverture en développement a été prolongé de T6 à la première divergence, puis arrêté avant la commande T8 au lieu de prolonger la construction après une peinture différente. Durée du préenregistrement au reçu 8 min 39 s. Harnais `4f39c40869cdb3c2881d4fef01d3a7eafaf196dd`. Reçu local `artifacts/qualification-hole-74/4f39c408.json`, SHA-256 `b9e082078b17edbb6022e92845a0650f108f9d26fb926bb96e4c1aa60e26621b`. [Commande de rejeu](README.md).
