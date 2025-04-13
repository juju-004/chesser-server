import type { User } from "../../types/index.js";
import MongoStore from "connect-mongo";
import type { Session } from "express-session";
import session from "express-session";
import { nanoid } from "nanoid";

// MongoDB connection URI
const mongoURI = process.env.MONGO_URL;

declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

declare module "http" {
  interface IncomingMessage {
    session: Session & {
      user: User;
    };
  }
}

const sessionMiddleware = session({
  store: MongoStore.create({
    mongoUrl: mongoURI,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "chesser",
  proxy: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    secure: process.env.NODE_ENV === "production" ? true : false,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  },
  genid: function () {
    return nanoid(21);
  },
});

export default sessionMiddleware;
