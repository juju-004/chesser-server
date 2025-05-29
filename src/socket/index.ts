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

import {
  activeChallenges,
  addOnlineUser,
  ChallengeData,
  getSocketId,
  onlineUsers,
} from "../state.js"; // adjust path
import { FriendRequest, UserModel } from "../db/index.js";
import {
  findById,
  getFriends,
  isFriend,
  updateUserFriend,
} from "../db/services/user.js";
import { nanoid } from "nanoid";
import { initGame, isValidGameParams } from "../db/services/game.js";
import { Game, User } from "../../types/index.js";

const socketError = (socket: Socket, err: string) => {
  socket.emit("error", err);
};

const socketConnect = (socket: Socket) => {
  const req = socket.request;

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

  // Disconnect
  socket.on("disconnect", async () => {
    if (userId) {
      onlineUsers.delete(userId);
      notifyFriends(userId, false);
      console.log(`❌ ${userId} disconnected`);

      leaveLobby.call(socket);
    }
  });

  // Challenge
  socket.on("challenge:send", async ({ to, side, timeControl, amount }) => {
    const id = nanoid();

    const user = await findById(userId);

    const err = isValidGameParams(amount, user.wallet, timeControl);
    if (err) {
      socketError(socket, err);
      return;
    }

    const challenge: ChallengeData = {
      from: {
        id: userId,
        name: req.session.user.name,
      },
      to,
      side,
      timeControl,
      amount,
    };

    activeChallenges.set(id, challenge);
    const targetSocket = getSocketId(to);

    if (targetSocket)
      io.to(targetSocket).emit("challenge:received", { id, ...challenge });
  });
  socket.on("challenge:accept", async ({ id }) => {
    const challenge = activeChallenges.get(id);

    const user = await findById(userId);

    const err = isValidGameParams(
      challenge.amount,
      user.wallet,
      challenge.timeControl
    );
    if (err) return socketError(socket, err);

    if (!challenge && challenge.to !== userId) return;
    const sender: Partial<User> = {
      id: challenge.from.id,
      isHost: true,
      name: challenge.from.name,
    };
    const receiver = {
      id: userId,
      name: req.session.user.name,
    };

    const game: Partial<Game> = {
      timeControl: challenge.timeControl,
      stake: challenge.amount,
    };

    // Assign sides to the user based on input or randomly
    if (challenge.side === "white") {
      game.white = sender;
      game.black = receiver;
    } else if (challenge.side === "black") {
      game.black = sender;
      game.white = receiver;
    } else {
      if (Math.floor(Math.random() * 2) === 0) {
        game.white = sender;
        game.black = receiver;
      } else {
        game.black = sender;
        game.white = receiver;
      }
    }

    const nGame = initGame(game);

    const receiverSocket = getSocketId(challenge.to);
    const senderSocket = getSocketId(challenge.from.id as string);

    if (receiverSocket && senderSocket) {
      activeChallenges.delete(id);
      io.to(senderSocket).emit("challenge:start", nGame.code);
      io.to(receiverSocket).emit("challenge:start", nGame.code);
    }
  });
  socket.on("challenge:decline", ({ id }) => {
    const challenge = activeChallenges.get(id);
    if (!challenge && challenge.to !== userId) return;

    const sender = getSocketId(challenge.from.id as string);

    if (sender) {
      io.to(sender).emit("challenge:declined", { id });
      activeChallenges.delete(id);
    }
  });

  // Friend Requests
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
      socket.emit("error", "An error occurred");
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

  // Game Logic
  socket.on("game:join", joinLobby);
  socket.on("game:leave", leaveLobby);

  socket.on("game:get_game", getLatestGame);
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
