# SS24 — feuille de route de création

Le programme suit **25 jeux et 200 niveaux**. Ces compteurs mesurent la création des campagnes et leur livraison ; ils ne mesurent pas les capacités de résolution autonome de SRA.

| Repère | Jeux | Niveaux | Progression |
| --- | ---: | ---: | ---: |
| Avant SS24 : SS01 à SS23 livrés | 23 / 25 | 184 / 200 | 92 % |
| SS24 : création qualifiée, livraison suivie dans la PR 128 | **24 / 25** | **192 / 200** | **96 %** |
| Reste après clôture de SS24 | **1 jeu : SS25** | **8 niveaux** | **4 %** |

Les huit cartes de SS24 sont créées, synchronisées et vérifiées jusque dans Chrome Manual, du niveau 1 au niveau 8. La clôture de publication est attestée par le reçu de la [PR 128](https://github.com/yannick-fontan-1981/sra-playground/pull/128), avec les SHA GitHub/Site et la version effectivement publiée. La validation de création et la publication ne sont pas confondues.

## SS24 — Les Voies de Traverse

Composition : **Marchand / Voleur / Magicien / Barde**, ordre `M T Z B`, touches 1/2/3/4. Le tutoriel est N1 avec **37 découvertes**. Le Marchand pousse un occupant ; le Voleur tire uniquement son voisin arrière ; le Magicien échange avec la première cible ; le Barde entraîne un groupe selon sa portée initiale et les butées.

| Lot | Résultat observé |
| --- | --- |
| Moteur et pédagogie | **129 tests** réussis : 85 moteur/monstres et 44 pédagogiques, dont le parcours réel N1 et son exclusion hors tutoriel |
| Cartes et témoins | Huit cartes finales, **1 051 entrées**, 176 sélections, zéro refus ni décès |
| Diversité et revues | Aucun terrain identique parmi 80 cartes SS14–SS23 ; **92 contrôles** répartis dans cinq revues |
| Interface autonome | **42 configurations de rôles** et huit parcours réels dans le HTML compilé, pixels/durées/Undo contrôlés |
| Intégration native | **98 tests** Custom 4 / SS21 / SS22 / SS23 / SS24 réussis ; typecheck passé |
| Site et continuité | Build réussi, **124 jeux / 828 aperçus**, 41 niveaux de continuité SIC vérifiés |
| Navigateur | **Chrome Manual N1→N8**, 37/37 découvertes et panneau **VICTORY** ; Undo final puis reprise validés |
| Intégration canonique et publication | État final et concordance consignés dans le reçu de la **PR 128** |

Les huit parcours comptent **212, 154, 118, 85, 127, 122, 92 et 141 entrées**. Ils ne prétendent pas être optimaux ; plusieurs variantes gagnantes sont documentées. La [validation](validation.md) lie les mesures à leurs rapports et à l’empreinte de l’artefact. Le [README](../README.md) décrit les huit salles.

## Prochaine campagne

**SS25 : Guerrier / Voleur / Magicien / Barde**, sans Marchand. Ce dernier quatuor est prévu ; il n’est pas créé dans le lot SS24. Sa conception devra rechercher d’autres géométries et problèmes de coopération, à partir de l’inventaire désormais enrichi jusqu’à SS24.

## Reprise sans retour arrière

Le SHA `7ba57180f543b0954fc98d1f3f1e016c8f161508` et le Site 196 sont les repères historiques de SS23 à l’ouverture de SS24. Le premier checkpoint SS24 distant est `bcb3e0828472e0cee9cc6de31a7a4945ccd01951`. Ces repères ne sont ni des cibles de reset ni des versions à republier automatiquement.

Une reprise examine GitHub et le Site courants, conserve les campagnes ultérieures déjà livrées et ne diminue jamais les compteurs pour revenir à ce document historique. La PR conserve les SHA finaux sans imposer une référence circulaire à un document appartenant au commit lui-même. Le [prompt de reprise](codex-integration-prompt.md) applique ce principe.
