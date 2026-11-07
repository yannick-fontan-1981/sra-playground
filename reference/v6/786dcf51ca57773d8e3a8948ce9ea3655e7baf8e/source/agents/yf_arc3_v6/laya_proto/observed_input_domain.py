"""Neutral, bounded samples of addressed input. An occurrence is not a role."""
from collections import defaultdict


class ObservedInputDomain:
    def __init__(self, max_loci):
        if not 1 <= max_loci <= 4096:
            raise ValueError("Invalid declared sample cap")
        self.limit = max_loci
        self.bindings = {}

    def candidates(self, observation):
        available = set(observation['available_action_refs'])
        actions = [{'action_ref': a, 'data': {}} for a in sorted(available & {
            'ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'})]
        if 'ACTION6' not in available:
            return actions
        groups = defaultdict(list)
        for ent in observation['entities']:
            mask = ent['mask']
            if not mask:
                continue
            left, top = ent['position']
            # Nearest actual support pixel to the occurrence centroid.
            n = len(mask); sx = sum(x for x,y in mask); sy = sum(y for x,y in mask)
            x,y = min(mask, key=lambda p: ((n*p[0]-sx)**2+(n*p[1]-sy)**2,p[1],p[0]))
            groups[ent['signature']].append((left+x,top+y,ent))
        # Sample one occurrence of each measured signature before repeats.
        ordered = sorted((i,sig,x,y,ent) for sig,group in groups.items()
                         for i,(x,y,ent) in enumerate(sorted(group,key=lambda p:(p[1],p[0]))))
        table = {}
        for _,sig,x,y,ent in ordered[:self.limit]:
            table[x,y] = {'observation_ref':observation['observation_ref'],
                'level_epoch':observation['level_epoch'],'frame_hash':observation['frame_hash'],
                'entity_ref':ent['id'],'signature':sig,'bbox':list(ent['bbox']),
                'palette_value':ent['palette_value'],'point':[x,y],
                'total_occurrences':len(ordered),'sampled_occurrences':min(len(ordered),self.limit)}
            actions.append({'action_ref':'ACTION6','data':{'x':x,'y':y}})
        self.bindings[observation['level_epoch'],observation['frame_hash']] = table
        return actions

    @staticmethod
    def make_locus_witness(observation, rows, point, *, reason, evidence):
        """Bind one source-derived locus to its actual public support pixel.

        This supplements centroid sampling for a declared relational question.
        The owning composition must separately guard its receiver and premises.
        """
        from common_multiscale_constraints import rows_digest
        x, y = point
        if not reason or not evidence or not isinstance(x, int) or not isinstance(y, int):
            raise ValueError('A derived locus needs integer coordinates and symbolic provenance')
        if not (0 <= y < len(rows) and 0 <= x < len(rows[y])):
            raise ValueError('Derived locus is outside the public image')
        owners = [entity for entity in observation['entities']
                  if any(tuple(pixel) == (x - entity['position'][0], y - entity['position'][1]) for pixel in entity['mask'])]
        if len(owners) != 1:
            raise ValueError('Derived locus lacks one measured pixel owner')
        entity = owners[0]
        return {'observation_ref': observation['observation_ref'], 'level_epoch': observation['level_epoch'],
                'frame_hash': observation['frame_hash'], 'entity_ref': entity['id'], 'signature': entity['signature'],
                'bbox': list(entity['bbox']), 'palette_value': int(rows[y][x]), 'point': [x, y],
                'projection_bbox': [x, y, x, y], 'projected_rows_digest': rows_digest([[rows[y][x]]]),
                'scope': 'source_derived_locus_on_observed_pixel', 'reason': reason, 'evidence': list(evidence)}

    def bind_proposal(self, proposal):
        for cmd,step in zip(proposal['actions'],proposal['steps'],strict=True):
            if cmd['action_ref'] != 'ACTION6':
                continue
            expected = step['expected_before']; point=cmd['data']
            step['point_binding'] = self.bindings[expected['level_epoch'],expected['frame_hash']][point['x'],point['y']].copy()

    @staticmethod
    def point_guard(public,command,step):
        if command['action_ref'] != 'ACTION6':
            return True
        witness = step.get('point_binding')
        if not witness or public.level != witness['level_epoch']:
            return False
        if 'projected_rows_digest' in witness:
            from common_multiscale_constraints import rows_digest,projection
            if rows_digest(projection(public.frame_rows,witness['projection_bbox']))!=witness['projected_rows_digest']:return False
        elif public.frame_hash != witness['frame_hash']:return False
        point = command['data']; x,y = point['x'],point['y']; rows=public.frame_rows
        return ([x,y] == witness['point'] and 0 <= y < len(rows) and
                0 <= x < len(rows[y]) and rows[y][x] == witness['palette_value'])
