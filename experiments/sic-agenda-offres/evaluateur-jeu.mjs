// Évaluateur du préfixe DICO : seul le paquet public passe du jeu au service.
import { readFile } from 'node:fs/promises';

export async function evaluateurJeu(root) {
  const native = path => import(new URL('src/' + path, root));
  const { createNativeV6Runtime } = await native('logos-engine/v6-native-runtime.ts');
  const { V6AgentService } = await native('runtime/v6-agent-service.ts');
  const { defaultRecoveryPack } = await native('sic/active-recovery.ts');
  const { defaultBrowserFamilyAgenda } = await native('sic/family-agenda.ts');
  const { toV6PublicObservation } = await native('runtime/v6-agent-protocol.ts');
  const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',root);
  const read = async file => JSON.parse(await readFile(new URL(file, source),'utf8'));
  const declarations = { common: await read('laya_proto/common_frontier_policy.drm.json'), strategy: await read('morphology_policy/strategy.drm') };
  return {
    defaultRecoveryPack,
    createService: () => new V6AgentService(config => createNativeV6Runtime(declarations, {
      recovery: { ...config, familyAgenda: defaultBrowserFamilyAgenda }, now: () => 0,
    })),
    packet: (board,step) => toV6PublicObservation({ ...board, gameCode: board.code ?? board.gameCode },step),
  };
}
