import { Request, Response } from "express";
import { asyncHandler } from "../db/helper.js";
import Preference from "../db/index.js";

export const getUserPreference = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;

    const pref = await Preference.findOne({ id });
    if (!pref) throw Error("Preferences not found");
    res.json(pref);
  },
  true
);

export const updatePreference = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    const { ...updates } = req.body;

    const pref = await Preference.findOneAndUpdate({ id }, updates, {
      new: true,
    });

    if (!pref) throw Error("Preferences not found");

    res.json(pref);
  },
  true
);
