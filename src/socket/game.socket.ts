import type { Game } from "../../types/index.js";
import { Chess } from "chess.js";
import { Socket } from "socket.io";
import { getSocketId } from "../state.js";
import { io } from "../server.js";
import {
  deleteGameByCode,
  emitToOpponent,
  findGameByCode,
  findGameWithChatByCode,
  gameOver,
  getPlayerSide,
  getUpdatedTimer,
  getUserFromSession,
} from "./utils.js";
import { initGame } from "../db/services/game.js";

const getConnectedUsers = (code: string) => {
  const room = io.sockets.adapter.rooms.get(code);
  if (!room) return null; // Room doesn't exist or already empty

  const users: { id: string; name: string }[] = [];
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const { id, name } = getUserFromSession(socket);
      users.push({ id: id as string, name });
    }
  }

  return users;
};

const updateConnectedUsers = (code: string) => {
  const users = getConnectedUsers(code);
  if (!users) return;

  io.to(code).emit("update_users", users);
};

const roomModerator = async (socket: Socket, code: string) => {
  const rooms = Array.from(socket.rooms).splice(1);

  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i] === code) continue;
    const game = findGameByCode(rooms[i]);

    if (game && game.pgn.length && !game.endReason) {
      socket.emit("redirect", game.code);
      socket.to(game.code).emit("game:update", game);
      return true;
    } else {
      await leaveLobby.call(socket, rooms[i]);
    }
  }

  return false;
};

export async function joinLobby(this: Socket, code: string) {
  const game = findGameByCode(code);

  if (!game || Array.from(this.rooms)[1] === code) return;

  const isInGame = await roomModerator(this, code);
  if (isInGame) return;

  if (game.timeout) {
    clearTimeout(game.timeout);
    game.timeout = undefined;
  }

  await this.join(code);
  this.data.code = code;
  updateConnectedUsers(code);
  this.to(code).emit("game:update", game);
}

export async function updateSocket(this: Socket, code: string) {
  const game = findGameByCode(code);
  if (!game) return;

  const { id } = getUserFromSession(this);
  const socId = getSocketId(id as string);

  io.to(socId).emit("game:update", game);
  updateConnectedUsers(code);
}

export async function leaveLobby(this: Socket, cod?: string) {
  const code: string | undefined = cod || this.data.code;

  if (!code) return;
  const game = findGameByCode(code);

  if (!game) {
    await this.leave(code);
    updateConnectedUsers(code);
    return;
  }

  const sockets = await io.in(game.code as string).fetchSockets();

  if (sockets.length === 0) {
    if (game.timeout) clearTimeout(game.timeout);

    let timeout = 1000 * 30;
    if (game.pgn) timeout *= 20;

    game.timeout = Number(setTimeout(() => deleteGameByCode(code), timeout));
  }

  await this.leave(code);
  updateConnectedUsers(code);
}

export async function claimAbandoned(this: Socket, type: "win" | "draw") {
  const game = findGameByCode(this);
  const { id, name } = getUserFromSession(this);

  if (
    !game ||
    !game.pgn ||
    !game.white ||
    !game.black ||
    (game.white.id !== id && game.black.id !== id)
  ) {
    return;
  }

  const playerSide = getPlayerSide(id as string, game);
  if (!playerSide) return;

  const opponentId = game[playerSide === "white" ? "black" : "white"]?.id;

  const inGameUsers = getConnectedUsers(game.code);

  if (inGameUsers.some((c) => c.id === opponentId)) {
    const socId = getSocketId(id as string);
    io.to(socId).emit("lobby:update", game);
    updateConnectedUsers(game.code);
    return;
  }

  game.endReason = "abandoned";

  gameOver({
    game,
    winnerName: name,
    winnerSide:
      type === "draw" ? undefined : game.white.id === id ? "white" : "black",
  });
}

function startTimerInterval(code: string, interval: number) {
  const gameTimer = setInterval(() => {
    const game = findGameByCode(code);

    if (!game || game?.endReason) {
      clearInterval(gameTimer);
      return;
    }
    const now = Date.now();
    const elapsed = now - game.timer.lastUpdate;

    // Update the active player's time
    if (game.activePlayer === "white") {
      game.timer.white = Math.max(0, game.timer.white - elapsed);
    } else {
      game.timer.black = Math.max(0, game.timer.black - elapsed);
    }

    game.timer.lastUpdate = now;

    // Broadcast update to all clients
    io.to(game.code).emit("time:update", getUpdatedTimer(game.timer));

    // Check for timeout
    if (game.timer.white <= 0 || game.timer.black <= 0) {
      const winnerSide = game.timer.white <= 0 ? "black" : "white";
      const winnerName =
        winnerSide === "white" ? game.white?.name : game.black?.name;

      game.winner = winnerSide;
      game.endReason = "timeout";

      gameOver({ game, winnerName, winnerSide });
    }
  }, interval);
}

