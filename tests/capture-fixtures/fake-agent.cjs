// Stand-in for the Windows scanning agent (same local API and origin rule), for browser tests on Linux.
// "Scanning" uploads two rendered letter pages with the ticket, exactly like the real agent.
const http = require('http');
const fs = require('fs');
const PAGES = [process.argv[2] + '/pages/02-letterA1.png', process.argv[2] + '/pages/03-letterA2.png'];
const ALLOWED = ['http://localhost:3000'];
http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!ALLOWED.includes(origin)) { res.writeHead(403, { 'content-type': 'application/json' }); return res.end('{"error":"origin not allowed"}'); }
  const h = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'content-type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...h, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true' }); return res.end(); }
  if (req.method === 'GET' && req.url === '/status') { res.writeHead(200, h); return res.end(JSON.stringify({ version: 'test', scanners: ['Test fi-7160 (TWAIN)'], busy: false })); }
  if (req.method === 'POST' && req.url === '/scan') {
    let body = ''; for await (const c of req) body += c;
    const r = JSON.parse(body);
    let batchId = null;
    for (const p of PAGES) {
      const up = await fetch(r.serverUrl + '/api/las-agent/pages', { method: 'POST', headers: { 'content-type': 'image/png', 'x-capture-ticket': r.ticket, 'x-scanner-name': r.scanner }, body: fs.readFileSync(p) });
      const j = await up.json(); if (!up.ok) { res.writeHead(500, h); return res.end(JSON.stringify({ error: j.error })); }
      batchId = j.data.batchId;
    }
    const done = await fetch(r.serverUrl + '/api/las-agent/complete', { method: 'POST', headers: { 'x-capture-ticket': r.ticket } });
    if (!done.ok) { res.writeHead(500, h); return res.end('{"error":"complete failed"}'); }
    res.writeHead(200, h); return res.end(JSON.stringify({ pages: PAGES.length, batchId }));
  }
  res.writeHead(404, h); res.end('{}');
}).listen(47115, '127.0.0.1', () => console.log('fake agent on 47115'));
