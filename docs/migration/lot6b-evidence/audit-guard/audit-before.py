#!/usr/bin/env python3
"""Inventory every pinned reference module and enforce the complete-port gate.

Run without --require-complete to update the auditable work-in-progress report.
The completion gate deliberately fails while a capability or a dependency is
unmapped, unverified, or absent. It never derives completion from line counts.
"""
from pathlib import Path
import argparse, ast, hashlib, json
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source'
CONFIG=ROOT/'migration/v6-transfer-map.json'


def catalogue():
    config=json.loads(CONFIG.read_text());mapped={}
    failures=[]
    allowed_statuses={'verified','component_verified','partial_transfer','transferred_unverified'}
    for item in config['mappings']:
        if item['status'] not in allowed_statuses:failures.append('Unknown migration status: '+str(item['status']))
        for target in item['targets']:
            if not (ROOT/target).is_file():failures.append(f'Missing target: {target}')
        for proof in item['proof']:
            if not (ROOT/proof).is_file():failures.append(f'Missing differential evidence: {proof}')
        for source in item['sources']:
            if not (SOURCE/source).is_file():failures.append(f'Missing reference source: {source}')
            if source in mapped:failures.append(f'Duplicate mapping: {source}')
            mapped[source]=item
        if item['status'] in ('verified','component_verified') and not item['proof']:failures.append('Verified mapping lacks differential proof: '+str(item['sources']))
    modules=[];assets=[];symbols=0
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or '__pycache__' in path.parts or path.suffix=='.pyc':continue
        relative=path.relative_to(SOURCE).as_posix();raw=path.read_bytes();entry={'path':relative,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
        if path.suffix=='.py':
            source=raw.decode();tree=ast.parse(source);definitions=[]
            for node in ast.walk(tree):
                if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
                    definitions.append({'name':node.name,'kind':'class' if isinstance(node,ast.ClassDef) else 'function','line':node.lineno,'endLine':node.end_lineno})
            entry.update(lines=len(source.splitlines()),definitions=definitions)
            symbols+=len(definitions)
            mapping=mapped.get(relative)
            entry.update(status=mapping['status'] if mapping else 'pending',targets=mapping['targets'] if mapping else [],proof=mapping['proof'] if mapping else [])
            modules.append(entry)
        else:
            entry.update(status='reference_only',kind='declarative_program' if path.suffix in ('.src','.drm','.logos') else 'reference_data')
            assets.append(entry)
    families=[]
    strategy=SOURCE/'agents/yf_arc3_v6/morphology_policy/strategy.drm'
    declaration=json.loads(strategy.read_text())['declarations'][0]['configuration']
    for name in declaration['families']:
        conf=declaration.get(name,{})
        subquestions=[]
        if isinstance(conf,dict):subquestions=conf.get('ordered_subquestions',[])
        if name=='goal_access':subquestions=declaration.get('goal_access_subquestions',[])
        if name=='surface':subquestions=declaration.get('program_construction',{}).get('ordered_subquestions',[])
        families.append({'id':name,'status':'pending_full_router_parity','subquestions':subquestions})
    pending=[m['path']for m in modules if m['status']!='verified']
    gates=config.get('completionGates',{})
    gates_complete=bool(gates) and all(value is True for value in gates.values())
    report={'schema':'logos-engine.native-migration-report.v1','referenceCommit':config['referenceCommit'],
        'complete':not pending and not failures and gates_complete,'requirements':config['requirements'],'completionGates':gates,
        'scope':'Complete conservatively retained static reference, including inherited V5 dependency modules. No module is silently excluded.',
        'summary':{'pythonModules':len(modules),'pythonLines':sum(m['lines']for m in modules),'declaredClassesAndFunctions':symbols,
            'dataFiles':len(assets),'verifiedModules':sum(m['status']=='verified'for m in modules),
            'componentVerifiedModules':sum(m['status']=='component_verified'for m in modules),
            'partiallyTransferredModules':sum(m['status']=='partial_transfer'for m in modules),
            'transferredUnverifiedModules':sum(m['status']=='transferred_unverified'for m in modules),
            'pendingModules':sum(m['status']=='pending'for m in modules),'strategyFamilies':len(families)},
        'families':families,'modules':modules,'data':assets,'failures':failures,'scopeNotes':config['scopeNotes']}
    dest=ROOT/'docs/migration/v6-coverage.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--require-complete',action='store_true');args=parser.parse_args()
    report=catalogue();print(json.dumps({'complete':report['complete'],**report['summary'],'failures':report['failures']},indent=2))
    if args.require_complete and not report['complete']:raise SystemExit('V6 migration is incomplete. A partial family implementation cannot pass the complete-port gate.')
