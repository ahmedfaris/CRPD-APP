import { adminAuth } from './src/lib/firebase-admin.ts';
import jwt from 'jsonwebtoken';

async function test() {
  const token = jwt.sign({ uid: '123' }, 'wrong-secret');
  try {
    await adminAuth.verifyIdToken(token);
  } catch (e: any) {
    console.log("Firebase threw:", e.message);
  }
}
test();
