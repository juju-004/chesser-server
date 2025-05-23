import type { Request, Response } from "express";
import xss from "xss";

import { onlineUsers } from "../state.js";
import { asyncHandler } from "../db/helper.js";
import { findById, removeUserFriend } from "../db/services/user.js";

export const getUserFriends = asyncHandler(
  async (req: Request, res: Response) => {
    const id = xss(req.params.id);

    const user = await findById(id, true);

    const friendsWithStatus = (user.friends as any[]).map((friend) => ({
      id: friend._id.toString(),
      name: friend.name,
      online: onlineUsers.has(friend._id.toString()),
    }));

    res.status(200).json(friendsWithStatus);
  },
  true
);

export const unFriend = asyncHandler(async (req: Request, res: Response) => {
  const id = req.session?.user?.id;
  const friendId = xss(req.params.id);

  if (!friendId) throw Error("Friend ID is required");

  await removeUserFriend(id as string, friendId);
  await removeUserFriend(friendId, id as string);

  res.status(200).json({ message: `Unfriended user` });
}, true);
