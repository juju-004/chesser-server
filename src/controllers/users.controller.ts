import type { Request, Response } from "express";
import xss from "xss";

import { GameModel } from "../db/index.js";
import { UserModel } from "../db/index.js";
import { onlineUsers } from "../socket/socketState.js";
import { asyncHandler } from "../db/helper.js";
import mongoose from "mongoose";

export const getUserProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const user = await UserModel.findOne({ name });
    if (!user) throw new Error("User not found");

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
      const reqUser = await UserModel.findById(req.session?.user?.id);
      const userObjectId = new mongoose.Types.ObjectId(user.id as string);

      publicUser.online = onlineUsers.has(user.id);
      publicUser.isFriend = reqUser.friends.some((oid) =>
        oid.equals(userObjectId)
      );
      publicUser.isBlocked = reqUser.blocked.some((oid) =>
        oid.equals(userObjectId)
      );
    }

    // Send the public user profile along with recent games
    res.status(200).json(publicUser);
  }
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
      .populate("white black", "name");

    res.status(200).json(games);
  }
);
export const getUserFriends = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name); // Sanitize the input to prevent XSS

    const user = await UserModel.findOne({ name })
      .populate("friends", "name")
      .lean();
    if (!user) throw new Error("User not found");

    const friendsWithStatus = user.friends.map((friend) => ({
      id: friend._id.toString(),
      ...friend,
      online: onlineUsers.has(friend._id.toString()),
    }));

    res.status(200).json(friendsWithStatus);
  }
);

export const addFriend = asyncHandler(async (req: Request, res: Response) => {
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
});

export const removeFriend = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    if (!id) throw new Error("Invalid Request");
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
  }
);

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.session?.user?.id;
  if (!id) throw new Error("Invalid Request");

  const userId = req.body.userId;

  const user = await UserModel.findById(id);
  if (!user) throw new Error("User not found");

  const alreadyBlocked = user.blocked.includes(userId);
  if (alreadyBlocked) {
    throw new Error("User is already blocked.");
  }

  user.blocked.push(userId);
  await user.save();

  res.status(200).json({ isBlocked: true });
});

export const unBlockUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.session?.user?.id;
  if (!id) throw new Error("Invalid Request");
  const userId = xss(req.params.userId);

  const user = await UserModel.findById(id);
  if (!user) throw new Error("User not found");

  const userIdAsObj = new mongoose.Types.ObjectId(userId);
  const alreadyBlocked = user.blocked.includes(userIdAsObj);

  if (!alreadyBlocked) {
    throw new Error("You have not blocked this user.");
  }
  user.blocked = user.blocked.filter((id) => id.toString() !== userId);

  await user.save();

  res.status(200).json({ isBlocked: false });
});

export const isUserFriend = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    if (!id) throw new Error("Invalid Request");
    const friendId = xss(req.params.friendId);

    const user = await UserModel.findById(id);
    if (!user) throw new Error("User not found");

    const friendObjectId = new mongoose.Types.ObjectId(friendId);
    const isFriend = user.friends.some((id) => id.equals(friendObjectId));
    res.json({ isFriend });
  }
);

export const isUserBlocked = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    if (!id) throw new Error("Invalid Request");
    const userId = xss(req.params.userId);

    const user = await UserModel.findById(id);
    if (!user) throw new Error("User not found");

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const isBlocked = user.blocked.some((id) => id.equals(userObjectId));
    res.json({ isBlocked });
  }
);
