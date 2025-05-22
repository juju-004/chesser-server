import type { Request, Response } from "express";

import { FriendRequest } from "../db/index.js";
import { asyncHandler } from "../db/helper.js";

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

export const clearNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    await FriendRequest.deleteMany({
      $or: [
        { to: id, status: "pending" },
        { from: id, status: { $ne: "pending" } },
      ],
    });

    res.status(200).json({ message: "deleted" });
  },
  true
);
