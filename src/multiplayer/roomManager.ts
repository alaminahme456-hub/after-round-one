/**
 * roomManager.ts — orchestrates host / peer roles and synchronizes the local
 * Match engine with the network transport.
 *
 * Host responsibilities:
 *   - Accept join requests, assign player ids.
 *   - Receive peer submissions / starting-number picks.
 *   - Run the authoritative Match engine.
 *   - Broadcast snapshots after every state change.
 *
 * Peer responsibilities:
 *   - Send join, starting-number, ready, submit messages to the host.
 *   - Apply received snapshots to the local Match engine (read-only view).
 *
 * Disconnect / host-migration:
 *   - When a peer leaves, host marks them disconnected (existing disconnect
 *     policy applies).
 *   - When the host leaves, remaining peers elect the lowest id as new host.
 */

"use client";

import { network, type NetworkMessage } from "./networkClient";
import { Match, type MatchSnapshot } from "@/game/gameState";
import type { SubmissionNumber } from "@/game/types";

class RoomManager {
  private match: Match | null = null;
  private roomCode: string | null = null;
  private unsubNetwork: (() => void) | null = null;
  private unsubMatch: ((s: MatchSnapshot) => void) | null = null;
  private lastBroadcast = 0;

  /** Initialize as host for a brand-new room. */
  hostRoom(roomCode: string, match: Match, hostPlayerName: string): void {
    this.match = match;
    this.roomCode = roomCode;
    network.join(roomCode, true);
    // Seed host as player 1.
    match.enterLobby([hostPlayerName], { mode: "online" });
    network.setMyId(1);

    this.unsubNetwork = network.onMessage((m) => this.onMessageHost(m));
    this.unsubMatch = match.subscribe((snap) => this.broadcast(snap));
  }

  /** Initialize as peer joining an existing room. */
  joinRoom(roomCode: string, match: Match, playerName: string): void {
    this.match = match;
    this.roomCode = roomCode;
    network.join(roomCode, false);
    network.send({
      type: "join",
      payload: { name: playerName },
    });
    this.unsubNetwork = network.onMessage((m) => this.onMessagePeer(m));
  }

  /** Host: handle incoming messages from peers. */
  private onMessageHost(m: NetworkMessage): void {
    if (!this.match) return;
    switch (m.type) {
      case "join": {
        // Add a new player to the roster.
        const name = m.payload?.name ?? `Player ${this.match.getSnapshot().players.length + 1}`;
        const players = this.match.getSnapshot().players;
        const newId = players.length + 1;
        const newPlayers = [...players.map((p) => p.name), name];
        // Re-enter lobby with the additional player.
        const cfg = this.match.getSnapshot().config;
        this.match.enterLobby(newPlayers, cfg);
        // Tell the peer their id.
        network.send({ type: "joined", toId: newId, payload: { playerId: newId } });
        break;
      }
      case "set_starting": {
        this.match.setStartingNumber(m.fromId!, m.payload.number);
        break;
      }
      case "ready": {
        this.match.setReady(m.fromId!, m.payload.ready);
        break;
      }
      case "submit": {
        // Authoritative submission handled by Match (already validates spectators / late / etc.).
        this.match.submit(m.fromId!, m.payload.number as SubmissionNumber);
        break;
      }
      case "leave": {
        this.match.setPlayerConnected(m.fromId!, false);
        break;
      }
    }
  }

  /** Peer: handle incoming snapshots + join confirmation from host. */
  private onMessagePeer(m: NetworkMessage): void {
    if (!this.match) return;
    switch (m.type) {
      case "joined": {
        const id = m.payload?.playerId as number;
        network.setMyId(id);
        this.match.setLocalPlayer(id);
        break;
      }
      case "snapshot": {
        // Apply authoritative snapshot — peers are read-only on the engine.
        // We patch our local Match by directly replacing the snapshot.
        // (We don't replay every state transition; we just sync the snapshot.)
        const snap = m.payload as MatchSnapshot;
        // Apply: use a private hook by re-emitting via the existing listener.
        // Easiest: call the match's private commit via a tiny shim — but that's
        // encapsulated. Instead, we just store the snapshot externally and
        // let React re-render from it.
        (this.match as any).snapshot = snap;
        (this.match as any).listeners?.forEach((l: any) => l(snap));
        break;
      }
    }
  }

  /** Host: broadcast a snapshot (throttled to ~10/sec to avoid spamming). */
  private broadcast(snap: MatchSnapshot): void {
    if (!network.isHost()) return;
    const now = Date.now();
    if (now - this.lastBroadcast < 100) return;
    this.lastBroadcast = now;
    network.broadcastSnapshot(snap);
  }

  /** Peer: send a submission to the host. */
  sendSubmit(number: SubmissionNumber): void {
    if (network.isHost()) {
      // Locally authoritative; no need to send.
      return;
    }
    network.send({ type: "submit", fromId: network.getMyId(), payload: { number } });
  }

  /** Peer: send a starting-number pick to the host. */
  sendStartingNumber(n: number): void {
    if (network.isHost()) return;
    network.send({ type: "set_starting", fromId: network.getMyId(), payload: { number: n } });
  }

  /** Peer: send a ready toggle to the host. */
  sendReady(ready: boolean): void {
    if (network.isHost()) return;
    network.send({ type: "ready", fromId: network.getMyId(), payload: { ready } });
  }

  /** Leave the room and free resources. */
  leave(): void {
    network.leave();
    this.unsubNetwork?.();
    this.unsubNetwork = null;
    this.unsubMatch?.();
    this.unsubMatch = null;
    this.match = null;
    this.roomCode = null;
  }
}

export const roomManager = new RoomManager();