export async function sendMove(
  this: Socket,
  m: { from: string; to: string; promotion?: string }
) {
  const game = findGameByCode(this);
  const { id } = getUserFromSession(this);
  if (!game || game.endReason || game.winner) return;

  const chess = new Chess();
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  }

  try {
    const prevTurn = chess.turn();
    const prevColor = prevTurn === "w" ? "white" : "black";

    if (
      (prevTurn === "b" && id !== game.black?.id) ||
      (prevTurn === "w" && id !== game.white?.id)
    ) {
      throw new Error("not turn to move");
    }

    const newMove = chess.move(m);
    if (!newMove) throw new Error("invalid move");

    game.pgn = chess.pgn();

    // Only start counting time after both players have moved
    if (chess.history().length === 2) {
      startTimerInterval(game.code, game.timeControl >= 3 ? 200 : 100);
    }
    game.activePlayer = prevColor === "white" ? "black" : "white";
    game.timer.lastUpdate = Date.now();

    // Emit updates
    io.to(game.code).emit("move:update", m, getUpdatedTimer(game.timer));

    // Handle game over conditions
    if (chess.isGameOver()) {
      let reason: Game["endReason"];
      if (chess.isCheckmate()) reason = "checkmate";
      else if (chess.isStalemate()) reason = "stalemate";
      else if (chess.isThreefoldRepetition()) reason = "repetition";
      else if (chess.isInsufficientMaterial()) reason = "insufficient";
      else if (chess.isDraw()) reason = "draw";

      const winnerSide = reason === "checkmate" ? prevColor : undefined;
      game.endReason = reason;

      gameOver({
        game,
        winnerName: winnerSide ? game[winnerSide]?.name : undefined,
        winnerSide,
      });
    }
  } catch (e) {
    console.log("sendMove error: " + e);
    this.emit("receivedLatestGame", game);
  }
}

export async function joinAsPlayer(this: Socket) {
  const game = findGameByCode(this);
  if (!game) return;

  const { id, name } = getUserFromSession(this);

  const asPlayer = (side: "black" | "white") => {
    game[side] = { id, name };

    io.to(game.code as string).emit("game:joined_as_player", { name, side });
    game.startedAt = Date.now();
  };

  if (!game.white) asPlayer("white");
  else if (!game.black) asPlayer("black");

  io.to(game.code as string).emit("game:update", game);
}

export async function abort(this: Socket) {
  const game = findGameByCode(this);
  if (!game) return;

  game.endReason = "aborted";

  io.to(Array.from(this.rooms)[1]).emit("lobby:update", game);
  deleteGameByCode(game.code);
}

export async function resign(this: Socket) {
  const game = findGameByCode(this);
  if (!game) return;

  const { id } = getUserFromSession(this);

  const playerSide = getPlayerSide(id as string, game);
  if (!playerSide) return;

  const winnerSide = playerSide === "white" ? "black" : "white";
  game.endReason = "resigned";

  gameOver({
    game,
    winnerName: game[winnerSide]?.name,
    winnerSide,
  });
}

export async function draw(
  this: Socket,
  type: "offer" | "decline" | "accept",
  uid: string
) {
  const { game, chat } = findGameWithChatByCode(this);
  if (!game) return;

  const { id, name } = getUserFromSession(this);

  const message = {
    author: { name: "server" },
    message: `${name} ${type}'s draw`,
  };

  if (type === "offer") {
    chat.push(message);
    io.to(game.code).emit("chat", message);

    emitToOpponent(this, "draw:received", id);
  } else if (type === "accept") {
    if (!getPlayerSide(uid, game) && !getPlayerSide(id as string, game)) return;

    game.endReason = `draw`;
    chat.push(message);
    io.to(game.code).emit("chat", message);

    gameOver({ game });
  } else if (type === "decline") {
    if (!getPlayerSide(uid, game) && !getPlayerSide(id as string, game)) return;
    chat.push(message);
    io.to(game.code).emit("chat", message);
  }
}

export async function chat(
  this: Socket,
  message: string,
  server?: boolean | undefined
) {
  const { game, chat } = findGameWithChatByCode(this);
  const { name } = getUserFromSession(this);

  if (game) {
    chat.push({
      author: { name: server ? "server" : name },
      message,
    });
  }

  if (server) {
    io.to(Array.from(this.rooms)[1]).emit("chat", {
      author: { name: "server" },
      message,
    });
  } else {
    this.to(Array.from(this.rooms)[1]).emit("chat", {
      author: { name },
      message,
    });
  }
}

export async function rematch(this: Socket, lastGame?: Game) {
  if (lastGame) {
    console.log("lgame", lastGame);

    const game: Partial<Game> = {
      stake: lastGame.stake,
      timeControl: lastGame.timeControl,
      white: lastGame.black,
      black: lastGame.white,
    };

    const mainGame = initGame(game);
    io.to(lastGame.code).emit("redirect", mainGame.code);
  } else {
    this.to(this.data.code as string).emit("rematch:received");
  }
}
