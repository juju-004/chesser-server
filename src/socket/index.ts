import type { Socket } from "socket.io";

import { io } from "../server.js";
import {
  chat,
  claimAbandoned,
  getLatestGame,
  joinAsPlayer,
  joinLobby,
  leaveLobby,
  abort,
  sendMove,
  offerDraw,
  resign,
  acceptDraw,
  rematch,
} from "./game.socket.js";

const socketConnect = (socket: Socket) => {
  const req = socket.request;

  socket.use((__, next) => {
    req.session.reload((err) => {
      if (err) {
        socket.disconnect();
      } else {
        next();
      }
    });
  });

  socket.on("disconnect", leaveLobby);

  socket.on("joinLobby", joinLobby);
  socket.on("leaveLobby", leaveLobby);

  socket.on("getLatestGame", getLatestGame);
  socket.on("sendMove", sendMove);
  socket.on("joinAsPlayer", joinAsPlayer);
  socket.on("chat", chat);
  socket.on("claimAbandoned", claimAbandoned);
  socket.on("abort", abort);
  socket.on("offerDraw", offerDraw);
  socket.on("resign", resign);
  socket.on("acceptDraw", acceptDraw);
  socket.on("rematch", rematch);
};

export const init = () => {
  io.on("connection", socketConnect);
};
