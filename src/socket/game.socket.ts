import type { Game, User } from "../../types/index.js";
import { Chess } from "chess.js";
import type { DisconnectReason, Socket } from "socket.io";

import GameService, { activeGames } from "../db/services/game.js";
import { io } from "../server.js";

// TODO: clean up

export async function joinLobby(this: Socket, gameCode: string) {
  const game = activeGames.find((g) => g.code === gameCode);
  if (!game) return;

  if (game.host && game.host?.id === this.request.session.user.id) {
    game.host.connected = true;
    if (game.host.name !== this.request.session.user.name) {
      game.host.name = this.request.session.user.name;
    }
  }
  if (game.white && game.white?.id === this.request.session.user.id) {
    game.white.connected = true;
    game.white.disconnectedOn = undefined;
    if (game.white.name !== this.request.session.user.name) {
      game.white.name = this.request.session.user.name;
    }
  } else if (game.black && game.black?.id === this.request.session.user.id) {
    game.black.connected = true;
    game.black.disconnectedOn = undefined;
    if (game.black.name !== this.request.session.user.name) {
      game.black.name = this.request.session.user.name;
    }
  } else {
    if (game.observers === undefined) game.observers = [];
    const user = {
      id: this.request.session.user.id,
      name: this.request.session.user.name,
    };
    game.observers?.push(user);
  }

  if (this.rooms.size >= 2) {
    await leaveLobby.call(this);
  }

  if (game.timeout) {
    clearTimeout(game.timeout);
    game.timeout = undefined;
  }

  await this.join(gameCode);
  io.to(game.code as string).emit("receivedLatestGame", game);
}

export async function leaveLobby(
  this: Socket,
  reason?: DisconnectReason,
  code?: string
) {
  if (this.rooms.size >= 3 && !code) {
    console.log(`leaveLobby: room size is ${this.rooms.size}, aborting...`);
    return;
  }

  const game = activeGames.find(
    (g) =>
      g.code ===
        (code || this.rooms.size === 2 ? Array.from(this.rooms)[1] : 0) ||
      g.black?.id === this.request.session.user.id ||
      g.white?.id === this.request.session.user.id ||
      g.observers?.find((o) => o.id === this.request.session.user.id)
  );

  if (!game) {
    await this.leave(code || Array.from(this.rooms)[1]);
    return;
  }

  // Handle player disconnection
  const user = game.observers?.find(
    (o) => o.id === this.request.session.user.id
  );
  if (user) {
    game.observers?.splice(game.observers?.indexOf(user), 1);
  }
  if (game.black && game.black?.id === this.request.session.user.id) {
    game.black.connected = false;
    game.black.disconnectedOn = Date.now();
  } else if (game.white && game.white?.id === this.request.session.user.id) {
    game.white.connected = false;
    game.white.disconnectedOn = Date.now();
  }

  // Count remaining player sockets (excluding observers)
  const sockets = await io.in(game.code).fetchSockets();
  const remainingPlayers = sockets.filter((socket) => {
    const socketUserId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.handshake.auth?.userId ||
      (socket as any).request?.session?.user?.id;
    return socketUserId === game.white?.id || socketUserId === game.black?.id;
  }).length;

  if (remainingPlayers <= 1) {
    const timeout = game.pgn ? 20 * 60 * 1000 : 60 * 1000;
    game.timeout = Number(
      setTimeout(() => {
        activeGames.splice(activeGames.indexOf(game), 1);
      }, timeout)
    );
  }

  // Notify remaining players
  io.to(game.code).emit("updateLobby", game);

  await this.leave(code || Array.from(this.rooms)[1]);
}

const gameOver = async (
  game: Game,
  { reason, winnerName, winnerSide }: GameOverProps
) => {
  game.winner = winnerSide || "draw";

  const result = await GameService.save(game);

  if (game.timeout) {
    clearTimeout(game.timeout);
  }

  io.to(game.code).emit("gameOver", { reason, winnerName, winnerSide, result });
  activeGames.splice(activeGames.indexOf(game), 1);
};

