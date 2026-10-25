import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp({ projectId: 'inductive-trail-20w9t' });
const auth = getAuth(app);

async function test() {
  try {
    await auth.createUser({ email: 'test@example.com', password: 'password123' });
    console.log("Create user success");
  } catch (e) {
    console.error("Create user failed:", e);
  }
}
test();
