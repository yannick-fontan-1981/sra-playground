# P14 development protocol v1 (implementation contract)

Base: 20433007224accc36e3d7976696d9ee7a783a227. Development only: 80 pilot then 8000, 8 x equal quota. SS08–SS25 and operator reserve are excluded. No native victory is claimed by this simulator.

## Private specification (evaluation process only)

`{version:1, id, family, origin, budget:{actions:180,ticks:360,states:20000}, public:{channels:[string], initial:0,goal:number,actions:[Action]}, worlds:[World,...]}`.

Action: `{id,kind:'wait'|'inspect'|'trigger'|'hold'|'move',duration:number,from?:number,to?:number,gates?:string[],targets?:string[],holdTicks?:number,uses?:number,perturbs?:string[]}`. These are public measured interface/route premises for a P14-only bench, not hidden timing laws. All actions have positive tick duration. Any action specifying `from` is permitted only at that position, including hold/trigger. For a move, every gate must remain 1 for all ticks `start+1..start+duration`. Hold freezes current target values until `tick+holdTicks` (inclusive), consumes a finite visible use, and advances its own duration. Trigger is enabled when its targeted pulse channels have finished the previous pulse, starts them at the old tick, and advances its duration. A move may intervene on `perturbs`; private replacements start at its arrival tick.

World: `{channels:{[id]:Channel},replacements?:{[moveActionId]:{[id]:Channel}}}`.

Channel: `{kind:'clock',prefix:number[],cycle:number[],phase:number,mask?:number[],noise?:number[]}` OR `{kind:'pulse',delay:number,width:number,mask?:number[],noise?:number[]}`. Clock age = tick - start[id]. While age < prefix.length use prefix[age]; then cycle[(age-prefix.length+phase)%cycle.length]. Pulse off before trigger, then open exactly at ages delay..delay+width-1. starts initially 0 for clocks and null for pulses. Hold overrides reading/guard with frozen value until inclusive expiry, while base clock keeps running. Replacements happen only after traversed move, override channel parameters and reset that channel start to arrival tick (pulse null). Private `origin` only renames the absolute hidden clock: public elapsed ticks and behavior must be invariant.

## Agent input (no spec/seed/id/family/world/clock/solution)

Initialize once with `public` and `budget`. Thereafter `decide(history)` where history is the list of initial/command observations:

`{tick,position,terminal:null|'crossed'|'failed',frames:[{ref,tick,values:{[id]:number|null},reliable:{[id]:boolean},intermediate:boolean}],receipt:null|{action,kind,start,end,interventions:string[]},enabled:[actionId],holds:{[id]:{until,value}},uses:{[actionId]:number}}`.

Every executed command produces one frame per elapsed tick; final frame is last. Initial observation has frame at tick 0. Values masked when mask[age%len] is 0; noise bit 1 flips visible value and marks unreliable. Inspect bypasses both mask and noise. `ref` is `t:<tick>:c:<ordinal>` and does not contain a hidden ID. Disabled commands fail. All frames and command receipts preserve order and elapsed ticks. Agent receives a JSON copy only. Safe movement (and only movement) changes position; arrival at public.goal is actual simulated crossing. True guard truth and failures stay evaluation side until normal terminal feedback.

## Baseline / candidate and metrics

Same public policy adapter and P09 `composePlan`, baseline inference imports unchanged `inferWitnessedSuffixCycle` from base; candidate new observation-only inference. This is an isolated SIC primitive comparison, not full native SIC. Predictions are `{channel,tick,value,evidence:[frameRef]}` emitted before transition; evidence refers only to consumed public samples. Revision record identifies old prediction and contradicting public frame/intervention. Decision `{action,reason,mode:'act'|'wait'|'observe'|'revise'|'abstain',predictions:[],evidence:[],revisions:[]}`. Distinct model/policy and environment/oracle modules may not import each other.

`composition.executedGuards` carries the P09 premises for every gated tick of the selected movement. Its final pre-intervention guard is separate from the observable post-intervention frame prediction. Raw crossing and qualified success are separate: qualified success also requires valid prior evidence, complete temporal guards, and supported revisions. The candidate's inductive bounds are periods 2..24 and three reliable observations of each phase; unconfirmed longer laws are not ruled out. Incorrect early extrapolations remain scored as failures. The oracle certificate ranges over the finite two-world ensemble emitted with each case, not every possible temporal law.

Oracle independently implements transitions; certifies a history-based policy over all indistinguishable worlds, including all observation branches, under same action/tick bounds. It must not call candidate or baseline. Generator rejects a spec without this certificate. Independent replay cross-checks runtime transition traces. Oracle optimality not claimed.

Dedup canonical signature renames channel/action IDs, excludes family/id/seed/origin, retains transition-relevant timing, observable mask/noise, topology, duration and choices. Cosmetic origin shifts are separate metamorphic controls. On candidate gains remove exactly consumed frame contents (preserve ref/tick/action duration/world) and rerun; record action divergence, loss, extra observations, or retained success. Also permute names/presentation as invariance controls.