export async function claimAbandoned(this: Socket, type: "win" | "draw") {
  const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
  if (
    !game ||
    !game.pgn ||
    !game.white ||
    !game.black ||
    (game.white.id !== this.request.session.user.id &&
      game.black.id !== this.request.session.user.id)
  ) {
    console.log(`claimAbandoned: Invalid game or user is not a player.`);
    return;
  }

  if (
    (game.white &&
      game.white.id === this.request.session.user.id &&
      (game.black?.connected ||
        Date.now() - (game.black?.disconnectedOn as number) < 50000)) ||
    (game.black &&
      game.black.id === this.request.session.user.id &&
      (game.white?.connected ||
        Date.now() - (game.white?.disconnectedOn as number) < 50000))
  ) {
    console.log(
      `claimAbandoned: Invalid claim by ${this.request.session.user.name}. Opponent is still connected or disconnected less than 50 seconds ago.`
    );
    return;
  }

  game.endReason = "abandoned";

  if (type === "draw") {
    game.winner = "draw";
  } else if (game.white && game.white?.id === this.request.session.user.id) {
    game.winner = "white";
  } else if (game.black && game.black?.id === this.request.session.user.id) {
    game.winner = "black";
  }

  gameOver(game, {
    reason: game.endReason,
    winnerName: this.request.session.user.name,
    winnerSide: game.winner === "draw" ? undefined : game.winner,
  });
}

export async function getLatestGame(this: Socket) {
  const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
  if (game) this.emit("receivedLatestGame", game);
}

interface GameOverProps {
  reason: string;
  winnerSide?: "white" | "black" | "draw";
  winnerName: string;
}

function startTimerInterval(code: string) {
  const gameTimer = setInterval(() => {
    const game = activeGames.find((g) => g.code === code);

    if (!game || game?.endReason) {
      clearInterval(gameTimer);
      return;
    }
    const now = Date.now();
    const elapsed = now - game.timer.lastUpdate;

    // Update the active player's time
    if (game.timer.activeColor === "white") {
      game.timer.whiteTime = Math.max(0, game.timer.whiteTime - elapsed);
    } else {
      game.timer.blackTime = Math.max(0, game.timer.blackTime - elapsed);
    }

    game.timer.lastUpdate = now;

    // Broadcast update to all clients
    io.to(game.code).emit("timeUpdate", {
      whiteTime: game.timer.whiteTime,
      blackTime: game.timer.blackTime,
      activeColor: game.timer.activeColor,
      timerStarted: game.timer.started,
    });

    // Check for timeout
    if (game.timer.whiteTime <= 0 || game.timer.blackTime <= 0) {
      const winnerSide = game.timer.whiteTime <= 0 ? "black" : "white";
      const winnerName =
        winnerSide === "white" ? game.white?.name : game.black?.name;

      game.winner = winnerSide;
      game.endReason = "timeout";
      game.status = "ended";

      gameOver(game, { reason: "timeout", winnerName, winnerSide });
    }
  }, 1000);
}

export async function sendMove(
  this: Socket,
  m: { from: string; to: string; promotion?: string }
) {
  const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
  if (!game || game.endReason || game.winner) return;

  const chess = new Chess();
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  }

  try {
    const prevTurn = chess.turn();
    const prevColor = prevTurn === "w" ? "white" : "black";

    if (
      (prevTurn === "b" && this.request.session.user.id !== game.black?.id) ||
      (prevTurn === "w" && this.request.session.user.id !== game.white?.id)
    ) {
      throw new Error("not turn to move");
    }

    // Track if both players have moved
    const moveHistory = chess.history();
    const isSecondMove = moveHistory.length === 1;

    const newMove = chess.move(m);
    if (!newMove) throw new Error("invalid move");

    game.pgn = chess.pgn();

    // Only start counting time after both players have moved
    if (isSecondMove) {
      game.status = "inPlay";

      io.to(game.code).emit("updateLobby", game);
      game.timer.started = true;
      game.timer.lastUpdate = Date.now(); // Reset the clock start time
      startTimerInterval(game.code);
    }
    // Switch active player
    game.timer.activeColor = prevColor === "white" ? "black" : "white";
    game.timer.lastUpdate = Date.now();

    // Emit updates
    this.to(game.code).emit("receivedMove", m);
    io.to(game.code).emit("timeUpdate", {
      whiteTime: game.timer.whiteTime,
      blackTime: game.timer.blackTime,
      activeColor: game.timer.activeColor,
      timerStarted: game.timer.started,
    });

    // Handle game over conditions
    if (chess.isGameOver()) {
      let reason: Game["endReason"];
      if (chess.isCheckmate()) reason = "checkmate";
      else if (chess.isStalemate()) reason = "stalemate";
      else if (chess.isThreefoldRepetition()) reason = "repetition";
      else if (chess.isInsufficientMaterial()) reason = "insufficient";
      else if (chess.isDraw()) reason = "draw";

      const winnerSide = reason === "checkmate" ? prevColor : undefined;
      const winnerName = winnerSide ? game[winnerSide]?.name : undefined;

      game.winner = reason === "checkmate" ? winnerSide : "draw";
      game.endReason = reason;

      gameOver(game, { reason, winnerName, winnerSide });
    }
  } catch (e) {
    console.log("sendMove error: " + e);
    this.emit("receivedLatestGame", game);
  }
}

