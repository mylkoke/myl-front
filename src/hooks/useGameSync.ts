import { useEffect } from 'react';
import { useGameStore, buildInitialState } from '@/store/gameStore';
import { useOnlineStore } from '@/store/onlineStore';
import { apiGameSyncService } from '@/services/api/gameSyncService';
import { snapshotGameState } from '@/utils/onlineSync';

/**
 * Mounts the realtime subscription for an online game: applies incoming
 * state updates and handles reconnection (socket reconnect + mobile
 * background/foreground via visibilitychange).
 */
export function useGameSync(gameId: string | null) {
  const hydrateState = useGameStore((s) => s.hydrateState);
  const addLog = useGameStore((s) => s.addLog);

  useEffect(() => {
    if (!gameId) return;

    const online = useOnlineStore.getState();

    const disconnect = apiGameSyncService.connect(gameId, {
      onStateUpdate: ({ state, version, status, winner_seat }) => {
        const { version: current, pendingVersion, setVersion, setPendingVersion } =
          useOnlineStore.getState();
        if (version <= current && version !== 0) return; // stale
        setVersion(version);
        if (pendingVersion !== null && version === pendingVersion) {
          setPendingVersion(null);
          return; // own echo: local state is already ahead
        }
        if (state) {
          hydrateState(
            status === 'finished'
              ? { ...state, isGameOver: true, winner: winner_seat }
              : state,
          );
        } else if (status === 'finished') {
          useGameStore.setState({ isGameOver: true, winner: winner_seat });
        }
      },
      onOpponentJoined: (payload) => {
        const store = useOnlineStore.getState();
        store.setOpponentName(payload.username);
        store.setOpponentOnline(true);

        // Initial pairing: the HOST builds the state from both active
        // decks and pushes version 0 → 1.
        if (
          store.mySeat === 'player' &&
          store.version === 0 &&
          payload.hostDeck?.length &&
          payload.guestDeck?.length
        ) {
          const initial = buildInitialState(payload.hostDeck, payload.guestDeck, {
            player: payload.hostName ?? 'Anfitrión',
            opponent: payload.guestName ?? 'Invitado',
          });
          hydrateState(initial);
          store.setPendingVersion(1);
          apiGameSyncService.pushState(gameId, snapshotGameState(), 0);
        }
      },
      onPresence: (isOnline) => useOnlineStore.getState().setOpponentOnline(isOnline),
      onError: (_code, message) => addLog(message, 'error'),
      onConnectionChange: (connected) =>
        useOnlineStore.getState().setConnection(connected ? 'connected' : 'disconnected'),
    });

    // Mobile back-from-background: force a fresh snapshot.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      apiGameSyncService
        .getGame(gameId)
        .then(({ state, version, status, winnerSeat }) => {
          const { version: current, setVersion } = useOnlineStore.getState();
          if (version > current && state) {
            setVersion(version);
            hydrateState(
              status === 'finished'
                ? { ...state, isGameOver: true, winner: winnerSeat }
                : state,
            );
          }
        })
        .catch(() => {/* offline: socket reconnect will handle it */});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    online.setConnection('connecting');

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      disconnect();
    };
  }, [gameId, hydrateState, addLog]);
}
