import type { Game, User } from "../../types/index.js";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";

import { asyncHandler } from "../db/helper.js";
import { GameModel, UserModel } from "../db/index.js";
import { activeGames } from "../state.js";
import { initGame, isValidGameParams } from "../db/services/game.js";
import { findByNameOrEmail } from "../db/services/user.js";

export const getGame = async (req: Request, res: Response) => {
  if (!req.params || !req.params.code) {
    throw Error("Invalid code");
  }

  const game = activeGames.get(req.params.code);

  if (!game) {
    const archivedGame = await GameModel.findOne({
      code: req.params.code,
    }).populate("white black", "_id name");

    if (archivedGame) {
      res.status(200).json(archivedGame);
    } else {
      res.status(404).end();
    }
  } else {
    res.status(200).json(game);
  }
};

export const createGame = asyncHandler(async (req: Request, res: Response) => {
  const timeControl = parseFloat(req.body.timeControl);
  const amount = parseFloat(req.body.amount);
  const name = req.session.user?.name;

  const findUser = await findByNameOrEmail({ name });

  const err = isValidGameParams(amount, findUser.wallet, timeControl);
  if (err) throw Error(err);

  const user: User = {
    id: req.session.user.id,
    name,
  };

  const game: Partial<Game> = {
    host: user,
    stake: amount,
    timeControl,
  };

  // Assign sides to the user based on input or randomly
  if (req.body.side === "white") {
    game.white = user;
  } else if (req.body.side === "black") {
    game.black = user;
  } else {
    // Random side assignment
    if (Math.floor(Math.random() * 2) === 0) {
      game.white = user;
    } else {
      game.black = user;
    }
  }

  const mainGame = initGame(game);

  // Respond with the game code
  res.status(201).json({ code: mainGame.code });
}, true);
