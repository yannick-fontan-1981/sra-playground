#!/usr/bin/env python3
"""Transfer original V6 declarative programs to the common native SRC IR.

This is a development/build-time export. The browser consumes JSON modules and
executes the TypeScript interpreter; it does not load this script or Python.
No callback is executed to synthesize a replacement policy.
"""
from pathlib import Path
from collections.abc import Mapping
import hashlib, inspect, json, sys
ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source'
LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
from agents.yf_arc3_v6.morphology_policy.strategy import StrategyRouter
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from agents.yf_arc3_v5.src.compiler import compile_source
from agents.yf_arc3_v5.src.symbols import CompilerEnvironment,SymbolDefinition,SymbolKind,ParameterSpec,TypeSpec
from agents.yf_arc3_v5.src.registry import WorkflowRegistry
from agents.yf_arc3_v5.logos.types import EffectClass

def plain(value):
    if isinstance(value,Mapping):return {key:plain(item)for key,item in value.items()}
    if isinstance(value,(list,tuple)):return [plain(item)for item in value]
    return value

def export():
    strategy=StrategyRouter();programs={};seen=set()
    def visit(obj):
        if id(obj)in seen:return
        seen.add(id(obj))
        if isinstance(obj,SrcProgram):
            data=plain(obj.module.model_dump(mode='json'))
            programs[obj.workflow_id]={'entry':obj.workflow_id,'module':data,'transitiveSourceHash':obj.entry.transitive_source_hash}
            return
        if isinstance(obj,dict):
            for value in obj.values():visit(value)
        elif isinstance(obj,(list,tuple)):
            for value in obj:visit(value)
        elif hasattr(obj,'__dict__'):
            module=sys.modules.get(type(obj).__module__)
            filename=getattr(module,'__file__',None)
            if filename and ('yf_arc3_v6' in filename or str(LAYA)in filename):
                for value in vars(obj).values():visit(value)
    visit(strategy)
    definitions=[]
    implementation=LAYA/'neutral_probe_runtime.py';implementation_hash=hashlib.sha256(implementation.read_bytes()).hexdigest()
    for name in ['begin','context','unique','abstain','laya','apply','navigate','resume','complete_navigation','release','reject','result']:
        args=['request']if name=='begin'else ['session','choice']if name in {'apply','navigate'}else ['session']
        definitions.append(SymbolDefinition(id='prototype.'+name,kind=SymbolKind.WORKFLOW,
            parameters=tuple(ParameterSpec(name=a,type_spec=TypeSpec(name='Any'))for a in args),output_type=TypeSpec(name='Any'),
            effect_class=EffectClass.PURE,source_unit='prototype.laya_router.callbacks',source_hash=implementation_hash))
    path=LAYA/'router.src';env=CompilerEnvironment(types=('Any','Boolean','Integer','String','Ref','List','Set','Map'),symbols=tuple(definitions))
    module=compile_source(path.read_text(),source_name=str(path),environment=env);registry=WorkflowRegistry();entry=registry.register(module)
    programs['prototype.laya_router.route']={'entry':'prototype.laya_router.route','module':plain(module.model_dump(mode='json')),'transitiveSourceHash':entry.transitive_source_hash}
    sources={}
    for path in sorted(SOURCE.rglob('*')):
        if path.is_file()and path.suffix in ('.src','.drm','.logos')and ('yf_arc3_v6'in str(path) or path == SOURCE/'agents/yf_arc3_v5/drm/morphology.drm'):
            relative=path.relative_to(SOURCE).as_posix();raw=path.read_bytes()
            sources[relative]={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'text':raw.decode()}
    bundle={'schema':'logos-engine.v6.programs.v1','referenceCommit':COMMIT,
        'compiler':'Pinned original V5 compile_source used at export only; TypeScript interpreter at runtime',
        'programs':programs,'sources':sources,
        'strategy':plain(strategy.drm.document.declarations[0].configuration)}
    destination=ROOT/'src/logos-engine/v6/programs.json';destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(bundle,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'file':str(destination),'programs':len(programs),'declaredSourceFiles':len(sources),'workflows':sorted(programs)},indent=2))
if __name__=='__main__':export()
