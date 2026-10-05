import { DayState } from './types';

/**
 * WHAT: Transition table defining valid moves between day states.
 * WHY: Strict state machine prevents invalid actions like selling after unload requested.
 * TIME COMPLEXITY: O(1)
 */
const stateTransitions: Record<DayState, DayState[]> = {
  NOT_STARTED: ['LOADING', 'ON_ROUTE'],
  LOADING: ['ON_ROUTE'],
  ON_ROUTE: ['UNLOAD_REQUESTED'],
  UNLOAD_REQUESTED: ['APPROVED', 'SENT_BACK'],
  SENT_BACK: ['UNLOAD_REQUESTED'],
  APPROVED: ['CLOSED'],
  CLOSED: []
};

export function canTransition(currentState: DayState, targetState: DayState): boolean {
  return stateTransitions[currentState].includes(targetState);
}
