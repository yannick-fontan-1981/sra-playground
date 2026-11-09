#!/usr/bin/env python3
"""Read a retained public view through unchanged layout/scan, without search.

The subsequent component and GF(2) calculations are independent mathematical
necessary conditions for the measured conditional reduction model. They make
no assertion about game rules or terminal conditions.
"""
from __future__ import annotations
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('framed_probe', ROOT/'scripts/probe-v6-framed-transfer-original.py')
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
import common_reduction_transport as original

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def plain(value):
    if isinstance(value,dict):return {k:plain(v) for k,v in value.items()}
    if isinstance(value,(set,frozenset)):return [plain(v) for v in sorted(value)]
    if isinstance(value,(tuple,list)):return [plain(v) for v in value]
    return value

def necessary_conditions(scene):
    positions=sorted(scene['floor']|scene['rails']|scene['pegs']|set(scene['carriers']))
    index={point:i for i,point in enumerate(positions)}
    supports=scene['floor']|scene['rails']|set(scene['carriers'])
    parent=list(range(len(positions)))
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    def join(a,b):parent[find(index[a])]=find(index[b])
    generators=set();triples=[]
    for p in positions:
        for dx,dy in original.VECTORS:
            middle=(p[0]+dx,p[1]+dy);end=(p[0]+2*dx,p[1]+2*dy)
            if middle in index and end in supports:
                triples.append((p,middle,end));join(p,middle);join(middle,end)
                generators.add((1<<index[p])^(1<<index[middle])^(1<<index[end]))
    for p,q in scene['edges']:
        join(p,q);generators.add((1<<index[p])^(1<<index[q]))
    occupied=Counter(find(index[p]) for p in scene['pegs'])
    components={}
    for p in positions:components.setdefault(find(index[p]),[]).append(p)
    basis={}
    def remainder(value):
        while value:
            pivot=value.bit_length()-1
            if pivot not in basis:break
            value^=basis[pivot]
        return value
    for vector in sorted(generators,reverse=True):
        vector=remainder(vector)
        if vector:basis[vector.bit_length()-1]=vector
    initial=sum(1<<index[p] for p in scene['pegs'])
    compatible=[p for p in positions if remainder(initial^(1<<index[p]))==0]
    return {'positions':positions,'potentialJumpTriples':triples,'potentialJumpTripleCount':len(triples),
            'transportGenerators':plain(scene['edges']),'linearGeneratorCount':len(generators),
            'connectedComponents':[{'positions':v,'initialPegCount':occupied.get(k,0)} for k,v in components.items()],
            'initialOccupiedComponentCount':len(occupied),'componentInvariantExcludesOnePeg':len(occupied)>1,
            'gf2Rank':len(basis),'gf2Nullity':len(positions)-len(basis),
            'initialResidueHex':hex(remainder(initial)),
            'singletonResidueHex':{str(p):hex(remainder(1<<index[p])) for p in positions},
            'compatibleSingletonPositions':compatible,'parityInvariantExcludesOnePeg':not compatible,
            'qualification':'Necessary conditions in a superset of conditional model transitions, not a reachability proof and not a statement about actual game mechanics.'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--journal',default='docs/migration/native-campaigns-v52/diagnostic-memory/actual-public-journal.jsonl.gz')
    parser.add_argument('--index',type=int,default=16)
    parser.add_argument('--output',default='docs/migration/native-campaigns-v52/diagnostic-memory/reduction-scene-original.json')
    args=parser.parse_args();journal=ROOT/args.journal;destination=ROOT/args.output
    if destination.exists():raise FileExistsError(destination)
    raw=journal.read_bytes();lines=(gzip.decompress(raw) if journal.suffix=='.gz' else raw).decode().splitlines()
    retained=json.loads(lines[args.index]);packet=retained['packet']
    before=helper.source_hashes();calls=Counter()
    forbidden={original.route.__code__,original.ReductionTransport.propose.__code__}
    def profile(frame,event,arg):
        if event=='call':
            assert frame.f_code not in forbidden,'route/propose must not execute in this diagnostic'
            if frame.f_code in (original.layout.__code__,original.scan.__code__):calls[frame.f_code.co_name]+=1
    observation,_=helper.measure(SimpleNamespace(**packet),args.index+1,'reduction-diagnostic-public')
    sys.setprofile(profile)
    try:
        model=original.layout(observation,packet['frame_rows'])
        scene=original.scan(packet['frame_rows'],model) if model else None
    finally:sys.setprofile(None)
    invariants=necessary_conditions(scene) if scene else None
    uniform_cells=0;uniform_marked_pegs=0
    if model:
        s=model['unit'];pitch=model['pitch'];px,py=model['phase']
        for y in range(py,len(packet['frame_rows'])-s+1,pitch):
            if y<1:continue
            for x in range(px,len(packet['frame_rows'][0])-s+1,pitch):
                if all(packet['frame_rows'][Y][X]==model['floor'] for Y in range(y,y+s) for X in range(x,x+s)):
                    uniform_cells+=1
                    uniform_marked_pegs+=((x-px)//pitch,(y-py)//pitch) in scene['pegs']
    after=helper.source_hashes();assert all(after.get(k)==v for k,v in before.items())
    assert helper.verify_source_manifest()==helper.VERIFIED_PINNED_SOURCE
    output={'schema':'logos-engine.v52.original-reduction-scene-diagnostic.v1','sourceCommit':helper.COMMIT,
            'sourceModified':False,'sourceHashes':after,'pinnedSourceFilesVerifiedBeforeImport':1786,'pinnedSourceFilesVerifiedAfterRun':1786,
            'input':{'path':args.journal,'sha256':sha(journal),'packetIndex':args.index,'retainedPacketCount':len(lines)},
            'packet':{k:packet[k] for k in ['level','levels_completed','state','step_index','frame_hash']},
            'unchangedSourceCalls':dict(calls),'routeCalls':0,'proposeCalls':0,'hostRuns':0,'nativeResultsUsedAsExpectations':False,
            'model':model,'sceneCounts':{k:len(v) for k,v in scene.items()} if scene else None,'scene':plain(scene),'invariants':plain(invariants),
            'measurementCoherence':{'floorAndTokenPaletteDistinct':model['floor']!=model['token'] if model else None,
                                    'uniformFloorCells':uniform_cells,'uniformFloorCellsAlsoMarkedAsPegs':uniform_marked_pegs,
                                    'qualification':'The original count-based scanner identifies a uniform floor patch as a peg when floor and token palette values coincide; no palette role is inferred beyond this measured hypothesis.'},
            'generator':{'path':Path(__file__).relative_to(ROOT).as_posix(),'sha256':sha(Path(__file__))}}
    destination.write_text(json.dumps(output,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'output':args.output,'model':model,'sceneCounts':output['sceneCounts'],'measurementCoherence':output['measurementCoherence'],
                      'invariants':{k:invariants[k] for k in ['potentialJumpTripleCount','linearGeneratorCount','initialOccupiedComponentCount','componentInvariantExcludesOnePeg','gf2Rank','gf2Nullity','parityInvariantExcludesOnePeg','compatibleSingletonPositions']}}))

if __name__=='__main__':main()
