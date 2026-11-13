"""Abstaining compatibility base; no inherited family or private state."""
class NeutralAccess:
    def __init__(self):pass
    def retained_digest(self):return 'isolated-selected-rigid-v1'
    def apply_event(self,event):return None
    def propose_graph(self,*args,**kwargs):return {'status':'abstained','reason':'selected_rigid_domain_not_measured'}
    def before(self,*args,**kwargs):return {'admitted':False,'reason':'not_selected_rigid'}
    def after(self,*args,**kwargs):return {'matched':None,'seal_prefix':True,'reason':'not_selected_rigid'}
    def record(self,*args,**kwargs):return []
def input_candidates(rows,available):return []
