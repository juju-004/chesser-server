import { nanoid } from "nanoid";
import { Game } from "../../../types/index.js";
import { activeGames, gameChats } from "../../state.js";
import { GameModel, UserModel } from "../models/index.js";

export const save = async (game: Game) => {
  try {
    const percentage = 8;

    const chat = gameChats.get(game.code);
    // Create game document in MongoDB
    const newGame = new GameModel({
      winner: game.winner,
      endReason: game.endReason,
      pgn: game.pgn,
      code: game.code,
      stake: game.stake,
      timer: game.timer,
      timeControl: game.timeControl,
      white: game.white.id,
      black: game.black.id,
      startedAt: new Date(game.startedAt),
      chat,
    });

    const result = await newGame.save();

    // Update user stats (wins, losses, draws)
    if (game.winner === "draw") {
      await UserModel.updateOne({ _id: game.white.id }, { $inc: { draws: 1 } });
      await UserModel.updateOne({ _id: game.black.id }, { $inc: { draws: 1 } });
    } else {
      const winnerId = game.winner === "white" ? game.white.id : game.black.id;
      const looserId = game.winner === "white" ? game.black.id : game.white.id;

      if (winnerId) {
        await UserModel.updateOne(
          { _id: winnerId },
          {
            $inc: {
              wins: 1,
              wallet: game.stake - (game.stake * percentage) / 100,
            },
          }
        );
      }
      if (looserId) {
        await UserModel.updateOne(
          { _id: looserId },
          { $inc: { losses: 1, wallet: -game.stake } }
        );
      }
    }

    const populatedResult = await result.populate(
      "white black",
      "_id name wallet"
    );
    const finalResponse = populatedResult.toObject();

    return finalResponse;
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

export const initGame = (game: Partial<Game>) => {
  const newGame: Game = {
    code: nanoid(6),
    pgn: "",
    stake: game.stake,
    timeControl: game.timeControl,
    activePlayer: "white",
    startedAt: Date.now(),
    timer: {
      white: game.timeControl * 60 * 1000, // Convert minutes to ms
      black: game.timeControl * 60 * 1000,
      lastUpdate: Date.now(),
    },
  };

  if (game.white) {
    newGame.white = {
      ...game.white,
    };
  }
  if (game.black) {
    newGame.black = {
      ...game.black,
    };
  }

  // Save the game to active games
  activeGames.set(newGame.code, newGame);
  gameChats.set(newGame.code, []);

  return newGame;
};

export const isValidGameParams = (
  amount: number,
  wallet: number,
  time: number
) => {
  if (isNaN(amount) || amount < 100) {
    return "Invalid amount";
  }

  if (wallet < amount) {
    return "Insufficient funds";
  }

  if (isNaN(time) || time < 1) {
    return "Invalid time control";
  }

  return false;
};

const GameService = {
  save,
};

export default GameService;
