import { Game } from "../types/index.js";

// In a shared module, e.g. socketState.ts
export const onlineUsers = new Map<string, string>(); // userId => socketId

export const addOnlineUser = (userId: string, socketId: string) => {
  onlineUsers.set(userId, socketId);
};

export const removeOnlineUser = (socketId: string) => {
  for (const [userId, sId] of onlineUsers.entries()) {
    if (sId === socketId) {
      onlineUsers.delete(userId);
      break;
    }
  }
};

export const getSocketId = (userId: string): string | undefined => {
  return onlineUsers.get(userId);
};

export const activeGames: Map<string, Game> = new Map();
