/**
 * Da (o quita) el rol de moderador a un usuario.
 *
 *   npm run make-admin -- <username>
 *   npm run make-admin -- <username> --revoke
 *
 * Lee MONGODB_URI del .env. El rol vive solo en la base: no hay forma de pedirlo desde la web.
 */
import mongoose from 'mongoose';

const [username, flag] = process.argv.slice(2);
if (!username) {
  console.error('Uso: npm run make-admin -- <username> [--revoke]');
  process.exit(1);
}

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/isaac-atlas';
await mongoose.connect(uri);

const role = flag === '--revoke' ? 'user' : 'admin';
const result = await mongoose.connection
  .collection('users')
  .updateOne({ usernameLower: username.toLowerCase() }, { $set: { role } });

if (result.matchedCount === 0) {
  console.error(`No existe un usuario con username "${username}" en ${mongoose.connection.name}.`);
  process.exitCode = 1;
} else {
  console.log(`${username} ahora tiene el rol "${role}".`);
}
await mongoose.disconnect();
