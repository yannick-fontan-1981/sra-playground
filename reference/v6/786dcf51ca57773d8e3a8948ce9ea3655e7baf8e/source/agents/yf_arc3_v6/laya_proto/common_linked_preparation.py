"""Neutral public-transport adapter for linked temporal preparations."""
from types import SimpleNamespace
from common_phase_relations import PhaseRelations
from neutral_observer import measure


class LinkedPreparation:
    def __init__(self):
        self.phase = PhaseRelations()
        self.events = []
        self.passed = []
        self.current_observation = None

    @staticmethod
    def full_observation(observation, rows):
        if 'entities' in observation:
            return observation
        public = SimpleNamespace(frame_rows=rows, level=observation['level_epoch'],
                                 levels_completed=observation['levels_completed'], state=observation['state'],
                                 frame_hash=observation['frame_hash'], available_action_refs=observation['available_action_refs'])
        scope = observation['observation_ref'].split(':epoch:')[0]
        return measure(public, observation['revision'], scope)[0]

    def propose(self, observation, rows, inputs, remaining):
        if not self.phase.states:
            return None
        proposal = self.phase.linked_contact.propose(self.phase, observation, rows, inputs, remaining)
        if proposal:
            proposal['linked_preparation_plan'] = True
        return proposal

    def bind(self, proposal, domain):
        domain.bind_proposal(proposal)

    def before(self, proposal, index, public, observation):
        self.current_observation = self.full_observation(observation, public.frame_rows)
        return self.phase.before(proposal, index, public, self.current_observation)

    def after(self, proposal, index, before, after, first, second):
        prior = self.full_observation(before, first)
        self.current_observation = self.full_observation(after, second)
        return self.phase.after(proposal, index, prior, self.current_observation, first, second)

    def record(self, before, after, command, first, second, proposal=None, index=None):
        events = self.phase.record(before, after, command, first, second)
        self.events.extend(events)
        if after['levels_completed'] > before['levels_completed']:
            self.passed.append({'score': after['levels_completed'], 'observation_ref': after['observation_ref']})
        return events

    def preservation_obligations(self, observation, rows):
        return self.phase.preservation_obligations(observation, rows)
