import { hash, verify } from "argon2";
import type { Request, Response } from "express";
import xss from "xss";
import UserService from "../db/services/user.js";
import {
  asyncHandler,
  generateRandomSequence,
  isDateGreaterOrLessThanADay,
} from "../db/helper.js";
import { sendEmail } from "../db/mailer.js";
import { UserModel, Preference } from "../db/models/index.js";

export const getCurrentSession = (req: Request, res: Response) => {
  if (req.session.user) res.status(200).json(req.session.user);
  else res.status(404).end();
};

export const doesNameExist = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.params.name);
    const pattern = /^[A-Za-z0-9_]+$/;

    if (!pattern.test(name)) throw Error("Invalid Username Characters");

    const userExists = await UserModel.findOne({ name });

    if (userExists) res.status(200).json({ isAvail: false });
    else res.status(200).json({ isAvail: true });
  }
);

export const logoutSession = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.session.user;

    req.session.destroy(() => {
      res.status(204).end();
    });

    res.json(user);
  },
  true
);

export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const name = xss(req.body.name);
    const email = xss(req.body.email);
    const password = await hash(req.body.password);
    const pattern = /^[A-Za-z0-9_]+$/;

    if (!pattern.test(name)) throw Error("Invalid Username Characters");

    if (!email || !password || !password.length || !email.length)
      throw Error("Invalid params");

    const duplicateUser = await UserService.findByNameOrEmail(
      { name, email },
      false,
      false,
      true
    );

    if (duplicateUser) {
      throw new Error(`This username or email is already in use.`);
    }

    const token = generateRandomSequence();

    const mail = await sendEmail(email, `${token}-${name}`, false);

    if (!mail.success) throw Error("Failed to send mail");

    const newUser = await UserService.create({ name, email }, token, password);
    await Preference.create({ id: newUser.id });

    res.status(200).json({ email: newUser.email });
  }
);

export const sendMail = asyncHandler(async (req: Request, res: Response) => {
  const email = req.body.email;
  const type = req.body.password ? true : false;

  const user = await UserService.findByNameOrEmail({ email });

  if (type) {
    if (!user?.verified || user?.forgotPassPassword.length)
      throw Error("Invalid Email");

    if (!isDateGreaterOrLessThanADay(user.updatedAt)) {
      throw Error("Please try again after 24 hours");
    }
  } else {
    if (!user || user?.verified) throw Error("Invalid Email");
  }

  const token = generateRandomSequence();
  await sendEmail(
    email,
    `${type ? "f.pophfs45v" : ""}${token}-${user?.name}`,
    false
  );

  if (type) {
    const password = await hash(req.body.password);

    await UserModel.findByIdAndUpdate(user.id, {
      $set: {
        token,
        forgotPassPassword: password,
      },
    });
  } else {
    await UserModel.findByIdAndUpdate(user.id, {
      $set: {
        token,
      },
    });
  }

  res.status(200).json({ email: user.email });
});

export const emailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const [token, name] = req.body.token.split("-");

    const user = await UserService.findByNameOrEmail({ name });

    if ((token as string).startsWith("f.pophfs45v")) {
      if (
        !user?.verified ||
        user.token !== token ||
        !user?.forgotPassPassword.length
      )
        throw Error("Invalid Token or Expired token");

      await UserModel.findByIdAndUpdate(user.id, {
        $set: {
          forgotPassPassword: "",
          token: "",
          password: user?.forgotPassPassword,
        },
      });

      res.status(200).json({ message: "Password Changed successfully" });
    } else {
      if (!user || user?.verified || user.token !== token)
        throw Error("Invalid Token or Expired token");

      await UserModel.findByIdAndUpdate(user.id, {
        $set: {
          verified: true,
          token: "",
        },
      });
      res.status(200).json({ message: "Email verified successfully" });
    }
  }
);

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const nameOrEmail = xss(req.body.name);
  const password = req.body.password;

  const user = await UserService.findByNameOrEmail(
    { name: nameOrEmail, email: nameOrEmail },
    true
  );

  const validPassword = await verify(user.password as string, password);
  if (!validPassword) throw Error("Invalid username or password.");

  req.session.user = {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
  };

  req.session.save(() => {
    res.status(200).json(req.session.user);
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.session.user?.id.toString();
  const name = xss(req.body.name);
  const email = xss(req.body.email);

  const user = await UserService.findById(id);

  if (!isDateGreaterOrLessThanADay(user.updatedAt, 7)) {
    throw Error("Please try again in a weeks time");
  }

  const newUser = await UserService.update(id, { name, email });

  res.status(200).send(newUser);
}, true);

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserService.findByNameOrEmail({
    name: req.session.user?.name,
  });

  res.status(200).json({ wallet: user.wallet });
}, true);
