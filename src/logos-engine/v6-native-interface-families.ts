/**
 * Native runtime boundaries for the four transferred program interfaces.
 *
 * The original strategy selects these through `program_construction` in the
 * `surface` group. The caller must apply the retained DRM's ordered_subquestions;
 * this registry supplies providers, not an alternative selection policy.
 */
import { SlotSubstitution } from './v6-slot-substitution.ts';
import { WordInterface } from './v6-word-interface.ts';
import { PortAssembly } from './v6-port-assembly.ts';
import { ConstellationCover } from './v6-constellation-cover.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeFamily, NativeProposal } from './v6-native-types.ts';

export type NativeInterfaceQuestion = 'slot_substitution' | 'typed_word_interface'
  | 'rigid_port_assembly' | 'controlled_constellation_cover';
type ProgramInterface = SlotSubstitution | WordInterface | PortAssembly | ConstellationCover;

function programInterfaceFamily(question: NativeInterfaceQuestion, family: ProgramInterface): NativeFamily {
  return {
    id: family.familyId,
    propose: async (observation, rows, inputs, remaining) => {
      const proposal = await family.propose(observation, rows, inputs, remaining);
      if (!proposal) return null;
      // This is the exact annotation added by StrategyRouter.program_construction.
      // No command data, expectations, evidence, or learning state are rewritten.
      proposal.program_subquestion = question;
      return proposal as NativeProposal;
    },
    bind: (proposal, domain) => family.bind(proposal, domain),
    before: async (proposal, index, packet, observation) =>
      await family.before(proposal, index, packet, observation) as NativeBeforeResult,
    after: async (proposal, index, before, after, firstRows, secondRows) =>
      await family.after(proposal, index, before, after, firstRows, secondRows) as NativeAfterResult,
    // WordInterface and ConstellationCover acquire asynchronously. The actual
    // event must be complete before a prefix can retain it in the common graph.
    record: async (before, after, command, firstRows, secondRows, proposal, index) => ({
      events: [await family.record(before, after, command, firstRows, secondRows, proposal, index)],
    }),
    state: () => family.state(),
    restore: state => family.restore(state),
  };
}

/** Fresh, independent working memories for one native reasoning session. */
export function createNativeInterfaceFamilies(): Readonly<Record<NativeInterfaceQuestion, NativeFamily>> {
  return Object.freeze({
    slot_substitution: programInterfaceFamily('slot_substitution', new SlotSubstitution()),
    typed_word_interface: programInterfaceFamily('typed_word_interface', new WordInterface()),
    rigid_port_assembly: programInterfaceFamily('rigid_port_assembly', new PortAssembly()),
    controlled_constellation_cover: programInterfaceFamily('controlled_constellation_cover', new ConstellationCover()),
  });
}
