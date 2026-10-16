import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

await mongoose.connect(config.MONGODB_URI);
console.log(`[db] connected: ${mongoose.connection.name}`);

createApp().listen(config.PORT, () => {
  console.log(`[api] http://localhost:${config.PORT}`);
});
