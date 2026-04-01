import type { GameLogEntry } from '@/types/game.types';

let logCounter = 0;

export function createLogEntry(
  message: string,
  type: GameLogEntry['type'] = 'action'
): GameLogEntry {
  logCounter += 1;
  return {
    id: `log-${logCounter}-${Date.now()}`,
    timestamp: Date.now(),
    message,
    type,
  };
}
