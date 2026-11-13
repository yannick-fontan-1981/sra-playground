# Revue indépendante du raccord au natif 0.61

Revue de source effectuée le 11 novembre 2026 par la voie Window family, après résolution des conflits de fusion. Aucun défaut de composition n’a été relevé dans le périmètre natif examiné.

## Inventaires réellement comparés

Le prédécesseur est le commit `653e40a4f45df8ec8c6bda005004c7cdb8df074a`, fourni comme publication réelle Site 98 / natif 0.61. Son statut de déploiement relève de l’observation de publication conservée à côté de cette note ; cette revue n’a interrogé aucun service de publication.

Le profil lu est exactement celui de `native_source()` dans `scripts/run-v53-campaign-proof.py` : fichiers `.ts`, `.json` et `.drm` sous `src/logos-engine` et `src/runtime`. Les octets du prédécesseur ont été lus depuis les objets Git ; les empreintes SHA-256 du candidat ont été calculées depuis le checkout, puis comparées au manifeste gelé `integrated-final-01/source-manifest.json`.

| Inventaire | Fichiers | Digest |
| --- | ---: | --- |
| Prédécesseur 0.61 | 306 | `f8d5097ab63a1c7464479afc5772724ee26578916a4f22a643a5f08f65c27279` |
| Candidat 0.62 | 310 | `74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12` |

Le manifeste gelé est cohérent avec son propre compte et son digest. Le candidat correspond exactement à ses 310 entrées : aucune différence. Par rapport au prédécesseur, 304 fichiers ont la même empreinte, quatre sont ajoutés, deux sont modifiés et aucun n’est supprimé.

## Différences de composition

Les quatre ajouts sont `v5-window-processing.ts`, `v6-window-question-geometry.ts`, `v6-window-question-policy.ts` et `v6-window-question.ts`, tous dans `src/logos-engine`. Ils correspondent aux quatre composants Window prévus et à leurs octets déjà gelés.

La différence complète de `v6-native-types.ts` ajoute uniquement l’argument optionnel courant `NativeExecution` en cinquième position de `NativeFamily.before`.

La différence complète de `v6-native-runtime.ts` contient la version 0.62, les déclarations d’adaptations Window, son instance unique, son enregistrement matériel et ses acquisitions. L’acquisition passive appelle `recordSource` une fois pour un retour étranger, avec `null` comme proposition, puis applique le prédicat source `edits || portable || attempts` pour la publication de l’état. Le chemin actif demeure distinct.

Les autres modifications du runtime transmettent le contexte courant aux gardes, traduisent la durée restante du délai appelant vers l’horloge du runtime et préservent le budget actif du niveau. L’adaptateur du caller transmet explicitement ses quatre arguments existants. Ces différences correspondent aux adaptations prévues ; aucun autre changement natif n’a été trouvé.

## Conservation de Preview et Workshop

Les quatre fichiers `v6-preview-packing*.ts` et les quatre fichiers `v6-ranked-workshop*.ts` conservent exactement leurs empreintes du commit 0.61. La lecture de la différence du runtime confirme le maintien de leurs propriétaires, de leurs inscriptions, de leurs acquisitions et des déclarations d’adaptations existantes. Window s’ajoute à leur composition ; aucun propriétaire du prédécesseur n’est retiré.

## Portée

Cette revue utilise seulement des lectures de source, des objets Git et des empreintes, sous verrou partagé non bloquant avec les verrous Git optionnels désactivés. Elle n’exécute ni jeu, ni test, ni application, ni original Python. Elle ne renouvelle aucun verdict de parité, de coût ou de publication. Aucun fichier gelé, source, test ou reçu existant n’a été modifié ; seule cette note est ajoutée pour documenter la revue du raccord.
