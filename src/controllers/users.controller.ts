import type { Request, Response } from "express";
import xss from "xss";

import { FriendRequest, GameModel } from "../db/index.js";
import { UserModel } from "../db/index.js";
import { onlineUsers } from "../state.js";
import { asyncHandler } from "../db/helper.js";
import mongoose from "mongoose";
import {
  findById,
  findByNameOrEmail,
  removeUserFriend,
} from "../db/services/user.js";

export const getUserProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const user = await findByNameOrEmail({ name });

    const gameCount = await GameModel.countDocuments({
      $or: [{ white: user.id }, { black: user.id }],
    });

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      games: gameCount,
      online: undefined,
      isFriend: undefined,
      isBlocked: undefined,
    };

    if (req.session?.user?.id && req.session?.user?.id !== user.id) {
      const reqUser = await findById(req.session?.user?.id.toString());
      const userObjectId = new mongoose.Types.ObjectId(user.id as string);

      publicUser.online = onlineUsers.has(user.id);
      publicUser.isFriend = reqUser.friends.some((oid) =>
        oid.equals(userObjectId)
      );
    }

    // Send the public user profile along with recent games
    res.status(200).json(publicUser);
  },
  true
);

export const getUserData = async (req: Request, res: Response) => {
  try {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const user = await findByNameOrEmail({ name });

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
    };

    // Send the public user profile along with recent games
    res.status(200).json(publicUser);
  } catch (error) {
    res.status(500).end();
  }
};

export const getUserGames = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const user = await UserModel.findOne({ name });
    if (!user) throw new Error("User not found");

    // Fetch recent games for the user
    const games = await GameModel.find({
      $or: [{ white: user.id }, { black: user.id }],
    })
      .limit(30)
      .populate("white black", "name")
      .sort({
        startedAt: -1,
      });

    res.status(200).json(games);
  },
  true
);

export const getUserFriends = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const user = await findByNameOrEmail({ name }, false, true);

    const friendsWithStatus = user.friends.map((friend) => ({
      id: friend._id.toString(),
      ...friend,
      online: onlineUsers.has(friend._id.toString()),
    }));

    res.status(200).json(friendsWithStatus);
  },
  true
);

export const getPlayersByName = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const users = await UserModel.find({
      name: { $regex: `^${name}`, $options: "i" },
    });

    const usersWithStatus = users.map((user) => ({
      name: user.name,
      online: onlineUsers.has(user._id.toString()),
    }));

    res.status(200).json(usersWithStatus);
  },
  true
);

export const getUserNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    const requests = await FriendRequest.find({
      $or: [
        { to: id, status: "pending" },
        { from: id, status: { $ne: "pending" } },
      ],
    }).populate("from to", "name");

    res.status(200).json(requests);
  },
  true
);

export const unFriend = asyncHandler(async (req: Request, res: Response) => {
  const id = req.session?.user?.id;
  const friendId = xss(req.params.friendId);

  if (!friendId) throw Error("Friend ID is required");

  await removeUserFriend(id as string, friendId);
  await removeUserFriend(friendId, id as string);

  res.status(200).json({ message: `Unfriended user` });
}, true);
