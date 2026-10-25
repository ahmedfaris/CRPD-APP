import jwt from 'jsonwebtoken';
const token = jwt.sign({ uid: '123' }, 'secret', { expiresIn: '-1s' });
try {
  jwt.verify(token, 'secret');
} catch (e: any) {
  console.log("JWT Error:", e.name, e.message);
}
