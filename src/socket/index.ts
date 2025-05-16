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

import { onlineUsers } from "../state.js"; // adjust path

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

  const userId = req.session?.user?.id as string; // adjust depending on your session structure
  if (userId) {
    onlineUsers.set(userId, socket.id);
    console.log(`🔌 ${userId} connected`);
  }

  socket.on("disconnect", (reason, code) => {
    if (userId) {
      onlineUsers.delete(userId);
      console.log(`❌ ${userId} disconnected`);
    }
    code && leaveLobby.call(socket, reason, code);
  });

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
