"""Bounded frame-group and parallel-cavity measurements, without semantic roles."""
from collections import Counter, defaultdict

from .components import detect_components
from .contracts import ComponentExtractionInput
from .framed_masks import measure_enclosed_frame_groups


def _box(row):
    return tuple(row['frame_bbox'])


def crop_counts(frame, bounds):
    top, left, bottom, right = bounds
    return tuple(sorted(Counter(frame.rows[y][x]
        for y in range(top+1, bottom) for x in range(left+1, right)).items()))


def _turn_point(point, height, width, turn):
    y, x = point
    for _ in range(turn):
        y, x, height, width = x, height-1-y, width, height
    return y, x


def _turn_box(bounds, height, width, turn):
    top, left, bottom, right = bounds
    points = tuple(_turn_point(p, height, width, turn)
        for p in ((top,left),(top,right),(bottom,left),(bottom,right)))
    return min(y for y,x in points), min(x for y,x in points), max(y for y,x in points), max(x for y,x in points)


def _turned_rows(frame, turn):
    rows = frame.rows
    for _ in range(turn):
        rows = tuple(tuple(row[x] for row in reversed(rows)) for x in range(len(rows[0])))
    return rows


def measure_parallel_frame_groups(frame, contract):
    """Enumerate Source-requested equal groups, adjacent cavities and parallels.

    Constant-border cavities use the existing framed-mask measurement. Only
    potential parallel companions permit full-width crossing stripes. Stripes
    are retained as geometry; no threshold, clock, material or device is named.
    """
    if frame.height*frame.width > contract['maximum_frame_pixels']:
        return (), False, 0
    cs = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    measured = measure_enclosed_frame_groups(frame, cs, contract)
    if not measured['enclosed_frame_groups_complete']:
        return (), False, measured['work_count']
    fixed = measured['enclosed_frame_groups']
    work = measured['work_count']
    background=(Counter(value for row in frame.rows for value in row).most_common(1)[0][0]
        if contract.get('crossing_rows_require_foreground') is True else None)
    found = {}
    multiple_signatures = set()

    def charge(amount=1):
        nonlocal work
        work += amount
        if work > contract['maximum_work']:
            raise OverflowError('parallel frame work bound')

    try:
        for singleton_pass in (False,True):
            if singleton_pass and contract.get('measure_homologous_single_frame_groups') is not True:
                continue
            for turn in contract['quarter_turns']:
                rows = _turned_rows(frame, turn)
                height, width = len(rows), len(rows[0])
                boxes = tuple(_turn_box(_box(r),frame.height,frame.width,turn) for r in fixed)
                groups = defaultdict(list)
                for b in boxes:
                    groups[(b[2]-b[0],b[3]-b[1],b[1])].append(b)
                for (h,w,left), aligned in sorted(groups.items()):
                    if (len(aligned) < contract['minimum_equal_frame_group']
                            and not (len(aligned)==1 and contract.get('measure_homologous_single_frame_groups') is True)):
                        continue
                    for adjacent in boxes:
                        charge(1+len(aligned))
                        t,l,b,r = adjacent
                        if not (l>left+w and l-(left+w)<=w and r-l==w and b-t>h):
                            continue
                        group = tuple(q for q in aligned if t <= (q[0]+q[2])/2 <= b)
                        singleton = len(group) == 1
                        if singleton != singleton_pass:
                            continue
                        if (len(group) < contract['minimum_equal_frame_group']
                                and not (singleton and contract.get('measure_homologous_single_frame_groups') is True)):
                            continue
                        if any(a[2] >= q[0] for a,q in zip(sorted(group),sorted(group)[1:])):
                            continue
                        for near_left in range(r+1,min(width-w,r+w+1)):
                            near_right = near_left+w
                            for near_top in range(t):
                                charge(b-near_top+1)
                                homology=(h,w,b-t,r-l,l-(left+w),near_left-r,b-near_top,t-near_top)
                                if singleton and homology not in multiple_signatures:
                                    continue
                                border = rows[near_top][near_left]
                                if border == background:
                                    continue
                                if not (all(v==border for v in rows[near_top][near_left:near_right+1])
                                        and all(v==border for v in rows[b][near_left:near_right+1])):
                                    continue
                                stripes=[]
                                for y in range(near_top+1,b):
                                    row = rows[y][near_left:near_right+1]
                                    if row[0]==row[-1]==border:
                                        if len(set(row))==1:
                                            stripes.append(y)
                                        continue
                                    if len(set(row))!=1 or row[0]==background:
                                        break
                                    stripes.append(y)
                                else:
                                    companion=(near_top,near_left,b,near_right)
                                    inverse=(4-turn)%4
                                    back=lambda q:_turn_box(q,height,width,inverse)
                                    members=tuple(sorted(back(q) for q in group))
                                    a,c=back(adjacent),back(companion)
                                    signature=(members,a,c)
                                    homology=(h,w,b-t,r-l,l-(left+w),near_left-r,b-near_top,t-near_top)
                                    measured={'equal_frame_group':members,
                                        'adjacent_frame':a,'parallel_frame':c,
                                        'description_quarter_turn':turn,
                                        'crossing_line_count':len(stripes),
                                        'homologous_single_frame_group':singleton}
                                    found[signature]=measured
                                    if not singleton:
                                        multiple_signatures.add(homology)
                                    if len(found)>contract['maximum_layout_count']:
                                        raise OverflowError('parallel frame count bound')
    except OverflowError:
        return (), False, work
    return tuple(found[k] for k in sorted(found)), True, work
