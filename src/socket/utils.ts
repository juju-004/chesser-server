import { Socket } from "socket.io";
import GameService, { activeGames } from "../db/services/game.js";
import { Game } from "../../types/index.js";
import { io } from "../server.js";

interface GameOverProps {
  game: Game;
  winnerSide?: "white" | "black" | "draw";
  winnerName?: string;
}

// Helper function to find the game by its code
export const findGameByCode = (socket: Socket) =>
  activeGames.get(Array.from(socket.rooms)[1]);

export const deleteGameByCode = (socket: Socket) =>
  activeGames.delete(Array.from(socket.rooms)[1]);

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
  console.log("gameOver", game);

  game.winner = winnerSide || "draw";
  game.status = "ended";

  const result = await GameService.save(game);
  if (game.timeout) clearTimeout(game.timeout);

  io.to(game.code).emit("gameOver", { winnerName, winnerSide, result });
  activeGames.delete(result.code);
};
