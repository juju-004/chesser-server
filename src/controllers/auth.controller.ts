import { hash, verify } from "argon2";
// import { activeGames } from "../db/services/game.js"; // Assuming this import is correct
// import { io } from "../server.js";
import type { Request, Response } from "express";
import xss from "xss";
import UserService from "../db/services/user.js";
import {
  asyncHandler,
  generateRandomSequence,
  isDateGreaterOrLessThanADay,
} from "../db/helper.js";
import { sendEmail } from "../db/sendMail.js";
import { UserModel } from "../db/index.js";

export const getCurrentSession = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.session.user) {
      res.status(200).json(req.session.user);
    } else {
      res.status(404).end();
    }
  }
);

export const logoutSession = asyncHandler(
  async (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.status(204).end();
    });
  }
);

export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.session.user?.id) {
      res.status(403).end();
      return;
    }

    const name = xss(req.body.name);
    const email = xss(req.body.email);
    const password = await hash(req.body.password);

    const pattern = /^[A-Za-z0-9]+$/;

    if (!pattern.test(name)) throw new Error("Invalid Username Characters");

    const duplicateUsers = await UserService.findByNameEmail({ name, email });

    if (duplicateUsers.length && duplicateUsers[0]?.verified === false) {
      await UserService.remove(duplicateUsers[0].id);
    }

    if (duplicateUsers && duplicateUsers.length) {
      const dupl = duplicateUsers[0].name === name ? "Username" : "Email";
      throw new Error(`${dupl} is already in use.`);
    }

    const token = generateRandomSequence();

    const mail = await sendEmail(email, `${token}-${name}`, false);

    // console.log(`${token}-${name}`);

    if (!mail.success) throw new Error("Failed to send mail");
    const newUser = await UserService.create({ name, email }, token, password);

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    res.status(200).json({ email: newUser.email });

    // const publicUser = {
    //     id: newUser.id,
    //     name: newUser.name
    // };
    // if (req.session.user?.id && typeof req.session.user.id === "string") {
    //     const game = activeGames.find(
    //         (g) =>
    //             g.white?.id === req.session.user.id ||
    //             g.black?.id === req.session.user.id ||
    //             g.observers?.find((o) => o.id === req.session.user.id)
    //     );
    //     if (game) {
    //         if (game.host?.id === req.session.user.id) {
    //             game.host = publicUser;
    //         }
    //         if (game.white && game.white?.id === req.session.user.id) {
    //             game.white = publicUser;
    //         } else if (game.black && game.black?.id === req.session.user.id) {
    //             game.black = publicUser;
    //         } else {
    //             const observer = game.observers?.find((o) => o.id === req.session.user.id);
    //             if (observer) {
    //                 observer.id = publicUser.id;
    //                 observer.name = publicUser.name;
    //             }
    //         }
    //         io.to(game.code as string).emit("receivedLatestGame", game);
    //     }
    // }
  }
);

export const resendMail = asyncHandler(async (req: Request, res: Response) => {
  if (req.session.user?.id) {
    res.status(403).end();
    return;
  }

  const email = req.body.email;

  const user = await UserService.findByNameEmail({ name: "", email });

  if (!user.length || user[0]?.verified) throw new Error("Invalid Email");

  const token = generateRandomSequence();

  await sendEmail(email, `${token}-${user[0]?.name}`, false);

  // console.log(`${token}-${user[0]?.name}`);

  await UserModel.findByIdAndUpdate(user[0].id, {
    $set: {
      token,
    },
  });

  res.status(200).json({ message: "Mail sent successfully" });
});

export const emailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.session.user?.id) {
      res.status(403).end();
      return;
    }

    const [token, name] = req.body.token.split("-");

    const user = await UserService.findByNameEmail({ name, email: "" });

    if (!user.length || user[0]?.verified || user[0].token !== token)
      throw new Error("Invalid Token or Expired token");

    await UserModel.findByIdAndUpdate(user[0].id, {
      $set: {
        verified: true,
        token: "",
      },
    });

    res.status(200).json({ message: "Email verified successfully" });
  }
);

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.session.user?.id) {
    res.status(403).end();
    return;
  }

  const nameOrEmail = xss(req.body.name);
  const password = req.body.password;

  const users = await UserService.findByNameEmail(
    { name: nameOrEmail, email: nameOrEmail },
    true
  );

  if (!users || !users.length) {
    throw new Error("Invalid email or password.");
  }

  // if (!users[0].verified) {
  //     res.status(200).json({ message: "User not verified" });
  // }

  const validPassword = await verify(users[0].password as string, password);
  if (!validPassword) {
    throw new Error("Invalid  or password.");
  }

  if (users[0].verified) {
    req.session.user = {
      id: users[0].id.toString(),
      name: users[0].name,
      email: users[0].email,
    };
    req.session.save(() => {
      res.status(200).json(req.session.user);
    });
  } else {
    res.status(200).json({ email: users[0].email });
  }
});

export const updateUser = async (req: Request, res: Response) => {
  try {
    if (req && res) {
      console.log("yes");
    }
    res.status(200).send("hello");
  } catch (err) {
    console.log(err);
    res.status(500).end();
  }
};

export const forgotPassEmailSend = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.session.user?.id) {
      res.status(403).end();
      return;
    }

    const email = req.body.email;
    const password = await hash(req.body.password);

    const user = await UserService.findByNameEmail({ name: "", email });

    if (
      !user.length ||
      !user[0]?.verified ||
      user[0]?.forgotPassPassword.length
    )
      throw new Error("Invalid Email");

    if (!isDateGreaterOrLessThanADay(user[0].updatedAt)) {
      throw new Error("Please try again after 24 hours");
    }

    const token = generateRandomSequence();

    await sendEmail(email, `${token}-${user[0]?.name}`, true);

    await UserModel.findByIdAndUpdate(user[0].id, {
      $set: {
        token,
        forgotPassPassword: password,
      },
    });

    res.status(200).json({ email: user[0].email });
  }
);

export const forgotPassEmailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.session.user?.id) {
      res.status(403).end();
      return;
    }

    const [token, name] = req.body.token.split("-");

    const user = await UserService.findByNameEmail({ name, email: "" });

    if (
      !user.length ||
      !user[0]?.verified ||
      user[0].token !== token ||
      !user[0]?.forgotPassPassword.length
    )
      throw new Error("Invalid Token or Expired token");

    await UserModel.findByIdAndUpdate(user[0].id, {
      $set: {
        forgotPassPassword: "",
        token: "",
        password: user[0]?.forgotPassPassword,
      },
    });

    res.status(200).json({ message: "Email verified successfully" });
  }
);

export const getWallet = async (req: Request, res: Response) => {
  try {
    if (!req.session.user) {
      res.status(404).end();
      return;
    }

    const name = xss(req.session.user?.name); // Sanitize the input to prevent XSS

    const users = await UserModel.find({
      $or: [{ name }, { email: name }],
    });

    if (!users || !users.length) {
      res.status(404).end();
      return;
    }

    res.status(200).json({ wallet: users[0].wallet });
  } catch (err: unknown) {
    console.log(err);
    res.status(500).end();
  }
};
