import jwt from 'jsonwebtoken';
const JWT_SECRET = 'super-secret-fallback-key';
const token = jwt.sign({ uid: '123' }, JWT_SECRET);
try {
  jwt.verify(token, JWT_SECRET);
  console.log("Verified!");
} catch (e) {
  console.log("Error:", e);
}
