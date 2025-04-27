import { Game } from "../../../types/index.js";
import { GameModel, UserModel } from "../index.js"; // Import models from index.js

export const activeGames: Map<string, Game> = new Map();

export const save = async (game: Game) => {
  try {
    // Create game document in MongoDB
    const newGame = new GameModel({
      winner: game.winner,
      endReason: game.endReason,
      pgn: game.pgn,
      code: game.code,
      stake: game.stake,
      chat: game.chat,
      timer: game.timer,
      timeControl: game.timeControl,
      white: game.white.id,
      black: game.black.id,
      startedAt: new Date(game.startedAt),
      endedAt: game.endedAt ? new Date(game.endedAt) : Date.now(),
    });

    const result = await newGame.save();

    const populatedResult = await result.populate(
      "white black",
      "_id name wallet"
    );

    // Update user stats (wins, losses, draws)
    if (game.white.id || game.black.id) {
      if (game.winner === "draw") {
        await UserModel.updateOne(
          { _id: game.white.id },
          { $inc: { draws: 1 } }
        );
        await UserModel.updateOne(
          { _id: game.black.id },
          { $inc: { draws: 1 } }
        );
      } else {
        const winnerId =
          game.winner === "white" ? game.white.id : game.black.id;
        const looserId =
          game.winner === "white" ? game.black.id : game.white.id;

        if (winnerId) {
          await UserModel.updateOne(
            { _id: winnerId },
            { $inc: { wins: 1, wallet: game.stake } }
          );
        }
        if (looserId) {
          await UserModel.updateOne(
            { _id: looserId },
            { $inc: { losses: 1, wallet: -game.stake } }
          );
        }
      }
    }

    const finalResponse = populatedResult.toObject();

    return finalResponse;
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

export const findById = async (id: string) => {
  try {
    const game = await GameModel.findById(id).populate(
      "whiteId blackId",
      "name"
    );

    if (game) {
      return null;
      // return {
      //   id: game._id.toString(),
      //   winner: game.winner,
      //   endReason: game.endReason,
      //   pgn: game.pgn,
      //   white: { id: game.whiteId.toString(), name: game.whiteName },
      //   black: { id: game.blackId.toString(), name: game.blackName },
      //   startedAt: game.startedAt.getTime(),
      //   endedAt: game.endedAt ? game.endedAt.getTime() : undefined,
      // };
    } else {
      return null;
    }
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};
// export const findByCode = async (id: string) => {
//     try {
//          const game = await GameModel

//         if (game) {
//             return {
//                 id: game._id.toString(),
//                 winner: game.winner,
//                 endReason: game.endReason,
//                 pgn: game.pgn,
//                 white: { id: game.whiteId.toString(), name: game.whiteName },
//                 black: { id: game.blackId.toString(), name: game.blackName },
//                 startedAt: game.startedAt.getTime(),
//                 endedAt: game.endedAt ? game.endedAt.getTime() : undefined
//             };
//         } else {
//             return null;
//         }
//     } catch (err: unknown) {
//         console.log(err);
//         return null;
//     }
// };

export const findByUserId = async (id: string, limit = 10) => {
  try {
    const games = await GameModel.find({
      $or: [{ whiteId: id }, { blackId: id }],
    })
      .limit(limit)
      .populate("whiteId blackId", "name");

    return games.map((game) => ({
      id: game._id.toString(),
      winner: game.winner,
      endReason: game.endReason,
      pgn: game.pgn,
      // white: { id: game.whiteId.toString(), name: game.whiteName },
      // black: { id: game.blackId.toString(), name: game.blackName },
      startedAt: game.startedAt.getTime(),
      endedAt: game.endedAt ? game.endedAt.getTime() : undefined,
    }));
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

export const remove = async (id: string) => {
  try {
    const game = await GameModel.findByIdAndDelete(id);

    if (game) {
      return null;
      // return {
      //   id: game._id.toString(),
      //   winner: game.winner,
      //   endReason: game.endReason,
      //   pgn: game.pgn,
      //   white: { id: game.whiteId.toString(), name: game.whiteName },
      //   black: { id: game.blackId.toString(), name: game.blackName },
      //   startedAt: game.startedAt.getTime(),
      //   endedAt: game.endedAt ? game.endedAt.getTime() : undefined,
      // };
    } else {
      return null;
    }
  } catch (err: unknown) {
    console.log(err);
    return null;
  }
};

const GameService = {
  findByUserId,
  findById,
  save,
  remove,
};

export default GameService;
