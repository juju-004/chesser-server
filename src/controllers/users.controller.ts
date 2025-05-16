import type { Request, Response } from "express";
import xss from "xss";

import { GameModel } from "../db/index.js";
import { UserModel } from "../db/index.js";
import { onlineUsers } from "../state.js";
import { asyncHandler } from "../db/helper.js";
import mongoose from "mongoose";
import { findById, findByNameOrEmail } from "../db/services/user.js";

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

export const sendFriendReq = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    if (!id) throw new Error("Invalid Request");

    const friendId = req.body.friendId;

    const user = await UserModel.findById(id);
    if (!user) throw new Error("User not found");

    const alreadyFriends = user.friends.includes(friendId);
    if (alreadyFriends) {
      throw new Error("Already friends.");
    }

    user.friends.push(friendId);
    await user.save();

    res.status(200).json({ isFriend: true });
  },
  true
);

export const acceptFriendReq = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    const friendId = xss(req.params.friendId);

    const user = await UserModel.findById(id);
    if (!user) throw new Error("User not found");

    const friendIdAsObj = new mongoose.Types.ObjectId(friendId);
    const alreadyFriends = user.friends.includes(friendIdAsObj);

    if (!alreadyFriends) {
      throw new Error("You are not friends with this user.");
    }
    user.friends = user.friends.filter((id) => id.toString() !== friendId);

    await user.save();

    res.status(200).json({ isFriend: false });
  },
  true
);

export const removeFriend = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    const friendId = xss(req.params.friendId);

    const user = await UserModel.findById(id);
    if (!user) throw new Error("User not found");

    const friendIdAsObj = new mongoose.Types.ObjectId(friendId);
    const alreadyFriends = user.friends.includes(friendIdAsObj);

    if (!alreadyFriends) {
      throw new Error("You are not friends with this user.");
    }
    user.friends = user.friends.filter((id) => id.toString() !== friendId);

    await user.save();

    res.status(200).json({ isFriend: false });
  },
  true
);
