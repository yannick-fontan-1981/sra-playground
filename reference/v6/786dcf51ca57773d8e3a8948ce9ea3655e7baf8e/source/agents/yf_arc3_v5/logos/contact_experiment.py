"""Frozen observed cell contact; no attachment or action authority."""
from typing import Literal
from pydantic import Field, model_validator
from .types import FrozenModel, Ref


class ContactExperimentWitness(FrozenModel):
    frame_ref: Ref
    actor_component_ref: Ref
    subject_component_ref: Ref
    actor_bbox: tuple[int, int, int, int]
    subject_bbox: tuple[int, int, int, int]
    cell_pitch: int = Field(gt=0, le=64)
    contact_geometry_kind: Literal['cell_face_neighbors', 'observed_pixel_boundary'] = 'cell_face_neighbors'
    pixel_contact_pair: tuple[tuple[int, int], tuple[int, int]] | None = None

    @model_validator(mode="after")
    def validate_measured_contact(self):
        if self.actor_component_ref == self.subject_component_ref:
            raise ValueError('contact must concern distinct observed components')
        if self.contact_geometry_kind == 'observed_pixel_boundary':
            if self.pixel_contact_pair is None:
                raise ValueError('pixel boundary contact requires an observed pixel pair')
            for point, box in zip(self.pixel_contact_pair, (self.actor_bbox, self.subject_bbox)):
                top,left,bottom,right=box
                if not (0 <= top <= point[0] <= bottom < 64 and 0 <= left <= point[1] <= right < 64):
                    raise ValueError('contact pixel must lie inside its complete component bounds')
            a,b=self.pixel_contact_pair
            if abs(a[0]-b[0])+abs(a[1]-b[1]) != 1:
                raise ValueError('observed boundary pixels must share a face')
            return self
        if self.pixel_contact_pair is not None:
            raise ValueError('cell neighbor contact cannot silently consume a pixel witness')
        for top, left, bottom, right in (self.actor_bbox, self.subject_bbox):
            if not (0 < bottom - top + 1 <= self.cell_pitch and 0 < right - left + 1 <= self.cell_pitch):
                raise ValueError("contact witness must retain whole bounded cell bodies")
        a, b = self.actor_bbox, self.subject_bbox
        delta = (a[0] + a[2] - b[0] - b[2], a[1] + a[3] - b[1] - b[3])
        if self.actor_component_ref == self.subject_component_ref or sorted(map(abs, delta)) != [0, 2 * self.cell_pitch]:
            raise ValueError("contact witness is not an observed face-neighbor pair")
        return self
