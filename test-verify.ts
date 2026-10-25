import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp({ projectId: 'inductive-trail-20w9t' });
const auth = getAuth(app);

async function test() {
  try {
    // just test if it can fetch public keys without crashing on project mismatch
    const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhMjM0In0.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vaW5kdWN0aXZlLXRyYWlsLTIwdzl0IiwiYXVkIjoiaW5kdWN0aXZlLXRyYWlsLTIwdzl0Iiwic3ViIjoidGVzdCJ9.signature';
    await auth.verifyIdToken(token);
  } catch (e: any) {
    console.log(e.code); // should be auth/argument-error or auth/invalid-credential, NOT permission denied
  }
}
test();
