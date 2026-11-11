#!/usr/bin/env python3
"""Targeted v3 namespace tests using unchanged v2 temporary fixtures."""
import datetime, hashlib, importlib.util, io, json, sys, time, unittest
from pathlib import Path
PLAN=Path(__file__).resolve().parent
ROOT=PLAN.parents[4]
def fp(path):
 data=path.read_bytes(); return {"path":str(path.relative_to(ROOT)),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()}
inputs=[Path(__file__).resolve(),PLAN/"orchestrate-cost-available-03.py",PLAN/"test-orchestrate-cost-recovery-02.py",PLAN/"cost-process-control-v2.py"]
before=[fp(p) for p in inputs];started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
spec=importlib.util.spec_from_file_location("lot5c_reused_temporary_fixture",inputs[2]);fixture=importlib.util.module_from_spec(spec);sys.modules[spec.name]=fixture;spec.loader.exec_module(fixture)
fixture.SOURCE=inputs[1];m=fixture.load()
assert m.REQUEST=="lot5c-cost-a33a5f88-available-03"
assert m.COORD.name=="cost-final-03" and m.PERF.name=="performance-integrated-04"
assert m.OWN_CLOSURE.parent.name=="recovery-03" and m.REVIEW.name=="coordination-v3-independent-review.json"
assert m.REGISTRY.name=="lot5c-available-03-active-children.json"
assert m.AVAILABILITY_SECONDS==600 and m.WINDOW_SECONDS==5400
now=datetime.datetime.now(datetime.timezone.utc);d={"quiet_request_id":m.REQUEST,"quiet_acknowledged":True,"quiet_acknowledged_at":now.isoformat(),"updated_at":now.isoformat(),"active_command":None,"heavy_execution_active":False,"all_own_subagents_idle":True,"no_queued_commands":True}
assert m.ack_valid(d,now-datetime.timedelta(seconds=1))
for old in ["lot5c-cost-a33a5f88-final-01","lot5c-cost-a33a5f88-recovery-02"]:
 d["quiet_request_id"]=old;assert not m.ack_valid(d,now-datetime.timedelta(seconds=1))
names=["test_old_incomplete_future_ack_refused","test_timeout_releases_and_one_cycle_only","test_fresh_raw_acks_then_controller_refusal_release"]
log=io.StringIO();result=unittest.TextTestRunner(stream=log,verbosity=2).run(unittest.TestSuite(fixture.Cases(name) for name in names))
after=[fp(p) for p in inputs];assert before==after
record={"schema":"logos-engine.lot5c-orchestrator-v3-targeted-tests.v1","startedAt":started,"finishedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"elapsedSeconds":round(time.monotonic()-t,6),"status":"passed" if result.wasSuccessful() else "failed","casesPassed":result.testsRun-len(result.failures)-len(result.errors),"casesTotal":result.testsRun,"configurationAssertions":8,"exactOldRequestACKsRejected":["lot5c-cost-a33a5f88-final-01","lot5c-cost-a33a5f88-recovery-02"],"inputsBefore":before,"inputsAfter":after,"inputsUnchanged":before==after,"testNames":names,"log":log.getvalue(),"temporaryMutexOnly":True,"realQuietOrEXOrBenchmarkLaunched":False,"qualification":"Only changed namespace wiring and authorization boundary retested. The remaining unchanged process/signal cleanup cases reuse the exact v2 source proof and retained13/13 result."}
p=PLAN/"orchestrator-v3-targeted-tests.execution.json"
with p.open("x") as f:json.dump(record,f,ensure_ascii=False,indent=2);f.write("\n")
print(json.dumps({k:record[k] for k in ["status","casesPassed","casesTotal","elapsedSeconds","inputsUnchanged","temporaryMutexOnly"]}))
sys.exit(0 if result.wasSuccessful() else 1)
