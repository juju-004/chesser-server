import { Socket } from "socket.io";
import GameService from "../db/services/game.js";
import { Game } from "../../types/index.js";
import { io } from "../server.js";
import { activeGames, gameChats, getSocketId } from "../state.js";

interface GameOverProps {
  game: Game;
  winnerSide?: "white" | "black" | "draw";
  winnerName?: string;
}

type Side = "white" | "black";

// Helper function to find the game by its code
export const findGameByCode = (socket: Socket | string) => {
  return typeof socket === "string"
    ? activeGames.get(socket)
    : activeGames.get(Array.from(socket.rooms)[1]);
};

export const findGameWithChatByCode = (socket: Socket) => {
  const game = activeGames.get(Array.from(socket.rooms)[1]);
  const chat = gameChats.get(Array.from(socket.rooms)[1]);
  return { game, chat };
};

export const getPlayerSide = (id: string, game: Game): Side | null => {
  if (id === game.white?.id) return "white" as Side;
  else if (id === game.black?.id) return "black" as Side;

  return null;
};

export function emitToOpponent(socket: Socket, ev: string, data: any) {
  const game = findGameByCode(socket);
  const pside = getPlayerSide(getUserFromSession(socket).id as string, game);
  if (!pside && !game) return;

  const opponentSide: Side = pside === "white" ? "black" : "white";

  if (game[opponentSide]) {
    const opponentId = getSocketId(game[opponentSide].id as string);
    io.to(opponentId).emit(ev, data);
  }
}

export const deleteGameByCode = (socket: Socket) => {
  activeGames.delete(Array.from(socket.rooms)[1] as string);
  gameChats.delete(Array.from(socket.rooms)[1] as string);
};

export const getUserFromSession = (socket: Socket) =>
  socket.request.session.user;

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
