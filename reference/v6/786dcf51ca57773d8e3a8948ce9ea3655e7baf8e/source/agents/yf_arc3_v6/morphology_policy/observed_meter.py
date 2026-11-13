"""Measure aligned strips that lose a fixed number of pixels per public step."""
from collections import defaultdict, deque
from itertools import groupby
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, SceneTransitionMeasurementInput
from agents.yf_arc3_v5.capabilities.transition import _measure_pixel_packet, _boundary_adjacent_monotonic_strip_decrease


def strips(rows):
    result={}
    for axis,lines in (("x",rows),("y",zip(*rows))):
        for line_no,line in enumerate(lines):
            runs=defaultdict(list)
            cursor=0
            for value,group in groupby(line):
                length=sum(1 for _ in group)
                runs[value].append((cursor,length))
                cursor+=length
            for value,spans in runs.items():
                if len(spans)!=1:continue
                start,length=spans[0]
                for anchor,edge in (("lo",start),("hi",start+length)):
                    result[axis,line_no,int(value),anchor,edge]=length
    return result



def single_line_supports(rows, measured):
    """One-pixel-wide, boundary-adjacent strips; no palette or resource role."""
    height, width = len(rows), len(rows[0])
    result = set()
    for key, length in measured.items():
        axis, line, color, anchor, edge = key
        cross_extent = height if axis == "x" else width
        if length < 1 or min(line, cross_extent - 1 - line) > 1:
            continue
        start = edge if anchor == "lo" else edge - length
        stop = start + length
        def other_value(neighbor, offset):
            return rows[neighbor][offset] if axis == "x" else rows[offset][neighbor]
        if all(other_value(neighbor, offset) != color
               for neighbor in (line - 1, line + 1) if 0 <= neighbor < cross_extent
               for offset in range(start, stop)):
            result.add(key)
    return result

class ObservedMeter:
    def __init__(self):
        self.epoch=None
        self.recent=deque(maxlen=5)
        self.hypotheses={}
        self.peaks={}
        self.last_ref=None
        self.previous_rows=None
        self.single_line_evidence={}
        self.recent_steps=deque(maxlen=5)
        self.last_step_index=None

    def observe(self,epoch,ref,rows, *, primitive_index=None):
        if epoch!=self.epoch:
            self.__init__()
            self.epoch=epoch
        if ref==self.last_ref:return
        elapsed=(primitive_index-self.last_step_index if type(primitive_index) is int and type(self.last_step_index) is int else None)
        measured=strips(rows)
        thin = single_line_supports(rows, measured)
        previous = self.recent[-1][1] if self.recent else {}
        discover = {key for key in thin if key not in self.single_line_evidence
                    and previous.get(key, 0) > measured[key]}
        if discover and self.previous_rows is not None:
            for key in discover:
                axis,line,_,_,_=key
                # Eligibility above is measured against the original viewport boundary.
                # Project only its local band: unrelated world motion is not a counter change.
                def band(frame):
                    if axis=="x":return tuple(tuple(row) for row in frame[max(0,line-1):line+2])
                    return tuple(tuple(row[max(0,line-1):line+2]) for row in frame)
                request = SceneTransitionMeasurementInput(
                    before=FrameGrid(rows=band(self.previous_rows)), after=FrameGrid(rows=band(rows)),
                    transition_ref=str(ref), boundary_search_band_px=1 + 1)
                delta = _measure_pixel_packet(request)
                if _boundary_adjacent_monotonic_strip_decrease(request, delta):
                    self.single_line_evidence[key] = [self.last_ref, ref]
        self.previous_rows=tuple(tuple(row) for row in rows)
        self.recent.append((ref,measured))
        self.recent_steps.append(primitive_index)
        self.last_step_index=primitive_index
        self.last_ref=ref
        for key,(rate,_,old) in list(self.hypotheses.items()):
            value=measured.get(key,0)
            axis,line,color,anchor,edge=key
            neighbor=(axis,line+1,color,anchor,edge)
            supported = measured.get(neighbor)==value or (key in self.single_line_evidence and key in thin)
            gain=value>old and supported
            single = measured.get(neighbor)!=value and key in self.single_line_evidence
            interval = elapsed if single else 1
            if (single and (interval is None or interval<=0 or not supported)) or (value!=old-rate*interval and not gain):
                del self.hypotheses[key]
            else:
                self.hypotheses[key]=(rate,ref,value)
                self.peaks[key]=max(value,self.peaks.get(key,0))
        if len(self.recent)<self.recent.maxlen:return
        for key,value in measured.items():
            axis,line,color,anchor,edge=key
            neighbor=(axis,line+1,color,anchor,edge)
            if measured.get(neighbor)!=value and not (key in self.single_line_evidence and key in thin):continue
            lengths=[m.get(key,0) for _,m in self.recent]
            rate=lengths[0]-lengths[1]
            parallel = all(m.get(neighbor,0)==n for (_,m),n in zip(self.recent,lengths))
            supported_single = key in self.single_line_evidence and key in thin
            uniform = rate>0 and all(a-b==rate for a,b in zip(lengths,lengths[1:])) and parallel
            if supported_single and not parallel:
                indices=list(self.recent_steps)
                if all(type(index) is int for index in indices):
                    gaps=[b-a for a,b in zip(indices,indices[1:])]
                    differences=[a-b for a,b in zip(lengths,lengths[1:])]
                    if all(gap>0 and diff>0 and diff%gap==0 for diff,gap in zip(differences,gaps)):
                        rates={diff//gap for diff,gap in zip(differences,gaps)}
                        uniform=len(rates)==1
                        if uniform:rate=rates.pop()
            if uniform:
                self.hypotheses[key]=(rate,ref,value)
                self.peaks[key]=max(lengths[0],self.peaks.get(key,0))

    def forecast(self):
        forecasts={value//rate for rate,_,value in self.hypotheses.values()}
        if len(forecasts)!=1:return None
        key=min(self.hypotheses)
        rate,ref,value=self.hypotheses[key]
        return {"steps_before_empty":forecasts.pop(),"current_units":value,"loss_per_step":rate,
                "capacity_steps":self.peaks[key]//rate,"capacity_status":"largest_measured_value",
                "measured_strip":list(key),"observation_ref":ref,"level_epoch":self.epoch,
                "qualification":"provisional_constant_loss_until_a_measured_change"}
