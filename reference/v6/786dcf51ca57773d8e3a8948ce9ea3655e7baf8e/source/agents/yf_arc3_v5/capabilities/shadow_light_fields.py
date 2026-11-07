"""Radiometry and changing grayscale supports; no light/shadow roles here.

RGB metadata and morphological bounds are supplied by Source. Pixel indices
are never treated as brightness, and glyph brightness is not field meaning.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap


def relative_luminance(rgb):
    def linear(channel):
        encoded=channel/255
        return encoded/12.92 if encoded<=0.04045 else ((encoded+0.055)/1.055)**2.4
    return sum(weight*linear(channel) for weight,channel in zip((0.2126,0.7152,0.0722),rgb))


def common_patch_perimeter_value(frame, patches):
    surfaces=[]
    for patch in patches:
        top,left,bottom,right=patch['bounds']
        surfaces.append({frame.rows[r][c] for r in range(top-1,bottom+2)
            for c in range(left-1,right+2) if 0<=r<frame.height and 0<=c<frame.width
            and not(top<=r<=bottom and left<=c<=right)})
    common=set.intersection(*surfaces) if surfaces else set()
    common-=set(v for patch in patches for v,_ in patch['histogram'])
    return next(iter(common)) if len(common)==1 else None


def measure_gray_field_contrast(frame, components, patches, contract, *,
                               before=None, packet=(), track=None):
    value=common_patch_perimeter_value(frame,patches)
    palette=contract['rgb_palette_8bit']
    known=all(0<=c.value<len(palette) for c in components)
    if value is None or not known or len(set(palette[value]))!=1:
        return FrozenMap({'gray_common_perimeter_present':False})
    luminances=tuple(relative_luminance(rgb) for rgb in palette)
    glyph_pixels={(r,c) for patch in patches for r in range(patch['bounds'][0],patch['bounds'][2]+1)
                  for c in range(patch['bounds'][1],patch['bounds'][3]+1)}
    minimum_area=min(p['extent']**2 for p in patches)
    brighter=tuple(c for c in components if len(set(palette[c.value]))==1
        and luminances[c.value]>luminances[value]
        and min(c.bbox.height,c.bbox.width)>=contract['minimum_broad_extent']
        and c.area>=minimum_area and not c.touches_frame_boundary
        and not glyph_pixels.intersection(c.pixels))
    higher_values=frozenset(c.value for c in brighter)
    # Moving glyphs must not manufacture a changing illumination observation.
    if track:
        extent=patches[0]['extent']
        glyph_pixels.update((r+dr,c+dc) for r,c in track.get('prefix_positions',())
                            for dr in range(extent) for dc in range(extent))
    sequence=((before,) if before is not None else ())+tuple(packet)
    if track and track.get('first_absent_index') is not None:
        sequence=sequence[:track['first_absent_index']+1]
    exchanged=set(); transition_count=0
    for a,b in zip(sequence,sequence[1:]):
        if (a.height,a.width)!=(frame.height,frame.width) or (b.height,b.width)!=(frame.height,frame.width):
            continue
        changed={(r,c) for r in range(frame.height) for c in range(frame.width)
                 if (r,c) not in glyph_pixels and
                 ((a.rows[r][c]==value and b.rows[r][c] in higher_values)
                  or (b.rows[r][c]==value and a.rows[r][c] in higher_values))}
        transition_count+=bool(changed);exchanged.update(changed)
    return FrozenMap({'gray_common_perimeter_present':True,
        'gray_common_perimeter_value':value,
        'gray_common_relative_luminance':luminances[value],
        'gray_broader_higher_component_count':len(brighter),
        'gray_broader_higher_pixel_count':sum(c.area for c in brighter),
        'gray_higher_min_relative_luminance':min((luminances[c.value] for c in brighter),default=luminances[value]),
        'gray_higher_vs_common_luminance_order':int(bool(brighter)),
        'gray_higher_component_refs':tuple(c.component_id for c in brighter),
        'gray_higher_palette_values':tuple(sorted(higher_values)),
        'gray_exchange_transition_count':transition_count,
        'gray_exchanged_pixel_count':len(exchanged)})
