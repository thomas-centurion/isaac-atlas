import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { config } from './config.js';
import { EmailToken } from './models/EmailToken.js';
import { Counter } from './models/Counter.js';
import { DailyPick, Verdict, Vote } from './models/Reactions.js';
import { Report } from './models/Report.js';
import { Run } from './models/Run.js';
import { User } from './models/User.js';

let store: MongoStore | undefined;

/** Conecta a la base de tests y devuelve un store de sesiones real. */
export async function connectTestDb() {
  if (mongoose.connection.readyState !== 1) await mongoose.connect(config.MONGODB_URI);
  await Promise.all([
    User.init(),
    EmailToken.init(),
    Run.init(),
    Vote.init(),
    Verdict.init(),
    DailyPick.init(),
    Report.init(),
  ]);
  store = MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: mongoose.connection.name,
    collectionName: 'sessions',
  });
  return store;
}

export async function resetTestDb() {
  await Promise.all([
    User.deleteMany({}),
    Run.deleteMany({}),
    Vote.deleteMany({}),
    Verdict.deleteMany({}),
    DailyPick.deleteMany({}),
    Report.deleteMany({}),
    EmailToken.deleteMany({}),
    Counter.deleteMany({}),
    mongoose.connection.collection('sessions').deleteMany({}),
  ]);
}

export async function disconnectTestDb() {
  await store?.close();
  await mongoose.disconnect();
}
