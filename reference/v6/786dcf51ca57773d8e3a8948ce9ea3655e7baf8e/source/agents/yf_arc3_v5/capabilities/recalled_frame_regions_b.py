"""Measure current framed receivers under a specifically recalled entry model.

No route, goal or action is chosen. Full enclosing footprints are returned for
the declared containment relation; the visible stroke remains separate evidence.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_recalled_frame_regions(*, frame, body, body_palette, memories, contract):
    model = contract.get('recalled_frame_model')
    if not model or body.height < 3 or body.height != body.width:
        return ()
    rows = tuple(row for row in memories if row.get('claim_ref')
        and row.get('measurement_basis') == model['measurement_basis']
        and tuple(row.get('body_palette_values', ())) == tuple(sorted(body_palette))
        and row.get('epistemic_status') in model['proof_statuses']
        and row.get('disposition') == model['proof_disposition'])
    if len(rows) > model['maximum_memory_rows']:
        return ()
    width = body.width
    matches = {}
    for row in rows:
        strokes = tuple(row.get('palette_values', ()))
        if len(strokes) != 1:
            continue
        stroke, = strokes
        # The grid phase comes from the current, source-bound controlled body,
        # not coordinates saved in a previous scene or a game-specific pitch.
        for top in range(body.top % width, frame.height-width+1, width):
            for left in range(body.left % width, frame.width-width+1, width):
                if not all(frame.rows[top+r][left+c] == stroke
                    for r in range(width) for c in range(width)
                    if r in (0,width-1) or c in (0,width-1)):
                    continue
                if any(frame.rows[top+r][left+c] == stroke
                    for r in range(1,width-1) for c in range(1,width-1)):
                    continue
                box = (top,left,top+width-1,left+width-1)
                matches.setdefault(box,set()).add(row['claim_ref'])
                if len(matches) > contract['max_witnesses']:
                    return ()
    return tuple(FrozenMap({'region_bbox': box,
        'region_pixels': tuple((r,c) for r in range(box[0],box[2]+1) for c in range(box[1],box[3]+1)),
        'matching_relation_claim_refs': tuple(sorted(refs)),
        'measurement_basis': model['measurement_basis']}) for box,refs in sorted(matches.items()))
