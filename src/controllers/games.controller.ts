import type { Game, User } from "../../types/index.js";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";

import { asyncHandler } from "../db/helper.js";
import { GameModel, UserModel } from "../db/index.js";
import { activeGames } from "../state.js";

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

  const findUser = await UserModel.find({
    $or: [{ name: req.session.user?.name }, { email: req.session.user?.name }],
  });

  if (isNaN(amount) || amount < 100) {
    throw new Error("Invalid amount");
  }

  if (findUser[0]?.wallet < amount) {
    throw new Error("Insufficient funds");
  }

  if (isNaN(timeControl) || timeControl < 1) {
    throw new Error("Invalid time control");
  }

  const user: User = {
    id: req.session.user.id,
    name: req.session.user.name,
    connected: false,
  };

  const game: Game = {
    code: nanoid(6),
    host: user,
    pgn: "",
    stake: amount,
    timeControl,
    activePlayer: "white",
    timer: {
      white: timeControl * 60 * 1000, // Convert minutes to ms
      black: timeControl * 60 * 1000,
      lastUpdate: Date.now(),
    },
    chat: [],
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

  // Save the game to active games
  activeGames.set(game.code, game);

  // Respond with the game code
  res.status(201).json({ code: game.code });
}, true);
