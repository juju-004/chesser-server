import type { Socket, Server } from "socket.io";

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

import { addOnlineUser, getSocketId, onlineUsers } from "../state.js"; // adjust path
import { FriendRequest, UserModel } from "../db/index.js";
import { getFriends, isFriend, updateUserFriend } from "../db/services/user.js";

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
    addOnlineUser(userId, socket.id);
    notifyFriends(userId, true);

    console.log(`🔌 ${userId} connected`);
  }

  socket.on("disconnect", (reason, code) => {
    if (userId) {
      onlineUsers.delete(userId);
      notifyFriends(userId, false);
      console.log(`❌ ${userId} disconnected`);
    }
    code && leaveLobby.call(socket, reason, code);
  });

  async function notifyFriends(userId: string, isOnline: boolean) {
    const friends = await getFriends(userId); // should return friend user IDs

    for (const friendId of friends) {
      const friendSocketId = getSocketId(friendId.toString());
      if (friendSocketId) {
        io.to(friendSocketId).emit("friend_status_changed", {
          userId,
          isOnline,
        });
      }
    }
  }

  socket.on("send_friend_request", async ({ from, to }) => {
    try {
      const isUserFriend = await isFriend(from, to);

      if (isUserFriend || isUserFriend === null) {
        return;
      }

      const request = await FriendRequest.findOneAndUpdate(
        { from, to, status: "pending" },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("from to", "name");

      const receiverSocketId = getSocketId(to);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("friend_request_received", request);
      }
    } catch (error) {
      socket.emit("error", { message: "An error occurred" });
    }
  });

  socket.on("respond_to_request", async ({ from, to, accept }) => {
    try {
      const request = await FriendRequest.findOne({
        from,
        to,
        status: "pending",
      }).populate("from to", "name");
      if (!request) return;

      if (accept) {
        await updateUserFriend(from, to);
        await updateUserFriend(to, from);

        request.status = "accepted";
      } else {
        request.status = "rejected";
      }

      await request.save();
      const senderSocketId = getSocketId(from);

      if (senderSocketId) {
        io.to(senderSocketId).emit("friend_request_responded", request);
      }
    } catch (error) {
      socket.emit("error", { message: "An error occurred" });
    }
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
