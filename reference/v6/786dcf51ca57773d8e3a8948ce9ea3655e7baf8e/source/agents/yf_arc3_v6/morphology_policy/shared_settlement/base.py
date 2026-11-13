"""Neutral superclass for the isolated historical settlement provider.

No other family or game mechanism is inherited through this compatibility base.
"""
class NeutralAccess:
    def __init__(self):pass
    def retained_digest(self):return 'isolated-settlement-base-v1'
    def apply_event(self,event):return None
    def propose_graph(self,*args,**kwargs):return {'status':'abstained','reason':'shared_population_not_applicable'}
    def before(self,*args,**kwargs):return {'admitted':False,'reason':'not_a_shared_settlement_plan'}
    def after(self,*args,**kwargs):return {'matched':None,'seal_prefix':True,'reason':'not_a_shared_settlement_plan'}
    def record(self,*args,**kwargs):return []
