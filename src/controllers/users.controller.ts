import type { Request, Response } from "express";
import xss from "xss";

import { GameModel, FriendRequest, UserModel } from "../db/models/index.js";
import { onlineUsers } from "../state.js";
import { asyncHandler } from "../db/helper.js";
import { findByNameOrEmail } from "../db/services/user.js";

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
    const page = xss(req.params.page);

    const user = await UserModel.findOne({ name });
    if (!user) throw new Error("User not found");

    const limit = 10;
    const skip = parseInt(page as string) * limit;

    // Fetch recent games for the user
    const totalGames =
      parseInt(page as string) === 0
        ? await GameModel.countDocuments({
            $or: [{ white: user.id }, { black: user.id }],
          })
        : 0;

    const games = await GameModel.find({
      $or: [{ white: user.id }, { black: user.id }],
    })
      .sort({
        startedAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .populate("white black", "name");

    res.json({ count: totalGames, games });
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
