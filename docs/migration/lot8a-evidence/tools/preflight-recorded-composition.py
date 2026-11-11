#!/usr/bin/env python3
"""Persist the existing driver's data-only preflight; no replay is launched."""
import argparse,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--manifest',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
 path=(ROOT/args.manifest).resolve();output=(ROOT/args.output).resolve()
 assert path.is_relative_to(ROOT/'docs/migration/lot8a-evidence/qualification-provisional-01') and output.is_relative_to(ROOT/'docs/migration/lot8a-evidence/qualification-provisional-01') and not output.exists()
 spec=importlib.util.spec_from_file_location('recorded_preflight',ROOT/'scripts/run-recorded-public-regressions.py');driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
 result={'schema':'logos-engine.lot8a.recorded-preflight.v1','status':'failed','replaysExecuted':0,'liveGamesLaunched':0}
 try:
  cases,totals,requirements=driver.prepare(path)
  assert len(cases)==11 and requirements==[]
  result.update(status='passed',cases=len(cases),totals=totals,passiveOwnerRequirements=requirements)
 except Exception as error:result['error']={'type':type(error).__name__,'message':str(error)}
 with output.open('x') as stream:json.dump(result,stream,ensure_ascii=False,indent=2);stream.write('\n')
 print(json.dumps(result));return 0 if result['status']=='passed' else 1
if __name__=='__main__':raise SystemExit(main())
