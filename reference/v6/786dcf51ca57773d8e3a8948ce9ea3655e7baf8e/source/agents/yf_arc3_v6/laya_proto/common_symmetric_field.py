"""Infer and test a correspondence on an observed rectangular array of uniform cells."""
from collections import defaultdict
from itertools import product

from common_multiscale_constraints import WindowConstraints
from periodic_correspondence import hypotheses as periodic_hypotheses


def regular_indices(values):
    axes=sorted(set(values))
    if len(axes)<3:return None
    pitch=axes[1]-axes[0]
    return axes if all(b-a==pitch for a,b in zip(axes,axes[1:])) else None


def measured_fields(observation):
    groups=defaultdict(dict)
    for entity in observation["entities"]:
        l,t,r,b=entity["bbox"]
        size=(r-l+1,b-t+1)
        if entity["area"]==size[0]*size[1]:
            groups[size][l,t]=entity["palette_value"]
    for (w,h),values in groups.items():
        # A status strip may use the same cell dimensions as the playfield.
        # Equal rows of lattice origins bind the rectangle without its decoration.
        row_origins=defaultdict(list)
        for x,y in values:row_origins[y].append(x)
        aligned=defaultdict(list)
        for y,xs in row_origins.items():aligned[tuple(sorted(xs))].append(y)
        for columns,lines in aligned.items():
            xs=regular_indices(columns);ys=regular_indices(lines)
            if not xs or not ys or xs[1]-xs[0]<w or ys[1]-ys[0]<h:continue
            qualified={(x,y):values[x,y] for x in xs for y in ys}
            yield xs,ys,qualified,(w,h)



def correspondences(width,height,family):
    transforms={"horizontal":lambda x,y:(width-1-x,y),"vertical":lambda x,y:(x,height-1-y),
                "half_turn":lambda x,y:(width-1-x,height-1-y)}
    if width==height:
        transforms.update(diagonal=lambda x,y:(y,x),antidiagonal=lambda x,y:(width-1-y,height-1-x))
    if family not in transforms:return []
    other=transforms[family]
    return [((x,y),other(x,y)) for x,y in product(range(width),range(height)) if (x,y)<other(x,y)]


def evidence(xs,ys,values,family):
    pairs=[((xs[x],ys[y]),(xs[u],ys[v])) for (x,y),(u,v) in correspondences(len(xs),len(ys),family)]
    equal=[(a,b) for a,b in pairs if values[a]==values[b]]
    conflicts=[(a,b) for a,b in pairs if values[a]!=values[b]]
    ordinary={values[a] for a,_ in equal}
    if not conflicts or len(ordinary)<2 or len(equal)<=len(conflicts):return None
    desired={}
    for a,b in conflicts:
        supported=[q for q in (a,b) if values[q] in ordinary]
        if len(supported)!=1:return None
        source=supported[0];target=b if source==a else a
        desired[target]={"actual":values[target],"eq":{values[source]},"ne":set(),"sources":{source}}
    return desired,{"unchanged_pairs":len(equal),"contrast_pairs":len(conflicts),
                    "ordinary_values":sorted(ordinary),"exceptional_values":sorted({c["actual"] for c in desired.values()})}


class SymmetricField(WindowConstraints):
    def __init__(self,policy):
        super().__init__()
        self.families=policy["isometries"]
        self.maximum_omitted=policy.get("maximum_hypothetically_omitted_values",0)
        self.why=policy["question"]
        self.tests={}

    def _clear(self,epoch):
        super()._clear(epoch)
        self.tests={}

    def _fit(self,obs,rows):
        hypotheses=[]
        for xs,ys,values,size in measured_fields(obs):
            shape=[xs[0],ys[0],len(xs),len(ys),list(size)]
            for family in self.families:
                if self.rule and (self.rule["lattice"],self.rule["family"])!=(shape,family):continue
                fit=evidence(xs,ys,values,family)
                if fit is not None:
                    table,counts=fit
                    field={"size":size,"pitch":(xs[1]-xs[0],ys[1]-ys[0]),"groups":[list(values)]}
                    hypotheses.append(((shape,family),field,table,counts))
            for family,table,counts in periodic_hypotheses(xs,ys,values,self.maximum_omitted):
                if self.rule and (self.rule["lattice"],self.rule["family"])!=(shape,family):continue
                field={"size":size,"pitch":(xs[1]-xs[0],ys[1]-ys[0]),"groups":[list(values)]}
                hypotheses.append(((shape,family),field,table,counts))
        if not hypotheses:return None,None
        by_forecast={tuple(sorted((cell,next(iter(c["eq"]))) for cell,c in table.items())) for _,_,table,_ in hypotheses}
        if len(by_forecast)!=1:
            # Release only corrections explicitly supported by every remaining
            # model; unmodelled cells (e.g. a reflection axis) stay unresolved.
            common=set.intersection(*(set(forecast) for forecast in by_forecast))
            if not common:return None,None
            if len({str(key[0]) for key,_,_,_ in hypotheses})!=1:return None,None
            key,field,table,counts=hypotheses[0]
            table={cell:constraint for cell,constraint in table.items()
                   if (cell,next(iter(constraint['eq']))) in common}
            self.rule=None
        else:
            key,field,table,counts=hypotheses[0]
            self.rule={"lattice":key[0],"family":key[1]}
        if not self.first:self.first=obs["observation_ref"]
        self.provenance={"method":"tested_regular_field_correspondence","geometries":[x[0][1] for x in hypotheses],
                         **counts,"unanimous_corrections":len(table),
                         "unresolved_prediction_disagreement":len(by_forecast)>1,"observation":obs["observation_ref"]}
        return field,table

    def predicted_rewrite(self,c):
        # At least two independently located repairs of *different* expected
        # values distinguish copying the counterpart from a constant replacement.
        if len(set(self.tests.values()))<2:return None
        return next(iter(c["eq"]))

    def propose(self,o,rows,inputs,remaining):
        proposal=super().propose(o,rows,inputs,remaining)
        if proposal:
            proposal["kind"]="public_symmetric_field"
            proposal["question"]["reason"]=self.why
            proposal["bundle_template"]["purpose"]=self.why
        return proposal

    def record(self,before,after,command,first,second,proposal,index):
        result=super().record(before,after,command,first,second,proposal,index)
        if result.get("status")=="local_rewrite_witness":
            if result["satisfies_frozen_constraint"]:
                self.tests[tuple(result["address"])]=result["after"]
            else:
                self.tests.clear()
                self.deactivated=True
        return result
