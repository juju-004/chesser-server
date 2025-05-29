import { Game, Message, User } from "../types/index.js";

export type ChallengeData = {
  from: Partial<User>;
  to: string;
  side: "white" | "black" | "random";
  timeControl: number; // in minutes, or a { base, increment } object
  amount: number; // wagered amount or points
};

export const activeChallenges = new Map<string, ChallengeData>();
export const onlineUsers = new Map<string, string>(); // userId => socketId
export const activeGames: Map<string, Game> = new Map();
export const gameRooms: Record<string, Map<string, any>> = {};
export const gameChats = new Map<string, Message[]>();

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
