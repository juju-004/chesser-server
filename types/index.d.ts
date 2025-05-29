export interface GameTimer {
  white: number; // in milliseconds
  black: number; // in milliseconds
  lastUpdate: number; // timestamp
}

export interface Game {
  id?: number | string;
  pgn?: string;
  white?: User;
  black?: User;
  activePlayer?: "white" | "black";
  winner?: "white" | "black" | "draw";
  endReason?:
    | "draw"
    | "checkmate"
    | "stalemate"
    | "repetition"
    | "insufficient"
    | "abandoned"
    | "timeout"
    | "resigned"
    | "aborted";
  code?: string;
  timeout?: number;
  startedAt?: number;
  endedAt?: number;
  timer?: GameTimer;
  timeControl: number; // in minutes
  stake: number;
}

export interface User {
  id?: number | string; // string for guest IDs
  name?: string | null;
  email?: string;
  wins?: number;
  losses?: number;
  draws?: number;
  verified?: boolean;

  // mainly for players, not spectators
  wallet?: number;
  isHost?: boolean;
}

export interface Message {
  author: User;
  message: string;
}

export interface FriendRequest {
  from: string; // sender ID
  to: string; // receiver ID
  createdAt?: string;
}
