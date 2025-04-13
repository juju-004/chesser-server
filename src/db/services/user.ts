import type { User } from "../../../types/index.js";
import { UserModel } from "../index.js";

export const create = async (user: User, token: string, password: string) => {
  if (user.name === "Guest" || user.email === undefined) {
    return null;
  }

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
    console.log(err);
    return null;
  }
};

export const findById = async (id: string) => {
  if (!id) {
    return null;
  }

  try {
    const user = await UserModel.findById(id);
    if (user) {
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      };
    } else {
      return null;
    }
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

export const findByNameEmail = async (
  user: Partial<User>,
  includePassword = false,
  limit = 10
) => {
  try {
    const users = await UserModel.find({
      $or: [{ name: user.name }, { email: user.email }],
    })
      .limit(limit)
      .lean();

    return users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      wins: u.wins,
      losses: u.losses,
      draws: u.draws,
      verified: u.verified,
      token: u.token,
      updatedAt: u.updatedAt,
      forgotPassPassword: u.forgotPassPassword,

      ...(includePassword ? { password: u.password } : {}),
    }));
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

export const update = async (
  id: string,
  updatedUser: Partial<User> & { password?: string }
) => {
  if (!id) {
    return null;
  }

  try {
    const updated = await UserModel.findByIdAndUpdate(
      id,
      {
        $set: {
          name: updatedUser.name,
          email: updatedUser.email,
          ...(updatedUser.password && { password: updatedUser.password }),
        },
      },
      { new: true, projection: { password: 0 } } // Return the updated document, exclude password
    );

    if (updated) {
      return {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        wins: updated.wins,
        losses: updated.losses,
        draws: updated.draws,
      };
    } else {
      return null;
    }
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

export const remove = async (id: string) => {
  if (!id) {
    return null;
  }

  try {
    const removed = await UserModel.findByIdAndDelete(id);
    if (removed) {
      return {
        id: removed._id,
        name: removed.name,
        email: removed.email,
      };
    } else {
      return null;
    }
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

const UserService = {
  create,
  findById,
  findByNameEmail,
  update,
  remove,
};

export default UserService;