export async function joinAsPlayer(this: Socket, wallet: number) {
  try {
    const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
    if (!game) return;
    const user = game.observers?.find(
      (o) => o.id === this.request.session.user.id
    );

    if (!game.white) {
      const sessionUser = {
        id: this.request.session.user.id,
        name: this.request.session.user.name,
        connected: true,
        wallet,
      };
      game.white = sessionUser;
      if (user) game.observers?.splice(game.observers?.indexOf(user), 1);
      io.to(game.code as string).emit("userJoinedAsPlayer", {
        name: this.request.session.user.name,
        side: "white",
      });
      game.startedAt = Date.now();
    } else if (!game.black) {
      const sessionUser = {
        id: this.request.session.user.id,
        name: this.request.session.user.name,
        connected: true,
        wallet,
      };
      game.black = sessionUser;
      if (user) game.observers?.splice(game.observers?.indexOf(user), 1);
      io.to(game.code as string).emit("userJoinedAsPlayer", {
        name: this.request.session.user.name,
        side: "black",
      });
      game.startedAt = Date.now();
    } else {
      console.log(
        "joinAsPlayer: attempted to join a game with already 2 players"
      );
    }
    io.to(game.code as string).emit("receivedLatestGame", game);
  } catch (error) {
    console.error(error);
  }
}
export async function abortGame(this: Socket, code: string, type?: string) {
  const game = activeGames.find((g) => g.code === code);
  if (!game) return;

  if (type === "r") {
    const winnerSide =
      this.request.session.user.id === game.black?.id ? "white" : "black";
    const winnerName = winnerSide ? game[winnerSide]?.name : undefined;

    game.endReason = "resigned";
    game.status = "ended";

    gameOver(game, { reason: "resigned", winnerName, winnerSide });
  } else {
    game.endReason = "aborted";
    game.status = "ended";
    activeGames.splice(activeGames.indexOf(game), 1);
    io.to(game.code).emit("updateLobby", game);
  }
}

export async function offerDraw(
  this: Socket,
  code: string,
  side: "black" | "white",
  accepted?: boolean
) {
  const game = activeGames.find((g) => g.code === code);
  if (!game) return;

  if (accepted) {
    const opponent = side === "black" ? "white" : "black";
    if (
      !game[opponent]?.offersDraw ||
      Date.now() - game[opponent].offersDraw >= 20000
    ) {
      return;
    }

    const winnerSide = undefined;
    const winnerName = undefined;

    game.winner = "draw";
    game.endReason = `draw`;
    game.status = "ended";

    io.to(Array.from(this.rooms)[1]).emit("chat", {
      author: { name: "server" },
      message: `${opponent} accepts draw`,
    });
    gameOver(game, { reason: game.endReason, winnerName, winnerSide });
  } else {
    if (
      game[side]?.offersDraw &&
      Date.now() - game[side]?.offersDraw <= 20000
    ) {
      return;
    }

    game[side].offersDraw = Date.now();

    io.to(Array.from(this.rooms)[1]).emit("chat", {
      author: { name: "server" },
      message: `${side} offers a draw`,
    });
    this.to(game.code).emit("offerdraw");
  }
}

export async function chat(
  this: Socket,
  message: string,
  server?: boolean | undefined
) {
  const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);

  if (game) {
    game.chat.push({
      author: { name: server ? "server" : this.request.session.user.name },
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
      author: { name: this.request.session.user.name },
      message,
    });
  }
}
