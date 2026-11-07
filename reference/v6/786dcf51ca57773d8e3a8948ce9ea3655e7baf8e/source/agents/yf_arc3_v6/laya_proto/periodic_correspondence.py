"""Bounded, revisable repetition hypotheses measured on a public cell lattice."""
from collections import defaultdict
from itertools import combinations


def hypotheses(xs, ys, values, maximum_omitted):
    palette=sorted(set(values.values()))
    for count in range(1,min(maximum_omitted,len(palette)-2)+1):
        for omitted in combinations(palette,count):
            excluded=set(omitted)
            for px in range(1,len(xs)//2+1):
                for py in range(1,len(ys)//2+1):
                    classes=defaultdict(list)
                    for ix,x in enumerate(xs):
                        for iy,y in enumerate(ys):classes[ix%px,iy%py].append((x,y))
                    desired={};intact=0;valid=True;ordinary=set()
                    for cells in classes.values():
                        witnesses=[cell for cell in cells if values[cell] not in excluded]
                        colors={values[cell] for cell in witnesses}
                        if len(witnesses)<2 or len(colors)!=1:
                            valid=False;break
                        expected=next(iter(colors));ordinary.add(expected);intact+=len(witnesses)
                        for cell in cells:
                            if values[cell]!=expected:
                                desired[cell]={"actual":values[cell],"eq":{expected},"ne":set(),"sources":set(witnesses)}
                    if valid and desired and len(ordinary)>=2 and intact>len(desired):
                        yield f"period:{px}:{py}",desired,{
                            "unchanged_pairs":intact,"contrast_pairs":len(desired),
                            "ordinary_values":sorted(ordinary),"exceptional_values":sorted(excluded),
                            "hypothetically_omitted_values":sorted(excluded),
                            "period_in_cells":[px,py],"minimum_independent_witnesses_per_class":2}
