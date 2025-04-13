export interface GameTimer {
    whiteTime: number; // in milliseconds
    blackTime: number; // in milliseconds
    lastUpdate: number; // timestamp
    activeColor: "white" | "black";
    started: boolean;
}

export interface Game {
    id?: number | string;
    pgn?: string;
    white?: User;
    black?: User;
    status?: "started" | "inPlay" | "ended";
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
    host?: User;
    code?: string;
    unlisted?: boolean;
    timeout?: number;
    observers?: User[];
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
    wallet?: string;
    connected?: boolean;
    disconnectedOn?: number;
    offersDraw?: number;
}
