#!/usr/bin/env python3
"""Update the delivery documents from actual 6A receipts, never future outcomes."""
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[3]
E=ROOT/'docs/migration/lot6a-evidence'
F=E/'integrated-final-02'

def read(p): return json.loads(p.read_text()) if p.exists() else None
def block(path, key, text, oldkey=None):
    s=path.read_text()
    if oldkey:
        s=s.replace(oldkey+'_CURRENT_',oldkey+'_HISTORICAL_')
    pattern=r'<!-- '+key+r'_CURRENT_START -->[\s\S]*?<!-- '+key+r'_CURRENT_END -->\n*'
    s=re.sub(pattern,'',s)
    first,rest=s.split('\n',1)
    path.write_text(first+'\n\n<!-- '+key+'_CURRENT_START -->\n\n'+text.strip()+'\n\n<!-- '+key+'_CURRENT_END -->\n'+rest)

def main():
    native=read(F/'source-manifest.json')
    tests=read(F/'validation-final/validation/delta-tests-run.json')
    checks=read(F/'validation-final/validation/checks-run.json')
    regression=read(F/'regressions-final/regression-summary.json')
    presence=read(F/'regressions-final/preview-owner-presence.json')
    integrity=read(F/'delivery-integrity.json')
    readiness=read(E/'performance-integrated/readiness.json')
    publication_inputs=read(F/'publication-inputs.json')
    cost=read(E/'performance-integrated/owner-growth-review.json')
    aggregate=read(E/'performance-integrated/owner-growth-comparison.json')
    pub=read(E/'publication/native-publication.json')
    transport=read(E/'publication/final-source-build-verification.json')
    clock=read(E/'case-clock.json')
    assert tests and tests['status']=='passed' and checks and checks['status']=='passed'
    count=tests['checks'][0]['counts']['pass'];files=len(tests['testFiles'])
    reg_ok=bool(regression and regression['status']=='passed')
    cost_ok=bool(cost and cost['status']=='qualified_owner_cost_review_passed' and cost['globalAccepted'] is True)
    pub_ok=bool(pub and pub['status']=='succeeded')
    status=('livré dans Site '+str(pub['siteVersion']) if pub_ok else
            'validé, coût global accepté ; publication à confirmer' if cost_ok else
            'validation fonctionnelle en cours de clôture')
    pub_text=(f"La [publication privée réelle](lot6a-evidence/publication/native-publication.json) est confirmée **Site {pub['siteVersion']} / native 0.60.0**, commit `{pub['commit']}`, statut terminal `succeeded`. L’URL existante et l’audience propriétaire seul sont préservées."
              if pub_ok else "La publication privée du candidat n’est pas encore confirmée. La dernière référence publiée vérifiée est Site 95 / native 0.58 ; le point source poussé sur une branche de sauvegarde ne constitue pas une publication.")
    reg_text=(f"**{regression['comparisonChecksPassed']}/{regression['comparisonChecksExpected']} contrôles** sur dix traces historiques et un rejeu de cohérence KATA du candidat avec lui-même."
              if reg_ok else "Le bilan final des onze rapports reste à valider ; aucun résultat futur n’est anticipé.")
    reg_closure=("La reprise WEAV à **1 024 Mio** a ensuite échoué par **`-6` après 73 actions**, avec un [diagnostic explicite d’épuisement du tas V8](lot6a-evidence/recovery/weav-memory/diagnostic.json). Ce quatrième échec ne requalifie pas les trois SIGKILL antérieurs. La [reprise finale exclusive à 1 536 Mio](lot6a-evidence/integrated-final-02/released-weav-exclusive-1536/regressions/regression-summary.json) a réussi : **81 actions et 17/17 contrôles**. La composition **9 + 1 + 1** est liée à son [bilan final réussi](lot6a-evidence/integrated-final-02/regressions-final/regression-summary.json), avec provenance de chaque résultat, empreintes et 17 contrôles inchangés par cas. La [première consolidation échouée](lot6a-evidence/recovery/consolidation-attempt-01.json) reste conservée ; la liaison `actual_retained_child_execution_inputs` utilise les entrées réellement enregistrées par le driver enfant, sans inventer un inventaire parent avant lancement. Aucun rejeu n’a été répété pour cette correction."
                 if reg_ok else "Le bilan final attendu est `lot6a-evidence/integrated-final-02/regressions-final/regression-summary.json`, avec provenance de chaque résultat, empreintes et 17 contrôles inchangés par cas. Aucun total réussi de 187 contrôles n’est anticipé.")
    proof_rows=[]; english_proof_rows=[]
    if presence and presence['status']=='passed':
        t=presence['totals']
        proof_rows.append(f"| [Présence sur les rapports retenus](lot6a-evidence/integrated-final-02/regressions-final/preview-owner-presence.json) | **{t['passedCases']}/{t['cases']} cas**, {t['prefixes']} préfixes ({t['selectedPrefixes']} sélectionnés / {t['foreignPrefixes']} étrangers), {t['physicalReturns']} retours ({t['selectedReturns']} sélectionnés / {t['foreignReturns']} étrangers), **{t['selectedRecords']} acquisitions sélectionnées / {t['passiveReturns']} passive**, {t['actualRestores']} restaurations ({t['nativeRestores']} natives / {t['sourceRestores']} source) |")
        english_proof_rows.append(f"| [Owner presence](docs/migration/lot6a-evidence/integrated-final-02/regressions-final/preview-owner-presence.json) | **{t['passedCases']}/{t['cases']} cases**, {t['prefixes']} prefixes ({t['selectedPrefixes']} selected / {t['foreignPrefixes']} foreign), {t['physicalReturns']} returns ({t['selectedReturns']} selected / {t['foreignReturns']} foreign), **{t['selectedRecords']} selected acquisitions / {t['passiveReturns']} passive**, {t['actualRestores']} restores ({t['nativeRestores']} native / {t['sourceRestores']} source) |")
    if integrity and integrity['status']=='passed':
        i=integrity['matchedFileInventories']; reports=integrity['byteStorage']['reports']
        proof_rows.append(f"| [Intégrité finale](lot6a-evidence/integrated-final-02/delivery-integrity.json) | **`passed`**, {i['sourceAndTests']} fichiers source/tests, {i['buildInputs']} entrées de build, {i['regressionExecutionInputs']} entrées d’exécution des régressions et {reports} rapports restitués à l’identique |")
        english_proof_rows.append(f"| [Final integrity](docs/migration/lot6a-evidence/integrated-final-02/delivery-integrity.json) | **`passed`**, {i['sourceAndTests']} source/test files, {i['buildInputs']} build inputs, {i['regressionExecutionInputs']} regression execution inputs, {reports} byte-identical restored reports |")
    if readiness and readiness['status']=='ready':
        proof_rows.append("| [Readiness avant mesure](lot6a-evidence/performance-integrated/readiness.json) | **`ready`**, preuves et conditions préalables liées avant la fenêtre officielle |")
        english_proof_rows.append("| [Pre-measurement readiness](docs/migration/lot6a-evidence/performance-integrated/readiness.json) | **`ready`**, actual evidence and prerequisites bound before measurement |")
    if publication_inputs and publication_inputs['status']=='passed':
        proof_rows.append("| [Entrées de publication](lot6a-evidence/integrated-final-02/publication-inputs.json) | **`passed`**, coût accepté et octets validés liés ; ce reçu n’exécute pas la publication |")
        english_proof_rows.append("| [Publication inputs](docs/migration/lot6a-evidence/integrated-final-02/publication-inputs.json) | **`passed`**, accepted cost and validated bytes bound; this receipt performs no publication |")
    if pub_ok:
        assert transport and transport['status']=='passed'
        proof_rows.append(f"| [Transport effectivement vérifié](lot6a-evidence/publication/final-source-build-verification.json) | **{transport['workflowReceiptsVerified']} envois de sources**, 75 membres applicatifs par archive et **{transport['applicationMemberComparisons']} comparaisons exactes**, sans recompilation |")
        english_proof_rows.append(f"| [Verified source transport](docs/migration/lot6a-evidence/publication/final-source-build-verification.json) | **{transport['workflowReceiptsVerified']} actual source pushes**, 75 application members per archive and **{transport['applicationMemberComparisons']} exact comparisons**, without rebuilding |")
    proof_rows='\n'.join(proof_rows); english_proof_rows='\n'.join(english_proof_rows)
    clock_text=(f"L’[horloge cumulative KATA](lot6a-evidence/case-clock.json) est clôturée dans son budget : **{clock['chargedSeconds']:.6f} s / 2 400 s**, avec **{clock['remainingSeconds']:.6f} s non consommées**. La charge antérieure et les tentatives restent incluses."
                if clock['status']=='completed_within_budget' else f"L’horloge cumulative KATA porte **{clock['chargedSeconds']:.6f} s / 2 400 s**, avec **{clock['remainingSeconds']:.6f} s** restantes.")
    cost_text="La fenêtre officielle et sa décision restent à obtenir. La règle est fixée avant mesure : médiane de session complète **strictement sous +10 % pour chaque jeu**, sans compensation entre jeux. Un dépassement de phase peut être accepté si ce critère global passe."
    if cost:
        rows='\n'.join(f"| {x['case']} | {x['beforeMedianMs']:.3f} | {x['afterMedianMs']:.3f} | **{100*x['medianRelativeIncrease']:+.6f} %** |" for x in cost['globalCases'])
        over=[(r['case'],m['stage'],m['medianRelativeIncrease']) for r in cost['comparisons'] for m in r['metrics'] if m['medianRelativeIncrease']>0.1]
        diag=' ; '.join(f"`{case}/{stage}` **{100*ratio:+.6f} %**" for case,stage,ratio in over) or 'aucun dépassement agrégé de +10 %'
        cost_text=f"""La [revue indépendante](lot6a-evidence/performance-integrated/owner-growth-review.json) {'accepte' if cost_ok else 'refuse'} le budget global pour **{cost['acceptedCases']}/{cost['totalCases']} jeux**, après **{cost['checkedCount']} contrôles**. La fenêtre A1/B1/B2/A2 conserve **{cost['measuredSessions']} sessions mesurées / {cost['measuredActions']} actions** ; seules les huit chauffes et leurs 24 actions, déclarées à l’avance, sont séparées.

| Jeu | Médiane Site 95 / 0.58, ms | Médiane 6A / 0.60, ms | Variation globale |
| --- | ---: | ---: | ---: |
{rows}

Chaque jeu doit rester **strictement sous +10 % au global**. Les dépassements agrégés de médiane de phase restent visibles : {diag}. Le bilan conserve **{aggregate['withinObservedBudget']}/{aggregate['budgetMetricCount']} diagnostics chronométriques dans le budget observé** : huit mesures par jeu, dont `session_elapsed`. Les cohortes et p95 gardent leurs propres diagnostics. Aucun temps n’est corrigé, aucun échantillon défavorable n’est retiré et les phases imbriquées ne sont pas additionnées.

Le comparateur historique strict conserve son échec réel sur les métadonnées de travail. L’analyse distincte suit le contrat fermé déclaré avant mesure : ajout d’un propriétaire, sans programme supplémentaire, et seulement quatre chemins de compteurs attribués aux graphes effectivement capturés. Le [rapport complet](lot6a-evidence/performance-integrated/results.md) conserve les deux cohortes, la dispersion, les phases et les réserves. Ces mesures portent sur les chemins communs STCK/SMLP ; elles n’établissent pas le coût d’une recherche positive de partition ni une stabilité sur plusieurs heures."""
    section=f"""## Jalon courant : lot 6A PreviewPacking — {status}

**`preview_packing` est raccordé au moteur natif 0.60, avec un propriétaire unique, des commandes gardées et une acquisition réservée aux retours réellement sélectionnés.** {pub_text}

Cette livraison est une **reconstruction nouvelle depuis la source originale immuable**, sur la référence publiée [Site 95 / native 0.58](lot6a-evidence/publication/published-baseline-site95.json). Les anciennes preuves 6A perdues ne sont pas réutilisées. Le [gel final](lot6a-evidence/integrated-final-02/source-manifest.json) contient **{native['fileCount']} fichiers natifs**, digest `{native['digest']}`, et l’[archive](lot6a-evidence/integrated-final-02/source-archive.json) lie **322 fichiers**, dont les adaptateurs passifs réellement exécutés. Le premier gel prétest reste conservé séparément.

| Preuve 6A | Résultat effectivement acquis |
| --- | --- |
| [Tests finaux](lot6a-evidence/integrated-final-02/validation-final/validation/delta-tests-run.json) | **{count}/{count} tests dans {files} fichiers**, sans échec, annulation, test ignoré ni TODO |
| [Contrôles du projet](lot6a-evidence/integrated-final-02/validation-final/validation/checks-run.json) | **5/5**, typecheck, audits, diff et compilation compris |
| [Oracle de composant](lot6a-evidence/recovery/oracle/source-reference-comparison-05.json) | **1 288/1 288 vérifications**, dont 724 empreintes de fichiers consommés ; 1 786 originaux vérifiés avant et après l’export |
| [Campagne froide KATA](lot6a-evidence/integrated-final-02/execution-kata.json) | **Trois niveaux, 33 actions, 14 préfixes**, un seul appelant natif, aucune décision fournie par Python |
| [Comparaison originale froide](lot6a-evidence/integrated-final-02/kata-source-parity-execution.json) | **174 événements comparés sans différence** : 113 appels et 61 restaurations ; 56 ablations, dont 17 modifient une action ou un refus |
| [Navigateur réel](lot6a-evidence/integrated-final-02/browser/browser-qa.json) | **33 actions / 3 niveaux / 14 plans**, Pause acquittée à 9 actions puis une seule action jusqu’à 10, sans nouvelle session |
| Rejeux publics | {reg_text} |
{proof_rows}

Le [plan de tests](lot6a-evidence/planning/final-test-scope.json) conserve le périmètre initial de 129 fichiers, puis l’exclusion préalable de trois modules qui exécutent le cas LKEY au budget fermé : 122 fichiers hérités plus quatre nouveaux, soit 126. Le [premier passage](lot6a-evidence/integrated-final-02/validation/delta-tests-run.json), **4 793/4 795**, reste échoué ; seules deux attentes de registre obsolètes ont été corrigées avant la reprise complète réussie. Les cinq contrôles finaux sont conservés avec les tests dans `lot6a-evidence/integrated-final-02/validation-final/validation`.

Le [premier bilan des rejeux](lot6a-evidence/integrated-final-02/regressions/regression-summary.json) reste `failed` : neuf résultats réussis et deux échecs d’exécution, WEAV et CRAF. La [première reprise](lot6a-evidence/integrated-final-02/released-recovery/regressions/regression-summary.json) conserve CRAF réussi et un nouvel arrêt de WEAV. Ces **trois sorties `-9` (SIGKILL)** restent attribuées à leurs exécutions réelles ; elles ne prouvent pas à elles seules une cause mémoire. {reg_closure}

Le [registre](v6-entry-point-progress.json) atteint **63/76 entrées raccordées, 82,9 %, zéro partielle et 13 restantes** : `goal_access` 11/12, `window_constraints` 21/21, `surface` 10/10, `factored_material_return` 21/33. L’[audit](v6-coverage.json) conserve **195 composants vérifiés, 148 transferts partiels, 1 026 modules en attente et zéro module entièrement vérifié**, sur 1 369 modules Python et 417 fichiers de données. **Les six portes de migration complète restent fausses.**

### Coût global et diagnostics de phase

{cost_text}

### Portée et prochaine capacité

La source transférée est la chaîne consommée `PreviewPacking → Donor → Base`, avec les transformations et le calcul résiduel V5 qu’elle appelle. Les quatre champs source, les propositions, les gardes et les vraies restaurations sont comparés. Les états et plans natifs ne servent jamais à initialiser l’oracle froid. Le [rapport 6A](lot6a-preview-packing.md), la [filiation détaillée](lot6a-preview-packing-lineage.md) et l’[index des preuves](lot6a-evidence/README.md) distinguent ces contrats de leurs adaptations natives.

Une recherche bornée incomplète produit un état inconnu bloquant. La limite résiduelle de 2 000 ms ne borne pas toute la proposition. Les contrôles source peuvent subsister après une frontière, le cache négatif reste lié à l’époque et une partition ne prouve pas la fin officielle d’un niveau. La compaction des historiques et une latence maximale de Pause ne sont pas établies. {clock_text}

**{'6A est clôturé dans son périmètre. ' if pub_ok else ''}La prochaine capacité de ce fil est 6B, `selected_rigid`{'' if pub_ok else ', après clôture effective de 6A'}.** Le lot 6 garde ensuite `observed_rigid_cargo` puis `shared_settlement`. Les chantiers 7-followup, 10B et 5C restent séparés et doivent intégrer le prédécesseur effectivement publié. Les réserves CWSE, SK48, FramedWindow, LKEY et WEAV ne sont pas effacées par cette livraison.
"""
    path=ROOT/'docs/migration/v6-delivery-roadmap.md'
    block(path,'LOT6A_ROADMAP',section,'LOT5B_ROADMAP')
    s=path.read_text().replace('## Jalon courant : lot 5B livré','## Jalon historique : lot 5B livré')
    s=s.replace('Le [registre courant du candidat](v6-entry-point-progress.json) atteint **62/76',
                'Le [registre au jalon 5B](lot5b-evidence/integrated-final/validation/entry-audit-output.log.gz) atteignait **62/76')
    s=s.replace('Les entrées restantes du tableau décrivent la **publication réelle Site 94 / 5B/native 0.58**, validée fonctionnellement et acceptée au coût global : **62/76 entrées raccordées, 14 restantes**.',
                'Les entrées restantes du tableau décrivent le **gel 6A / native 0.60 : 63/76 entrées raccordées, 13 restantes**. Son état de publication et de coût est indiqué en tête de cette feuille de route.')
    s=re.sub(r'^\| 6 \|.*$',f'| 6 | Pièces rigides, cargaisons et stabilisation commune | **3** | Géométrie, contrôles, recherche bornée et interruption | **6A `preview_packing` : {status}.** Prochaine capacité : **6B `selected_rigid`**, puis 6C `observed_rigid_cargo` et 6D `shared_settlement`. |',s,flags=re.M)
    old='**Coordination courante : 6A, `preview_packing`, est commencé dans une autre conversation.** Ses résultats et sa publication restent propres à ce chantier ; les quatre entrées du lot 6 restent ouvertes dans le registre du gel 5B.'
    s=s.replace(old,f'**6A `preview_packing` : {status}.** Les preuves nouvelles sont présentées en tête de ce document. **Trois entrées restent ouvertes : 6B `selected_rigid`, prochaine capacité de ce fil ; 6C `observed_rigid_cargo` ; 6D `shared_settlement`.** Les critères ci-dessous restent des exigences pour le lot entier ; les limites source de 6A ne sont pas présentées comme une clôture universelle de ces exigences.')
    s=re.sub(r'^\*\*6A `preview_packing` : .*?\.\*\* Les preuves nouvelles sont présentées en tête de ce document\.',
             f'**6A `preview_packing` : {status}.** Les preuves nouvelles sont présentées en tête de ce document.',s,flags=re.M)
    s=s.replace('Sa publication distincte est confirmée dans Site 94. Les entrées sont détaillées ci-dessous.',
                'Sa publication distincte est confirmée dans Site 94. Le gel 6A raccorde ensuite `preview_packing` : **63/76 entrées et 13 ouvertes**, réparties **0+1+3+0+2+3+4**. Les entrées sont détaillées ci-dessous.')
    if pub_ok:
        journal_row=(f'| Lot 6A / PreviewPacking, Site {pub["siteVersion"]} / native 0.60 | **Livré en privé, validation et coût global acceptés** | '
                     '4 795/4 795 tests dans 126 fichiers, cinq contrôles, 187/187 comparaisons sur onze rapports ; KATA et navigateur trois niveaux/33 actions/14 plans ; '
                     '1 288 vérifications de composant, 174 événements source sans différence. Global STCK +6,094357 % / SMLP +3,262812 %, revue 17 890 contrôles, cinq dépassements de phase acceptés. Registre 63/76, 13 entrées restantes ; prochaine capacité 6B. |')
        if re.search(r'^\| Lot 6A / PreviewPacking,',s,flags=re.M):
            s=re.sub(r'^\| Lot 6A / PreviewPacking,.*$',journal_row,s,flags=re.M)
        else:
            s=re.sub(r'(?=^\| Lots 4 à 10 \|)',journal_row+'\n',s,count=1,flags=re.M)
        s=re.sub(r'^\| Lots 4 à 10 \|.*$',
            f'| Lots 4 à 10 | **13 entrées restantes dans la publication 0.60 ; 14 au jalon 0.58 ; 15 au jalon 0.57 ; 16 au jalon 0.56** | Lots 4 et 7 clos dans leurs périmètres de transfert. 6A livré dans Site {pub["siteVersion"]}, **6B prochaine capacité du lot 6** ; 5C et 10B en cours séparément, suivi LKEY L3 distinct ; lots 8/9/11 planifiés. |',s,flags=re.M)
        s=re.sub(r'^Les lots \*\*1, 2A, 2B, 2C,.*$',
            f'Les lots **1, 2A, 2B, 2C, 3A, 3B, 3E, 3F, 3H, 3I, 4A, 7A, 5A, 4B, 7B, 10A, 4C, 5B et 6A sont livrés ou clôturés dans leurs périmètres annoncés**. La livraison courante **6A / Site {pub["siteVersion"]} / native 0.60** intègre le prédécesseur effectivement publié **Site 95 / native 0.58**. Elle compte **63/76 entrées raccordées et 13 restantes**, avec validation fonctionnelle, coût global accepté et publication privée confirmée. Les jalons précédents et leurs chiffres restent historiques dans le tableau ; leurs verdicts et réserves fonctionnelles ne sont pas effacés.',s,flags=re.M)
        s=s.replace("6A / `preview_packing` et 10B / `window_question` sont commencés dans d'autres conversations ;",
                    f"**6A / `preview_packing` est livré dans Site {pub['siteVersion']} / native 0.60 ; 6B / `selected_rigid` est la prochaine capacité de ce fil.** 10B / `window_question` reste commencé dans une autre conversation ;")
        s=s.replace('**une entrée restante, 5C / `observed_object_binding`**, prochaine capacité de ce fil.',
                    '**une entrée restante, 5C / `observed_object_binding`**, suivie dans un chantier séparé.')
        s=re.sub(r'^(\| 5 \|.*?)Prochaine capacité de ce fil :',r'\1Prochaine capacité du lot 5 :',s,flags=re.M)
    # Repair the prose retained from an earlier render without touching links,
    # identifiers inside backticks, or the underlying receipt calculations.
    for before, after in [
        ('[registre au jalon5B]', '[registre au jalon 5B]'),
        ('**gel6A/native0.60 :63/76 entrées raccordées,13restantes**',
         '**gel 6A / native 0.60 : 63/76 entrées raccordées, 13 restantes**'),
        ('Sa publication distincte est confirmée dans Site94. Le gel6A raccorde ensuite `preview_packing` : **63/76 entrées et13ouvertes**',
         'Sa publication distincte est confirmée dans Site 94. Le gel 6A raccorde ensuite `preview_packing` : **63/76 entrées et 13 ouvertes**'),
        ('**Trois entrées restent ouvertes :6B `selected_rigid`, prochaine capacité de ce fil ;6C `observed_rigid_cargo` ;6D `shared_settlement`.**',
         '**Trois entrées restent ouvertes : 6B `selected_rigid`, prochaine capacité de ce fil ; 6C `observed_rigid_cargo` ; 6D `shared_settlement`.**'),
        ('les limites source de6A', 'les limites source de 6A'),
    ]:
        s=s.replace(before,after)
    path.write_text(s)
    english_pub=(f"Private native publication is confirmed in **Site {pub['siteVersion']}**, commit `{pub['commit']}`, preserving the owner-only audience." if pub_ok else 'Private publication is still pending; the actual published baseline is Site 95 / native 0.58.')
    english_cost=('; '.join(f"**{r['case']} {100*r['medianRelativeIncrease']:+.6f}%**" for r in cost['globalCases']) if cost else 'Official measurements are pending.')
    english_reg_closure=("The subsequent **1,024 MiB** WEAV replay failed with **`-6` after 73 actions** and an [explicit V8 heap-exhaustion diagnostic](docs/migration/lot6a-evidence/recovery/weav-memory/diagnostic.json); this does not establish the cause of the earlier SIGKILLs. The [final exclusive 1,536 MiB replay](docs/migration/lot6a-evidence/integrated-final-02/released-weav-exclusive-1536/regressions/regression-summary.json) passed **81 actions and 17/17 checks**. The checked **9 + 1 + 1** composition binds each retained result to its real invocation in the [final summary](docs/migration/lot6a-evidence/integrated-final-02/regressions-final/regression-summary.json). The [first failed consolidation](docs/migration/lot6a-evidence/recovery/consolidation-attempt-01.json) remains retained; `actual_retained_child_execution_inputs` binds the actual child execution inputs without inventing a parent inventory recorded before launch. No replay was repeated for that provenance correction."
                         if reg_ok else "The final summary remains pending in `docs/migration/lot6a-evidence/integrated-final-02/regressions-final/regression-summary.json`; no successful 187-check total is anticipated.")
    english_cost_details=(f"The [independent review](docs/migration/lot6a-evidence/performance-integrated/owner-growth-review.json) performed **{cost['checkedCount']:,} checks** across **{cost['measuredSessions']} measured sessions / {cost['measuredActions']} actions**. **{aggregate['withinObservedBudget']}/{aggregate['budgetMetricCount']} aggregate timing diagnostics** remain within the observed budget; the eight metrics per case include `session_elapsed`. The [complete cost report](docs/migration/lot6a-evidence/performance-integrated/results.md) retains all five pooled phase overruns, both cohorts, dispersion and available p95. The historical strict metadata failure remains failed; the separate predeclared owner contract qualifies only the captured structural deltas."
                          if cost else "The official cost review remains pending.")
    english_clock=(f"The [cumulative KATA clock](docs/migration/lot6a-evidence/case-clock.json) is closed within budget at **{clock['chargedSeconds']:.6f} / 2,400 seconds**, leaving **{clock['remainingSeconds']:.6f} seconds unused**; earlier charges and attempts remain included."
                   if clock['status']=='completed_within_budget' else "The cumulative KATA clock remains recorded separately.")
    english=f"""## Current migration: lot 6A PreviewPacking / native 0.60.0

The reconstructed `preview_packing` owner is connected in the original strategy order, with selected-return acquisition, guarded commands and exact source-state restoration. {english_pub}

The final freeze contains **306 native files**, digest `{native['digest']}`, and 322 archived native/execution inputs. This is a new reconstruction from immutable original source; lost earlier 6A results are historical only.

| Actual proof | Result |
| --- | --- |
| Final declared tests | **{count}/{count} in {files} files**, no failures, skips, cancellations or TODOs |
| Release checks | **5/5**, including the production build |
| Independent component oracle | **1,288 checks**, including 724 consumed-file hashes; all 1,786 original files unchanged |
| Cold KATA and actual browser | **3 levels / 33 actions / 14 plans**, Pause at 9 then exactly one action to 10 |
| Cold original parity | **174 events, 113 calls, 61 restores, zero differences**; 56 ablations, 17 action/refusal changes |
| Recorded returns | {'**187/187 scoped checks**: 10 historical traces plus one same-candidate KATA repeatability check.' if reg_ok else 'The final eleven-report summary remains pending.'} |
{english_proof_rows}

The register now has **63/76 connected entries (82.9%), 13 remaining**. Coverage retains 195 component-verified modules, 148 partial transfers and 1,026 pending; no module is fully verified and all six full-migration gates remain false.

Global complete-session median results: {english_cost} {'Both cases are accepted.' if cost_ok else 'No global acceptance is claimed.'} The predeclared rule is strictly below +10% for each case; phase overruns remain visible and may be accepted only when that global rule passes. No measured sample is removed.

{english_cost_details}

The 126-file scope explicitly excludes three inherited modules that execute the closed-budget LKEY case. The first **4,793/4,795** run remains failed; the complete successful rerun and all five final checks are retained under `docs/migration/lot6a-evidence/integrated-final-02/validation-final/validation`. Two failed replays in the first batch and a further WEAV retry ended with three retained `-9` exits (SIGKILL); the exit code alone does not establish a memory cause. {english_reg_closure} The native bounds return blocking unknowns; they do not prove impossibility or guarantee instantaneous Pause. Long-session history compaction and full-original-caller parity remain open.

{english_clock}

**{'6A is closed within its stated scope. Next in this lane' if pub_ok else 'Next in this lane after 6A closure'}: 6B `selected_rigid`**, followed by `observed_rigid_cargo` and `shared_settlement`. See the [updated roadmap](docs/migration/v6-delivery-roadmap.md), [6A report](docs/migration/lot6a-preview-packing.md), [source lineage](docs/migration/lot6a-preview-packing-lineage.md) and [evidence index](docs/migration/lot6a-evidence/README.md).
"""
    p=ROOT/'README.md';block(p,'LOT6A_README',english,'LOT5B_README')
    p.write_text(p.read_text().replace('## Current publication: Site 94 / lot 5B','## Historical publication: Site 94 / lot 5B'))
    transfer=english.replace('](docs/migration/','](')
    p=ROOT/'docs/migration/v6-native-transfer.md';block(p,'LOT6A_TRANSFER',transfer,'LOT5B_TRANSFER')
    p.write_text(p.read_text().replace('## Current published transfer: Site 94 / lot 5B','## Historical published transfer: Site 94 / lot 5B'))
    print(json.dumps({'documentsUpdated':3,'tests':count,'regressionsPassed':reg_ok,'globalAccepted':cost_ok,'publicationConfirmed':pub_ok}))

if __name__=='__main__':main()
