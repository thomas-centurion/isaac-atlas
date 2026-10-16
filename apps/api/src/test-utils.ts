import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { config } from './config.js';
import { EmailToken } from './models/EmailToken.js';
import { Run } from './models/Run.js';
import { User } from './models/User.js';

let store: MongoStore | undefined;

/** Conecta a la base de tests y devuelve un store de sesiones real. */
export async function connectTestDb() {
  if (mongoose.connection.readyState !== 1) await mongoose.connect(config.MONGODB_URI);
  await Promise.all([User.init(), EmailToken.init(), Run.init()]);
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
    EmailToken.deleteMany({}),
    mongoose.connection.collection('sessions').deleteMany({}),
  ]);
}

export async function disconnectTestDb() {
  await store?.close();
  await mongoose.disconnect();
}
