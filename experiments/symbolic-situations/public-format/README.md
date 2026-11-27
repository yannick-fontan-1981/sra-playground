# Export des fiches publiques

L’exporteur convertit une fiche Markdown de développement en un message initial `sra.public/1`. Il lit uniquement le texte de la fiche. Les deux frontaux reconnaissent les formulations publiées du cadran et de la ressource et produisent la même grammaire de commandes, de faits et de règles. Le choix du frontal se fait sur la syntaxe de la commande terminale. Les titres français ne participent pas à l’interprétation du JSON. [Contrat et provenance champ par champ](CONTRAT.md) · [Schéma JSON](schema.json)

## Deux exemples de développement

| Fiche source | Message consommable |
| --- | --- |
| [Cadran, graine de développement 107](../exemple/public/9fd1072013fd810d513c.md) | [dial.json](examples/dial.json) |
| [Ressource, graine de développement 17](../ressource/exemple/public/345436640366130fd8c3.md) | [resource.json](examples/resource.json) |

Depuis ce dossier, avec Node.js 20 ou ultérieur :

```powershell
node export.mjs ../exemple/public/9fd1072013fd810d513c.md --out dial.json
node export.mjs ../ressource/exemple/public/345436640366130fd8c3.md --out resource.json
```

Sans `--out`, le JSON est écrit sur la sortie standard. Le chemin `-` lit une fiche sur l’entrée standard. Le producteur termine avec une erreur si une règle nécessaire à la traduction manque ou si une phrase déclarative ne correspond pas à la grammaire couverte. Lorsqu’une observation facultative manque, le producteur peut encore exporter les autres déclarations et les règles qui y font référence. Par exemple, enlever la mesure du cycle courant laisse le fait courant sans observation, même si le relevé archivé reste présent. Le mot `absente` est réservé au constat d’absence de mesure dans la fiche en français.

## Vérifier

```powershell
node --test test.mjs
python verify_schema.py
```

La seconde commande utilise un interpréteur Python avec le paquet `jsonschema` prenant en charge le draft 2020-12. La production du JSON utilise uniquement la bibliothèque standard de Node.

| Propriété | Contrôle de développement |
| --- | --- |
| Provenance et forme | 12 fiches (8 cadrans et 4 ressources). Les lignes citées sont contrôlées textuellement, chaque règle désigne une commande proposée, et les 12 sorties passent le validateur JSON Schema indépendant. |
| Indiscernabilité | 6 paires de mondes, soit 12 rejeux publics. Dans chaque paire, les octets du message initial sont identiques et le geste de lecture rend deux valeurs distinctes. |
| Renommage | 12 bijections, une par fiche. L’égalité porte sur tout le message après substitution des objets dans les relations, conditions, effets, commandes et extraits. |
| Omissions | 132 suppressions, une par ligne citée de chaque fiche. Les 44 suppressions exportables retirent exactement les assertions qui citaient la ligne. Les 88 autres sont refusées. |
| Informations absentes | Des contrôles ciblent la mesure courante, l’archive, la case vierge, le tampon requis, l’état d’indexation et la distinction entre condition d’exécution et condition nécessaire au succès. |
| Messages altérés | Sur les deux exemples, le schéma rejette un plan ajouté à la racine, une stratégie ajoutée à une règle et une valeur ajoutée à une observation déclarée inconnue, soit six rejets. |

La qualification du gel Agenda `475044aa` demeure reproductible dans son répertoire d’origine. Ce lot livre uniquement l’export et ses contrôles de développement. [Reçu de la première mesure](../ressource/qualification/mesure-475044aa.json)
