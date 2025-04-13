import type { Request, Response } from "express";
import xss from "xss";

import { GameModel } from "../db/index.js";
import { UserModel } from "../db/index.js";

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const name = xss(req.params.name); // Sanitize the input to prevent XSS

        // Fetch user by name and email (name used as both name and email)
        const users = await UserModel.find({
            $or: [{ name }, { email: name }]
        });

        if (!users || !users.length) {
            // If no user found, send a 404 status
            res.status(404).end();
            return;
        }

        // Fetch recent games for the user
        const recentGames = await GameModel.find({
            $or: [{ whiteId: users[0].id }, { blackId: users[0].id }]
        });

        // Construct the public profile object
        const publicUser = {
            id: users[0].id,
            name: users[0].name,
            wins: users[0].wins,
            losses: users[0].losses,
            draws: users[0].draws
        };

        // Send the public user profile along with recent games
        res.status(200).json({ ...publicUser, recentGames });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};
