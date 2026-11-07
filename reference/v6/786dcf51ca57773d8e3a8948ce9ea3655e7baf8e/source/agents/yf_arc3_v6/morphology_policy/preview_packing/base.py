# Neutral provider boundary: no unrelated B family is imported.
class CellSymbolAccess:
    def __init__(self):pass
    def retained_digest(self):return 'neutral-provider'
    def apply_event(self,event):pass
    def propose_graph(self,*args,**kwargs):return {'status':'abstained','reason':'preview_inventory_not_applicable'}
    def record(self,*args,**kwargs):return []
    def before(self,*args,**kwargs):return {'admitted':False,'reason':'wrong_provider'}
    def after(self,*args,**kwargs):return {'matched':None,'seal_prefix':True,'reason':'wrong_provider'}
def input_candidates(rows,available):
    return []  # Inherited enrichment is unused: caller supplies its current inputs.
