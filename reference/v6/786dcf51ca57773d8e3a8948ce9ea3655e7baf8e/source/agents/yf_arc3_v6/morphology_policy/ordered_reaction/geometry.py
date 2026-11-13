from types import SimpleNamespace
from dataclasses import asdict
from pydantic import TypeAdapter
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.capabilities.ordered_tip_changes import measure_tip_probe_geometry,measure_ordered_square_packet,measure_square_field
from agents.yf_arc3_v5.capabilities.physical_transition_contracts import OrderedSquarePacket
import hashlib,json

def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def packet_restore(x):return TypeAdapter(OrderedSquarePacket).validate_python(x)
def measure(rows,packets,directions):
 return measure_tip_probe_geometry(SimpleNamespace(frame=FrameGrid(rows=rows),current_observed_frame=None,ordered_square_packets=tuple(packet_restore(p['packet'])for p in packets),interface_action_translation_deltas=tuple((a,*d)for a,d in directions.items())))
def observe(first,frames,action):
 p=measure_ordered_square_packet(before=FrameGrid(rows=first),ordered_frames=tuple(FrameGrid(rows=f)for f in frames),action_ref=action)
 return asdict(p)if p else None
