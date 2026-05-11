// ─────────────────────────────────────────────────────────────────────────────
// AbilityExecutor.ts
//
// Sequential cast pipeline.  Iterates an ability's AbilityEffect list,
// dispatches each step through AbilityEffectHandler, and returns the total
// estimated tile count cleared.
//
// Design notes:
//   • Synchronous from the caller's perspective — effects that need internal
//     timing (chain_reaction stagger) schedule their own delayedCall inside
//     their handlers; the executor does not await them.
//   • The caller (AbilitySystem) is responsible for setting board.setInteractive(false)
//     before cast and triggering gravity/refill after castDuration.
//   • Built-in handlers are registered once here via registerBuiltIns(); do NOT
//     call registerBuiltIns() again at runtime.
// ─────────────────────────────────────────────────────────────────────────────

import type { AbilityType }                             from '../board/ComponentTypes';
import { ABILITY_CATALOG }                              from './AbilityDefinitions';
import {
  AbilityEffectHandler,
  AbilityEffectContext,
}                                                       from './AbilityEffectHandler';

// Register built-ins exactly once when the module is first imported.
AbilityEffectHandler.registerBuiltIns();

// ══════════════════════════════════════════════════════════════════════════════
// AbilityExecutor
// ══════════════════════════════════════════════════════════════════════════════

export class AbilityExecutor {

  /**
   * Execute all effects for the given ability in catalog order.
   *
   * @param abilityType  Which ability to execute.
   * @param context      Scene, board, effects, and optional callbacks.
   * @returns            Sum of estimated tile counts cleared across all effects.
   */
  cast(abilityType: AbilityType, context: AbilityEffectContext): number {
    const def = ABILITY_CATALOG[abilityType];
    if (!def) {
      console.warn(`[AbilityExecutor] Unknown ability: ${abilityType}`);
      return 0;
    }

    let totalCleared = 0;
    for (const effect of def.effects) {
      totalCleared += AbilityEffectHandler.execute(effect, context);
    }
    return totalCleared;
  }

  /**
   * How long (ms) the caller should wait after cast() before triggering
   * gravity/refill.  Reads directly from the catalog entry.
   */
  getCastDuration(abilityType: AbilityType): number {
    return ABILITY_CATALOG[abilityType]?.castDuration ?? 600;
  }
}
