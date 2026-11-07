"""Neutral observation completion for the public field/material model."""
from common_addressed_field import AddressedField
from common_linked_preparation import LinkedPreparation


class AddressedMaterial(AddressedField):
    full_observation = staticmethod(LinkedPreparation.full_observation)

    def before(self, proposal, index, public, observation):
        self.current_observation = self.full_observation(observation, public.frame_rows)
        return super().before(proposal, index, public, self.current_observation)

    def after(self, proposal, index, before, after, first, second):
        prior = self.full_observation(before, first)
        self.current_observation = self.full_observation(after, second)
        return super().after(proposal, index, prior, self.current_observation, first, second)
