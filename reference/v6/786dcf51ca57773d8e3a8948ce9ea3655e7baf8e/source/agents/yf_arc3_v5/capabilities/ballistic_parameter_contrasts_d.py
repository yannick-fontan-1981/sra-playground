"""Finite same-model direction/magnitude comparisons, never a probe ranking."""
from fractions import Fraction


def canonical_ballistic_geometry_d(snapshot):
    vector=lambda row:None if row is None else tuple(map(Fraction,row))
    portals=None if snapshot.portals is None else tuple((row.entry_mask_ref,row.exit_ref,
        vector(row.exit_center),vector(row.exit_offset),vector(row.entry_anchor),
        tuple(vector(part) for part in row.position_matrix),tuple(vector(part) for part in row.velocity_matrix),
        row.cooldown_ticks,None if row.eligible_ticks is None else tuple(sorted(row.eligible_ticks)))
        for row in sorted(snapshot.portals,key=lambda row:row.entry_mask_ref))
    return vector(snapshot.source),vector(snapshot.launch_offset),portals,vector(snapshot.bounds)


def measure_ballistic_parameter_contrasts_d(rows,remaining):
    contrasts=[];work=0
    for index,left in enumerate(rows):
        for right_index in range(index+1,len(rows)):
            if work+16>remaining:return tuple(contrasts),work,True
            work+=16;right=rows[right_index]
            if left['model_ref']!=right['model_ref']:continue
            same_aim=left['aim_payload_ref']==right['aim_payload_ref'];same_power=left['power_ref']==right['power_ref']
            if not (same_aim or same_power) or same_aim and same_power:continue
            a=tuple(map(Fraction,left['initial_motion'].velocity));b=tuple(map(Fraction,right['initial_motion'].velocity))
            contrasts.append({'model_ref':left['model_ref'],'left_launch_ref':left['launch_ref'],
                'right_launch_ref':right['launch_ref'],'same_aim_ref':same_aim,'same_power_ref':same_power,
                'equal_speed_squared':sum(v*v for v in a)==sum(v*v for v in b),
                'parallel_initial_velocities':a[0]*b[1]==a[1]*b[0],
                'initial_velocity_dot_product':str(sum(x*y for x,y in zip(a,b))),
                'equal_acceleration':left['initial_motion'].acceleration==right['initial_motion'].acceleration,
                'equal_source_position':left['initial_motion'].position==right['initial_motion'].position,
                'left_full_outcome':left['packet']['outcome'],'right_full_outcome':right['packet']['outcome'],
                'both_flights_complete':left['complete_conditional_flight'] and right['complete_conditional_flight']})
    return tuple(contrasts),work,False
