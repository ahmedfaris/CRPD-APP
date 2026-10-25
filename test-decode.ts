import jwt from 'jsonwebtoken';
const token = jwt.sign({ uid: '123' }, 'secret');
console.log(jwt.decode(token, { complete: true })?.header);
