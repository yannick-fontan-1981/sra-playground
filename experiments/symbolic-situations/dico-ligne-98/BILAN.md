# DICO · ligne 98 · arbitrage de l'ouverture

**Le gel choisit déjà la cible présentant le plus de relations distinctes.** Le gel `d0e7527c`, le parent `c0b9f402` et le candidat `e2178163` donnent les mêmes propositions, gardes et reçus nominaux. Le candidat rend substituable l'arbitrage de `selectOpeningOffer` dans le parcours natif. [Préenregistrement](CONTRAT.md) · [Reçu comparatif](recu.json)

| Jeu et condition | Offres de même rang | Maximum | Ex æquo | Ticket | Retour physique |
| --- | ---: | ---: | ---: | --- | --- |
| DICO L1, actif | 147 | 12 | 4 | (25,36) | Niveau 1 terminé |
| DICO L1, actif, deuxième maximum préféré sur branche | 147 | 12 | 4 | (32,35) | Niveau 1 en cours |
| DICO L2, après l'ouverture ordinaire du mode actif | 228 | 13 | 2 | (13,12) | Niveau 2 en cours |

Le contrôle sur branche échange uniquement la position des deux premiers maxima dans l'appel au sélecteur. Le sceau des 147 entrées avant intervention reste identique. Le jeu exécute un autre ticket, et le besoin effectivement assigné à cet autre point est observé. Les résultats physiques diffèrent malgré le même score d'information. Les deux reçus d'essai portent `unknown_effect_observed` et `matched=null`.

**Trois cibles indépendantes.** Dans notre développement, A=(12,12), B=(32,38) et C=(52,15). Les comptes de voisinage sont 2, 2 et 1. Ajouter seulement un voisin à droite de B donne 2, 3 et 1 et déplace le clic de A vers B. Retirer ce point reproduit exactement le reçu initial. Ajouter un second voisin de même forme et couleur du même côté laisse les comptes à 2, 2 et 1. Le mode shadow conserve le clic ordinaire tout en exposant la recommandation enrichie. Ces résultats sont aussi vérifiés sur des coordonnées et couleurs réservées. L'oracle relit directement la fiche de pixels et rejette le double comptage d'une relation.

**Autres propriétaires.** Sur DICO L1 en shadow, la cible riche reste (25,36), mais le ticket (1,3) garde le premier niveau en cours. Sur MEMO L1 en mode actif, `public_occurrence_recall` libère (31,30) et la sélection d'ouverture n'est jamais appelée.

**Dénominateurs.** Pour chacune des trois révisions : cinq lectures de développement et cinq réservées au fournisseur, dont une restauration et une lecture shadow par partition. Trois sessions de jeu distinctes délivrent quatre tickets au total (deux DICO actif, un DICO shadow, un MEMO). Un départ réel supplémentaire sur le candidat éprouve le départage substitué. Le crédit de choix nominal remonte au gel ; le raccordement dont le remplacement a modifié le ticket est attesté sur branche.

## Rejeu

Depuis ce répertoire, avec Node 24, Git et `tar`. Employer des noms de reçus neufs.

```powershell
$sha = 'e21781637371b846c60aa50de5ff080c136c9abf'
$pyodide = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
node situations.mjs nouvelle
node fiches.mjs $sha "$env:TEMP/98-fiches.json"
node jeu.mjs $sha DICO active $pyodide "$env:TEMP/98-dico.json"
node jeu.mjs $sha DICO active $pyodide "$env:TEMP/98-autre-maximum.json" autre
node jeu.mjs $sha MEMO active $pyodide "$env:TEMP/98-memo.json"
```

La première commande produit une fiche `sic.ouverture/1` pour l'opérateur public. [Situations](situations.mjs) · [Évaluateur des jeux](verifier.mjs)
