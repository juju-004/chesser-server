import { Game } from "../types/index.js";

// In a shared module, e.g. socketState.ts
export const onlineUsers = new Map<string, string>(); // userId => socketId

export const activeGames: Map<string, Game> = new Map();
