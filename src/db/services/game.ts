import { Game } from "../../../types/index.js";
import { GameModel, UserModel } from "../index.js"; // Import models from index.js

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

export const findByUserId = async (id: string, limit = 10) => {
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
};

const GameService = {
  findByUserId,
  save,
};

export default GameService;
