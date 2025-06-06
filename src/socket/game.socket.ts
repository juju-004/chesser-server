import type { Game } from "../../types/index.js";
import { Chess } from "chess.js";
import type { Socket } from "socket.io";
import { activeGames } from "../state.js";
import { io } from "../server.js";
import {
  connectPlayer,
  deleteGameByCode,
  disconnectPlayer,
  findGameByCode,
  findGameWithChatByCode,
  gameOver,
  getUpdatedTimer,
  getUserFromSession,
  isPlayerConnected,
} from "./utils.js";
import { initGame } from "../db/services/game.js";

export async function joinLobby(this: Socket, code: string) {
  if (this.rooms.size >= 3) {
    console.log("large rooms");

    await leaveLobby.call(this, code);
    return;
  }
  const game = activeGames.get(code);
  if (!game) return;

  const { id, name } = getUserFromSession(this);

  if (game.timeout) {
    clearTimeout(game.timeout);
    game.timeout = undefined;
  }

  this.data.code = code;
  this.data.id = id;
  this.data.name = name;
  await this.join(code);

  connectPlayer(code, { id, name }, this);
  io.to(game.code as string).emit("game:update", game);
}

export async function leaveLobby(this: Socket) {
  const code = this.data?.code;

  if (!code) return;
  if (this.rooms.size >= 3 && !code) {
    console.log(`leaveLobby: room size is ${this.rooms.size}, aborting...`);
    return;
  }

  const game = findGameByCode(code);

  if (!game) {
    await this.leave(code);
    return;
  }

  const sockets = await io.in(game.code as string).fetchSockets();

  if (sockets.length <= 1) {
    if (game.timeout) clearTimeout(game.timeout);

    let timeout = 1000 * 60; // 1 minute
    if (game.pgn) timeout *= 20;

    game.timeout = Number(
      setTimeout(() => {
        activeGames.delete(game.code);
      }, timeout)
    );
  }

  await this.leave(code);
  disconnectPlayer(this);
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
    console.log(`claimAbandoned: Invalid game or user is not a player.`);
    return;
  }

  const opponentId = game.white.id === id ? game.black.id : game.white.id;
  const opponentConnected = isPlayerConnected(opponentId as string);

  if (opponentConnected) {
    console.log(
      `claimAbandoned: Invalid claim by ${name}. Opponent is still connected or disconnected less than 50 seconds ago.`
    );
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

export async function getLatestGame(this: Socket, code: string) {
  if (!this.data.code) this.data.code = code;
  const game = findGameByCode(this);
  if (game) this.emit("game:update", game);
}

function startTimerInterval(code: string, interval: number) {
  const gameTimer = setInterval(() => {
    const game = activeGames.get(code);

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

  console.log(game, this.data);

  if (!game) return;

  game.endReason = "aborted";

  deleteGameByCode(this);
  io.to(game.code).emit("lobby:update", game);
}

export async function resign(this: Socket) {
  const game = findGameByCode(this);
  if (!game) return;

  const winnerSide =
    getUserFromSession(this).id === game.black?.id ? "white" : "black";

  game.endReason = "resigned";

  gameOver({
    game,
    winnerName: game[winnerSide]?.name,
    winnerSide,
  });
}

export async function offerDraw(this: Socket) {
  const { game, chat } = findGameWithChatByCode(this);
  if (!game) return;

  io.to(game.code).emit("chat", {
    author: { name: "server" },
    message: `${getUserFromSession(this).name} offers a draw`,
  });

  chat.push({
    author: { name: "server" },
    message: `${getUserFromSession(this).name} offers a draw`,
  });
  this.to(game.code).emit("draw:received");
}

export async function acceptDraw(this: Socket) {
  const { game, chat } = findGameWithChatByCode(this);
  if (!game) return;

  game.endReason = `draw`;

  io.to(game.code).emit("chat", {
    author: { name: "server" },
    message: `${getUserFromSession(this).name} accepts draw`,
  });
  chat.push({
    author: { name: "server" },
    message: `${getUserFromSession(this).name} accepts draw`,
  });
  gameOver({ game });
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
    io.to(game.code).emit("chat", {
      author: { name: "server" },
      message,
    });
  } else {
    this.to(game.code).emit("chat", {
      author: { name },
      message,
    });
  }
}

export async function rematch(this: Socket, lastGame?: Game) {
  if (lastGame) {
    const game: Partial<Game> = {
      stake: lastGame.stake,
      timeControl: lastGame.timeControl,
      white: lastGame.black,
      black: lastGame.white,
    };

    const mainGame = initGame(game);
    io.to(lastGame.code).emit("rematch:accept", mainGame.code);
  } else {
    this.to(this.data.code as string).emit("rematch:received");
  }
}
