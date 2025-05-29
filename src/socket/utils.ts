import { Socket } from "socket.io";
import GameService from "../db/services/game.js";
import { Game, User } from "../../types/index.js";
import { io } from "../server.js";
import { activeGames, gameChats, gameRooms } from "../state.js";

interface GameOverProps {
  game: Game;
  winnerSide?: "white" | "black" | "draw";
  winnerName?: string;
}

// Helper function to find the game by its code
export const findGameByCode = (socket: Socket | string) => {
  return typeof socket === "string"
    ? activeGames.get(socket)
    : activeGames.get(socket.data.code as string);
};

export const findGameWithChatByCode = (socket: Socket) => {
  const game = activeGames.get(socket.data.code as string);
  const chat = gameChats.get(socket.data.code as string);
  return { game, chat };
};
export function isPlayerConnected(userId: string): boolean {
  return true;
}

export const deleteGameByCode = (socket: Socket) => {
  activeGames.delete(socket.data.code as string);
  gameChats.delete(socket.data.code as string);
};

// Helper function to get user from session
export const getUserFromSession = (socket: Socket) =>
  socket.request.session.user;

// Utility function to get updated timer data
export const getUpdatedTimer = (timer: Game["timer"]) => ({
  white: timer.white,
  black: timer.black,
});

export const gameOver = async ({
  game,
  winnerName,
  winnerSide,
}: GameOverProps) => {
  game.winner = winnerSide || "draw";

  const result = await GameService.save(game);
  if (game.timeout) clearTimeout(game.timeout);

  io.to(game.code).emit("game:over", { winnerName, winnerSide, result });
  activeGames.delete(result.code);
};

export const connectPlayer = async (
  gameCode: string,
  user: Partial<User>,
  socket: Socket
) => {
  if (!gameRooms[gameCode]) {
    gameRooms[gameCode] = new Map();
  }

  gameRooms[gameCode].set(socket.id, user);

  const users = Array.from(gameRooms[gameCode].values());
  io.to(gameCode).emit("update_connected_users", users);
};

export const disconnectPlayer = (socket: Socket) => {
  const gameCode = socket.data?.code;
  if (gameCode && gameRooms[gameCode]) {
    gameRooms[gameCode].delete(socket.id);

    if (gameRooms[gameCode].size === 0) {
      delete gameRooms[gameCode];
    } else {
      const users = Array.from(gameRooms[gameCode].values());
      io.to(gameCode).emit("update_connected_users", users);
    }
  }
};
