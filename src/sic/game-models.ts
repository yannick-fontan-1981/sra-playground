interface GameModel {
  readonly title: string;
  readonly summary: string;
  readonly relations: readonly (readonly [string, string])[];
  readonly unresolved: string;
}

/** Curated descriptions, independent of any policy or live inference. */
export const documentedGameModels: Readonly<Partial<Record<string, GameModel>>> = {
  STCK: {
    title: 'STCK is a programmable machine',
    summary: 'The column on the left is the program. Clicks edit its cards. Space runs the programmed sequence on the isometric board.',
    relations: [
      ['Edit', 'Click a card to remove it. The shop buttons can add cards.'],
      ['Program', 'The order of the cards matters. The stack represents movement, attack and push instructions.'],
      ['Run', 'Space switches from editing to execution. Cards are highlighted while the board returns an animation.'],
    ],
    unresolved: 'If several cards light up together, the highlight does not identify a unique instruction. A matching frame alone cannot attribute every change to that instruction.',
  },
};
