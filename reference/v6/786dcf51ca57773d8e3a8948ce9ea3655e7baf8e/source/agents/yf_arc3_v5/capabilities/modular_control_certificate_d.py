"""Exact finite setting-difference certificate; no command path or topology inference."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measured_setting_gain_delta(gain, delta):
    """Return only a displacement whose changing-axis coefficients are known.

    A fixed setting contributes zero variation without assigning its unknown
    coefficients a value. None on a changed axis stays missing evidence.
    """
    if gain is None:
        return (0, 0) if delta == (0, 0) else None
    dr, dc = delta
    rr, rc, cr, cc = gain
    if any(coefficient is None and change != 0
           for coefficient, change in ((rr, dr), (rc, dc), (cr, dr), (cc, dc))):
        return None
    return ((rr * dr if dr else 0) + (rc * dc if dc else 0),
            (cr * dr if dr else 0) + (cc * dc if dc else 0))


def modular_control_certificate_d(model,body,pads,settings,trace,budget):
    values={setting.pad_ref:setting for setting in settings};rows=[];dr=0;dc=0;known=True
    for pad in pads:
        budget.visit({'modular_certificate_pad_ref':pad.pad_ref})
        setting=values[pad.pad_ref]
        delta=(setting.row-pad.row_setting,setting.column-pad.column_setting)
        matches=[]
        for ref,gain in model.pad_gains:
            budget.visit({'modular_certificate_gain_ref':ref})
            if ref==pad.pad_ref:matches.append(gain)
        gain=matches[0] if len(matches)==1 else None
        contribution=measured_setting_gain_delta(gain,delta)
        if contribution is None:known=False
        if contribution is not None:dr+=contribution[0];dc+=contribution[1]
        rows.append(FrozenMap({'pad_ref':pad.pad_ref,'occurrence_ref':pad.occurrence_ref,
            'reference_setting':(pad.row_setting,pad.column_setting),'requested_setting':(setting.row,setting.column),
            'setting_delta':delta,'row_dimension_changes':delta[0]!=0,'column_dimension_changes':delta[1]!=0,
            'signed_gain_matrix':gain,'displacement_contribution':contribution}))
    budget.visit({'modular_certificate_occurrence_ref':body.occurrence_ref})
    unwrapped=(body.row+dr,body.column+dc)
    residue=(unwrapped[0]%model.height,unwrapped[1]%model.width)
    quotients=(unwrapped[0]//model.height,unwrapped[1]//model.width)
    body_trace=[]
    for row in trace:
        budget.visit({'modular_certificate_trace_ref':row['occurrence_ref']})
        if row['occurrence_ref']==body.occurrence_ref:body_trace.append(row)
    equal=(known and len(body_trace)==1 and body_trace[0]['delta']==(dr,dc)
        and body_trace[0]['endpoint']==residue and body_trace[0]['aggregate_endpoint_axis_quotients']==quotients)
    return FrozenMap({'reference_position':(body.row,body.column),'movement_moduli':(model.height,model.width),
        'component_rows':tuple(rows),'net_displacement':(dr,dc),'unwrapped_endpoint':unwrapped,
        'endpoint_residues':residue,'endpoint_axis_quotients':quotients,'endpoint_congruence_equal':equal,
        'command_path_crossing_count_proved':False})
