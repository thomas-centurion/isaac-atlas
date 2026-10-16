import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { EmailToken } from './models/EmailToken.js';
import { DailyPick, Verdict, Vote } from './models/Reactions.js';
import { Report } from './models/Report.js';
import { Run } from './models/Run.js';
import { User } from './models/User.js';

await mongoose.connect(config.MONGODB_URI);
console.log(`[db] connected: ${mongoose.connection.name}`);

// Crea los índices (únicos parciales, TTL) antes de aceptar tráfico.
await Promise.all([
  User.init(),
  EmailToken.init(),
  Run.init(),
  Vote.init(),
  Verdict.init(),
  DailyPick.init(),
  Report.init(),
]);

const sessionStore = MongoStore.create({
  client: mongoose.connection.getClient(),
  dbName: mongoose.connection.name,
  collectionName: 'sessions',
  // Las sesiones vencen solas (TTL) según la cookie.
  ttl: 30 * 24 * 60 * 60,
});

createApp({ sessionStore }).listen(config.PORT, () => {
  console.log(`[api] http://localhost:${config.PORT}`);
  if (!config.GOOGLE_CLIENT_ID) console.log('[auth] Google deshabilitado (faltan credenciales)');
});
