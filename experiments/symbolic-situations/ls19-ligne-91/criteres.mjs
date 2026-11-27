import { isDeepStrictEqual as eq } from 'node:util';
const repeat='confirm_access_obstruction';
export function evaluate(spec,turns) {
  const checks=[];
  const test=(name,valid)=>checks.push({name,ok:Boolean(valid)});
  const last=spec.step+spec.tail,approach=turns[11]?.view,prior=turns[12],after=turns[13];
  test('horizon public atteint',turns.length===last+1);
  test('besoin établi avant le contact',approach?.kind==='observe_view_access' && approach.parent==='G_official_completion' &&
    approach.released===approach.objective && !!approach.need && approach.branch==='approach_view_edge');
  const first=prior?.event, trial=prior?.view;
  test('clôture de l’approche liée à sa révision',first?.receipt?.need===approach?.need &&
    first?.receipt?.objective===approach?.released && !!first?.to && first.receipt.evidence===first.to &&
    first.from!==first.to && prior?.returned?.closure?.objective===approach?.released);
  const shouldRepeat=spec.step===13 || spec.change==='identique';
  if (!shouldRepeat) {
    test('ancien ticket sans confirmation lorsque le témoin ne correspond plus',
      !!prior && trial?.branch!==repeat && turns.slice(12).every(r=>r.view?.branch!==repeat));
    test('question périmée écartée au retour suivant',after?.event?.block===null);
    test('aucun reçu attribué à une confirmation non libérée',after?.event?.receipt?.objective!==approach?.released &&
      !turns.slice(12).some(r=>r.view?.branch===repeat && r.view?.key===first?.block?.key));
    return finish();
  }
  test('une seule immobilité dans la même vue permet un essai',
    first?.block?.stationary_trials===1 && eq(first?.offset,[0,0]) && trial?.branch===repeat &&
    trial.obstruction===true && trial.repeated===false && trial.attempts===1 && trial.priorPassage===true &&
    trial.exclusive===false && !!first.block.key && trial.key===first.block.key);
  test('sous-objectif propre sous le même besoin',!!trial && trial.kind==='observe_view_access' &&
    trial.need===approach?.need && trial.parent===approach?.parent && !!trial.objective &&
    trial.objective===trial.released && trial.objective!==approach?.objective);
  test('geste lié à l’arrêt et garde admis',eq(prior?.command,turns[11]?.command) &&
    prior?.command?.actionRef==='ACTION2' && trial?.admitted && trial.guard==='bound_view_step');
  test('preuve datée avant et après l’arrêt',trial?.revision===first?.to && !!first?.to &&
    trial?.refs?.includes(first.from) && trial.refs.includes(first.to));
  const second=after?.event;
  test('répétition consommée, reçu lié au nouveau plan et à la nouvelle révision',
    !!second?.receipt && first?.to===second.from && second.from!==second.to &&
    second.receipt.evidence===second.to && second.receipt.need===trial?.need &&
    second.receipt.objective===trial?.released && after.returned?.closure?.objective===trial?.released);
  test('pas de gain de vue aux deux retours',first?.receipt?.newPixels===0 && second?.receipt?.newPixels===0 &&
    second?.receipt?.status==='no_new_area');
  if(spec.change==='passage') test('la pose modifiée lève la question de blocage',second?.block===null);
  else test('deuxième immobilité inscrite sous la même clé',second?.block?.stationary_trials===2 &&
    second.block.key===first?.block?.key && eq(second.offset,[0,0]));
  test('aucune troisième confirmation avec le même dossier',turns.length>13 &&
    turns.slice(13).every(r=>r.view?.branch!==repeat));
  test('prochain choix distinct du plan de confirmation',!!after?.command && after.view?.objective!==trial?.released);
  return finish();
  function finish(){return {ok:checks.every(x=>x.ok),checks:checks.length,ecarts:checks.filter(x=>!x.ok).map(x=>x.name)};}
}
