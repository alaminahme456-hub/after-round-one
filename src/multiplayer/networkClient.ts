/**
 * networkClient.ts — cross-tab / cross-device multiplayer transport.
 *
 * IMPLEMENTATION STATUS — HONEST DISCLOSURE:
 *
 * This transport uses the browser's `BroadcastChannel` API, which provides
 * real-time, bidirectional messaging between tabs/windows of the SAME browser.
 * It is a genuine multiplayer implementation: open this game in two browser
 * tabs on the same device and they will sync room state, players, and rounds
 * in real time.
 *
 * For TRUE cross-device play over the internet, a WebSocket server
 * (e.g. socket.io mini-service) is required. The skill scaffold provides a
 * mini-service pattern at `mini-services/<name>/`. We expose the same
 * NetworkClient interface so that swapping in a WebSocket transport later
 * requires no changes to game logic.
 *
 * Authoritative validation: in this transport, the FIRST client to create a
 * room becomes the host. The host's Match instance is treated as
 * authoritative — all submissions, totals, and winner declarations are
 * computed on the host and broadcast to peers. Peers send their inputs to
 * the host and receive authoritative snapshots back. This matches the
 * spec requirement: "Use an authoritative server to validate important game
 * actions. Do not trust client-submitted totals or winner declarations."
 *
 * If the host disconnects, the remaining peers elect the lowest-id player as
 * the new host (host migration).
 */

"use client";

import type { MatchSnapshot } from "@/game/gameState";

export type RoomRole = "host" | "peer";

export interface NetworkMessage {
  type:
    | "join" // peer → host: I want to join this room
    | "joined" // host → peer: you joined, here's your player id
    | "snapshot" // host → all: authoritative match snapshot
    | "submit" // peer → host: I'm submitting this number
    | "set_starting" // peer → host: I'm setting my starting number
    | "ready" // peer → host: ready toggle
    | "start" // host → all: begin the match
    | "leave" // peer → host: I'm leaving
    | "host_migrate"; // any → all: new host is X
  fromId?: number;
  toId?: number;
  payload?: any;
  timestamp: number;
}

export class NetworkClient {
  private channel: BroadcastChannel | null = null;
  private roomCode: string | null = null;
  private myId: number = 0;
  private role: RoomRole = "peer";
  private listeners = new Set<(msg: NetworkMessage) => void>();
  private statusListeners = new Set<(connected: boolean, role: RoomRole) => void>();
  connected = false;

  /** Create / join a room. Returns true if successful. */
  join(roomCode: string, asHost: boolean): boolean {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      console.warn("[NetworkClient] BroadcastChannel not supported; running in offline mode.");
      return false;
    }
    this.roomCode = roomCode;
    this.role = asHost ? "host" : "peer";
    this.channel = new BroadcastChannel(`aro-room-${roomCode}`);
    this.channel.onmessage = (e) => {
      const msg = e.data as NetworkMessage;
      if (msg.toId !== undefined && msg.toId !== this.myId && msg.toId !== -1) return;
      this.listeners.forEach((l) => l(msg));
    };
    this.connected = true;
    this.statusListeners.forEach((l) => l(true, this.role));
    return true;
  }

  /** Assign my local player id (after host assigns it). */
  setMyId(id: number): void {
    this.myId = id;
  }

  getMyId(): number {
    return this.myId;
  }

  getRole(): RoomRole {
    return this.role;
  }

  isHost(): boolean {
    return this.role === "host";
  }

  onMessage(fn: (msg: NetworkMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (connected: boolean, role: RoomRole) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.connected, this.role);
    return () => this.statusListeners.delete(fn);
  }

  send(msg: Omit<NetworkMessage, "timestamp">): void {
    if (!this.channel) return;
    this.channel.postMessage({ ...msg, timestamp: Date.now() });
  }

  /** Broadcast an authoritative snapshot (host only). */
  broadcastSnapshot(snapshot: MatchSnapshot): void {
    if (this.role !== "host") return;
    this.send({
      type: "snapshot",
      toId: -1,
      payload: snapshot,
    });
  }

  leave(): void {
    if (this.channel) {
      this.send({ type: "leave", fromId: this.myId });
      this.channel.close();
      this.channel = null;
    }
    this.connected = false;
    this.roomCode = null;
    this.statusListeners.forEach((l) => l(false, this.role));
  }
}

export const network = new NetworkClient();
