"""Neutral protocol fallback; no inherited unrelated access planner."""
class AnimationBase:
    def __init__(self):pass
    def retained_digest(self):return None
    def apply_event(self,event):raise ValueError('Unknown animation event')
    def propose_graph(self,*args,**kwargs):return None
    def before(self,*args,**kwargs):return {'admitted':False,'reason':'not_animation_question'}
    def after(self,*args,**kwargs):return {'matched':None,'seal_prefix':True,'reason':'not_animation_question'}
    def record(self,*args,**kwargs):return []
    def record_packet(self,*args,**kwargs):return []
