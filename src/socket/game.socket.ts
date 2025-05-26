import type { Game, User } from "../../types/index.js";
import { Chess } from "chess.js";
import type { Socket } from "socket.io";
import { activeGames } from "../state.js";
import { io } from "../server.js";
import {
  deleteGameByCode,
  findGameByCode,
  gameOver,
  getUpdatedTimer,
  getUserFromSession,
} from "./utils.js";
import { initGame } from "../db/services/game.js";

export async function joinLobby(this: Socket, code: string) {
  const game = activeGames.get(code);
  if (!game) return;

  const { id, name } = getUserFromSession(this);

  const updateUser = (player: User | undefined) => {
    if (player?.id === id) {
      player.connected = true;
      player.disconnectedOn = undefined;
      if (player.name !== name) player.name = name;
    }
  };

  // Update host or player info
  if (game.host) updateUser(game.host);
  if (game.white) updateUser(game.white);
  if (game.black) updateUser(game.black);

  if (game.white?.id !== id && game.black?.id !== id) {
    if (!game.observers) game.observers = [];
    game.observers.push({ id, name });
  }

  if (this.rooms.size >= 2) {
    await leaveLobby.call(this);
  }

  if (game.timeout) {
    clearTimeout(game.timeout);
    game.timeout = undefined;
  }

  await this.join(code);
  io.to(game.code as string).emit("receivedLatestGame", game);
}

export async function leaveLobby(this: Socket, code?: string) {
  if (this.rooms.size >= 3 && !code) {
    console.log(`leaveLobby: room size is ${this.rooms.size}, aborting...`);
    return;
  }
  if (!code) return;

  const { id } = getUserFromSession(this);
  const game = Array.from(activeGames.values()).find(
    (g) =>
      g.code ===
        (code || (this.rooms.size === 2 ? Array.from(this.rooms)[1] : 0)) ||
      g.black?.id === id ||
      g.white?.id === id ||
      g.observers?.some((o) => o.id === id)
  );

  if (!game) {
    await this.leave(code || Array.from(this.rooms)[1]);
    return;
  }

  // Handle player disconnection
  const observer = game.observers?.find((o) => o.id === id);
  if (observer) game.observers?.splice(game.observers?.indexOf(observer), 1);

  if (game.black && game.black?.id === id) {
    game.black.connected = false;
    game.black.disconnectedOn = Date.now();
  } else if (game.white && game.white?.id === id) {
    game.white.connected = false;
    game.white.disconnectedOn = Date.now();
  }

  const sockets = await io.in(game.code as string).fetchSockets();

  if (sockets.length <= 1) {
    if (game.timeout) clearTimeout(game.timeout);

    let timeout = 1000 * 60; // 1 minute
    if (game.pgn) {
      timeout *= 20; // 20 minutes if game has started
    }
    game.timeout = Number(
      setTimeout(() => {
        activeGames.delete(game.code);
      }, timeout)
    );
  } else {
    await this.leave(code || Array.from(this.rooms)[1]);
  }
  io.to(game.code as string).emit("updateLobby", game);
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

  if (
    (game.white &&
      game.white.id === id &&
      (game.black?.connected ||
        Date.now() - (game.black?.disconnectedOn as number) < 25000)) ||
    (game.black &&
      game.black.id === id &&
      (game.white?.connected ||
        Date.now() - (game.white?.disconnectedOn as number) < 25000))
  ) {
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

export async function getLatestGame(this: Socket) {
  const game = findGameByCode(this);
  if (game) this.emit("receivedLatestGame", game);
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
    io.to(game.code).emit("timeUpdate", getUpdatedTimer(game.timer));

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
    io.to(game.code).emit("timeUpdate", getUpdatedTimer(game.timer));
    this.to(game.code).emit("receivedMove", m);

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
  try {
    const game = findGameByCode(this);
    if (!game) return;

    const { id, name } = getUserFromSession(this);
    const observer = game.observers?.find((o) => o.id === id);

    const asPlayer = (side: "black" | "white") => {
      game[side] = { id, name, connected: true };

      if (observer)
        game.observers?.splice(game.observers?.indexOf(observer), 1);
      io.to(game.code as string).emit("userJoinedAsPlayer", { name, side });
      game.startedAt = Date.now();
    };

    if (!game.white) asPlayer("white");
    else if (!game.black) asPlayer("black");
    else {
      console.log(
        "joinAsPlayer: attempted to join a game with already 2 players"
      );
    }
    io.to(game.code as string).emit("receivedLatestGame", game);
  } catch (error) {
    console.error(error);
  }
}

export async function abort(this: Socket) {
  const game = findGameByCode(this);
  if (!game) return;

  game.endReason = "aborted";

  deleteGameByCode(this);
  io.to(game.code).emit("updateLobby", game);
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
  const game = findGameByCode(this);
  if (!game) return;

  io.to(Array.from(this.rooms)[1]).emit("chat", {
    author: { name: "server" },
    message: `${getUserFromSession(this).name} offers a draw`,
  });

  game.chat.push({
    author: { name: "server" },
    message: `${getUserFromSession(this).name} offers a draw`,
  });
  this.to(game.code).emit("offerdraw");
}

export async function acceptDraw(this: Socket) {
  const game = findGameByCode(this);
  if (!game) return;

  game.endReason = `draw`;

  io.to(Array.from(this.rooms)[1]).emit("chat", {
    author: { name: "server" },
    message: `${getUserFromSession(this).name} accepts draw`,
  });
  game.chat.push({
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
  const game = findGameByCode(this);
  const { name } = getUserFromSession(this);

  if (game) {
    game.chat.push({
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
    const game: Partial<Game> = {
      host: lastGame.host,
      stake: lastGame.stake,
      timeControl: lastGame.timeControl,
      white: lastGame.black,
      black: lastGame.white,
    };

    const mainGame = initGame(game);
    io.to(Array.from(this.rooms)[1]).emit("newGameCode", mainGame.code);
  } else {
    this.to(Array.from(this.rooms)[1]).emit("rematch");
  }
}
