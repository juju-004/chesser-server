import { Game, User } from "../../../types/index.js";
import { GameModel, UserModel } from "../index.js"; // Import models from index.js

export const activeGames: Game[] = [];

export const save = async (game: Game) => {
  try {
    const white: User = {};
    const black: User = {};

    if (typeof game.white?.id === "string") {
      white.name = game.white?.name;
    } else {
      white.id = game.white?.id;
    }
    if (typeof game.black?.id === "string") {
      black.name = game.black?.name;
    } else {
      black.id = game.black?.id;
    }

    // Create game document in MongoDB
    const newGame = new GameModel({
      winner: game.winner || null,
      endReason: game.endReason || null,
      pgn: game.pgn,
      code: game.code,
      whiteId: white.id || null,
      whiteName: white.name || null,
      blackId: black.id || null,
      blackName: black.name || null,
      startedAt: new Date(game.startedAt),
      endedAt: game.endedAt ? new Date(game.endedAt) : null,
    });

    const result = await newGame.save();

    // Update user stats (wins, losses, draws)
    if (white.id || black.id) {
      if (game.winner === "draw") {
        if (white.id) {
          await UserModel.updateOne({ _id: white.id }, { $inc: { draws: 1 } });
        }
        if (black.id) {
          await UserModel.updateOne({ _id: black.id }, { $inc: { draws: 1 } });
        }
      } else {
        const winner = game.winner === "white" ? white : black;
        const loser = game.winner === "white" ? black : white;

        if (winner.id) {
          await UserModel.updateOne({ _id: winner.id }, { $inc: { wins: 1 } });
        }
        if (loser.id) {
          await UserModel.updateOne({ _id: loser.id }, { $inc: { losses: 1 } });
        }
      }
    }

    return {
      id: result._id.toString(),
      winner: result.winner,
      endReason: result.endReason,
      pgn: result.pgn,
      white: { id: result.whiteId, name: result.whiteName },
      black: { id: result.blackId, name: result.blackName },
      startedAt: result.startedAt.getTime(),
      endedAt: result.endedAt ? result.endedAt.getTime() : undefined,
    };
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
      return {
        id: game._id.toString(),
        winner: game.winner,
        endReason: game.endReason,
        pgn: game.pgn,
        white: { id: game.whiteId.toString(), name: game.whiteName },
        black: { id: game.blackId.toString(), name: game.blackName },
        startedAt: game.startedAt.getTime(),
        endedAt: game.endedAt ? game.endedAt.getTime() : undefined,
      };
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
      white: { id: game.whiteId.toString(), name: game.whiteName },
      black: { id: game.blackId.toString(), name: game.blackName },
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
      return {
        id: game._id.toString(),
        winner: game.winner,
        endReason: game.endReason,
        pgn: game.pgn,
        white: { id: game.whiteId.toString(), name: game.whiteName },
        black: { id: game.blackId.toString(), name: game.blackName },
        startedAt: game.startedAt.getTime(),
        endedAt: game.endedAt ? game.endedAt.getTime() : undefined,
      };
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
