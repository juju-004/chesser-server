import mongoose, { Types } from "mongoose";
import type { User } from "../../../types/index.js";
import { UserModel } from "../index.js";

export const create = async (user: User, token: string, password: string) => {
  try {
    const newUser = new UserModel({
      name: user.name,
      email: user.email,
      token,
      password,
    });
    await newUser.save();
    return {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      wins: newUser.wins,
      losses: newUser.losses,
      draws: newUser.draws,
    };
  } catch (err: unknown) {
    throw Error("Unable to save user");
  }
};

export const findById = async (id: string, populate = false) => {
  if (!id) throw Error("Invalid req");

  const user = await UserModel.findById(id);
  if (!user) throw Error("No user found");

  if (populate) await user.populate("friends", "name");

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    wallet: user.wallet,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    friends: user.friends,
    updatedAt: user.updatedAt,
  };
};

export const updateUserFriend = async (id: string, friendId: string) => {
  if (!id) throw Error("Invalid req");

  const user = await UserModel.findByIdAndUpdate(
    id,
    {
      $addToSet: {
        friends: friendId,
      },
    },
    { new: true }
  );

  if (!user) throw Error("No user found");
};
export const removeUserFriend = async (id: string, friendId: string) => {
  if (!id) throw Error("Invalid req");

  const user = await UserModel.findByIdAndUpdate(
    id,
    { $pull: { friends: friendId } },
    { new: true }
  );

  if (!user) throw Error("No user found");
  return user;
};

export const findByNameOrEmail = async (
  user: Partial<User>,
  includePassword = false,
  populate = false,
  noerr = false
) => {
  const u = await UserModel.findOne({
    $or: [{ name: user.name }, { email: user.email }],
  });

  if (noerr && !u) return null;

  if (!u) throw Error("No user found");

  if (populate) u.populate("friends", "name");

  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    wins: u.wins,
    losses: u.losses,
    draws: u.draws,
    verified: u.verified,
    token: u.token,
    updatedAt: u.updatedAt,
    wallet: u.wallet,
    forgotPassPassword: u.forgotPassPassword,
    friends: u.friends,
    ...(includePassword ? { password: u.password } : {}),
  };
};

export const update = async (
  id: string,
  updatedUser: Partial<User> & { password?: string }
) => {
  if (!id) return null;

  const updated = await UserModel.findByIdAndUpdate(
    id,
    {
      $set: {
        name: updatedUser.name,
        email: updatedUser.email,
      },
    },
    { new: true, projection: { password: 0 } } // Return the updated document, exclude password
  );

  if (!updated) throw Error("Unable to update user");
  return {
    id: updated._id,
    name: updated.name,
    email: updated.email,
  };
};

export const isFriend = async (id: string, friendId: string) => {
  if (!id || !friendId) return null;

  const user = await UserModel.findById(id);

  if (!user) throw Error("User not found");

  const isFriend = user.friends.some((f: mongoose.Types.ObjectId) =>
    f.equals(friendId)
  );

  return isFriend;
};

export const getFriends = async (userId: string): Promise<string[]> => {
  const user = await UserModel.findById(userId).select("friends"); // assumes user.friends is array of ObjectIds
  return user?.friends?.map((id) => id.toString()) || [];
};

const UserService = {
  create,
  findById,
  findByNameOrEmail,
  update,
  getFriends,
};

export default UserService;
