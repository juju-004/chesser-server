import { Request, Response, NextFunction } from "express";

// Define a custom error type for extended error handling
interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction // Required for Express error handling middleware
): void => {
  const statusCode = err.statusCode || 500; // Default to 500 if no status code is provided
  const message = err.message || "Internal Server Error"; // Default message if none is provided

  res.status(statusCode).json({
    message,
  });

  next();
};

// Define the type for an async route handler
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export const asyncHandler = (fn: AsyncHandler, requiresSession = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.session?.user?.id;
    if (requiresSession) {
      if (!id) {
        next({ message: "Not found", statusCode: 404 });
        return;
      }
    } else {
      if (id) {
        next({ message: "Not found", statusCode: 404 });
        return;
      }
    }

    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export function generateRandomSequence(length = 30) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

export function isDateGreaterOrLessThanADay(
  targetDateInput: string | Date,
  targetLength = 1
): boolean {
  // Parse the target date
  const targetDate =
    typeof targetDateInput === "string"
      ? new Date(targetDateInput)
      : targetDateInput;

  // Get the current date
  const currentDate = new Date();

  // Calculate the difference in milliseconds
  const differenceInMs = currentDate.getTime() - targetDate.getTime();

  const differenceInDays = differenceInMs / (1000 * 60 * 60 * 24);

  if (differenceInDays > targetLength) {
    return true;
  } else {
    return false;
  }
}
