// User-account requests in the ticket app: required official-request fields and the
// user-requests report. Run against a fresh server on :3000 (admin@system.local seeded).
const BASE = process.env.BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra); } };
const req = async (method, path, { token, body } = {}) => {
  const h = { 'content-type': 'application/json' };
  if (token) h.authorization = `Bearer ${token}`;
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
};
const short = (o) => String(JSON.stringify(o)).slice(0, 240);
const login = async (email, password) => (await req('POST', '/api/auth/login', { body: { email, password } })).data?.token;
const admin = await login('admin@system.local', 'Admin@2026!');
async function makeUser(email, fullName, role, userType, department) {
  const c = await req('POST', '/api/users', { token: admin, body: { email, userName: email, fullName, initialPassword: 'Passw0rd!2026xx', role, userType, department } });
  const uid = c.data?.data?.uid;
  await req('PATCH', `/api/users/${uid}`, { token: admin, body: { mustChangePassword: false } });
  await req('POST', '/api/auth/toggle-2fa', { token: admin, body: { userId: uid, enabled: false } });
  return { uid, token: await login(email, 'Passw0rd!2026xx') };
}
const tag = Date.now() % 100000;
const tech = await makeUser(`urtech${tag}@test.local`, 'Tara Tech', 'Agent', 'Technical', 'Information Technology');
const fin = await makeUser(`urfin${tag}@test.local`, 'Faris Finance', 'Employee', 'Operational User', 'Finance');
const hr = await makeUser(`urhr${tag}@test.local`, 'Huda HR', 'Employee', 'Operational User', 'Human Resources');
check('test users signed in', tech.token && fin.token && hr.token);

const base = { title: 'طلب حساب', description: '<p>x</p>', ticketType: 'User Request', priorityStars: 2, targetSystem: 'Active Directory' };
const full = (action, extra = {}) => ({ ...base, userRequestAction: action, userRequestDetails: { targetUsername: 'a.hassan', targetDepartment: 'المالية', requestNumber: `RQ/${tag}/1`, requestDate: '2026-11-10', ...extra } });

console.log('\n=== required fields ===');
for (const action of ['Create New User', 'Suspend User', 'Modify User Account & Permissions']) {
  const r = await req('POST', '/api/tickets', { token: fin.token, body: { ...base, userRequestAction: action, userRequestDetails: { targetFullName: 'Ali' } } });
  check(`${action}: missing username/department/number/date -> 400 naming them`, r.status === 400 && ['targetUsername', 'targetDepartment', 'requestNumber', 'requestDate'].every(f => r.data.fields?.includes(f)), `${r.status} ${short(r.data)}`);
}
let r = await req('POST', '/api/tickets', { token: fin.token, body: full('Create New User', { requestDate: '2026-02-30' }) });
check('impossible date rejected', r.status === 400 && r.data.fields?.includes('requestDate'), short(r.data));
r = await req('POST', '/api/tickets', { token: fin.token, body: full('Create New User', { requestDate: '2099-01-01' }) });
check('future date rejected', r.status === 400 && r.data.fields?.includes('requestDate'), short(r.data));
r = await req('POST', '/api/tickets', { token: fin.token, body: full('Create New User', { requestNumber: '   ' }) });
check('blank request number rejected', r.status === 400 && r.data.fields?.includes('requestNumber'), short(r.data));
r = await req('POST', '/api/tickets', { token: fin.token, body: { ...base, userRequestAction: 'Hack the planet', userRequestDetails: {} } });
check('unknown action rejected', r.status === 400, short(r.data));
r = await req('POST', '/api/tickets', { token: fin.token, body: { ...base, userRequestAction: 'Reset Password / Unlock Account', userRequestDetails: { targetUsername: 'x' } } });
check('password reset does not need the request number/date', r.status === 201, short(r.data));
const resetId = r.data?.data?.id;

const created = {};
const mk = async (who, action, extra) => {
  const x = await req('POST', '/api/tickets', { token: who.token, body: full(action, extra) });
  return x;
};
r = await mk(fin, 'Create New User', { targetUsername: ' a.hassan ', targetDepartment: 'المالية', requestDate: '2026-11-10' });
check('create-user request saved', r.status === 201, short(r.data));
created.create = r.data?.data;
check('details stored trimmed, with number and date', created.create?.userRequestDetails?.targetUsername === 'a.hassan' && created.create?.userRequestDetails?.requestNumber === `RQ/${tag}/1` && created.create?.userRequestDetails?.requestDate === '2026-11-10', short(created.create?.userRequestDetails));
r = await mk(fin, 'Suspend User', { targetUsername: 'm.ali', requestDate: '2026-11-12', requestNumber: `RQ/${tag}/2` });
check('suspend-user request saved', r.status === 201, short(r.data)); created.suspend = r.data?.data;
r = await mk(hr, 'Modify User Account & Permissions', { targetUsername: 's.omar', targetDepartment: 'الموارد البشرية', requestDate: '2026-10-05', requestNumber: `RQ/${tag}/3` });
check('change-permissions request saved', r.status === 201, short(r.data)); created.modify = r.data?.data;
const one = await req('GET', `/api/tickets/${created.suspend.id}`, { token: fin.token });
check('ticket details return the request number and date', one.data?.data?.userRequestDetails?.requestNumber === `RQ/${tag}/2` && one.data?.data?.userRequestAction === 'Suspend User', short(one.data?.data?.userRequestDetails));
const hw = await req('POST', '/api/tickets', { token: fin.token, body: { title: 'printer', description: '<p>x</p>', ticketType: 'Hardware Maintenance', userRequestAction: 'Create New User', userRequestDetails: { targetUsername: 'zzz' } } });
check('other ticket types drop user-request fields', hw.status === 201 && !hw.data.data.userRequestDetails && !hw.data.data.userRequestAction, short(hw.data?.data?.userRequestDetails));

console.log('\n=== report ===');
const mine = (rows) => rows.filter(x => [created.create.id, created.suspend.id, created.modify.id, resetId].includes(x.id));
let rep = await req('GET', '/api/tickets/reports/user-requests?from=2026-11-01&to=2026-11-30', { token: tech.token });
check('report responds', rep.status === 200 && rep.data.success, short(rep.data));
let rows = mine(rep.data.data.rows);
check('November contains the create and suspend requests, not October\'s', rows.some(x => x.id === created.create.id) && rows.some(x => x.id === created.suspend.id) && !rows.some(x => x.id === created.modify.id), short(rows));
const row = rows.find(x => x.id === created.create.id);
check('row has username, department, request, number, date, status', row && row.username === 'a.hassan' && row.department === 'المالية' && row.action === 'Create New User' && row.requestNumber === `RQ/${tag}/1` && row.date === '2026-11-10' && row.status === 'Open', short(row));
check('totals add up', rep.data.data.total === rep.data.data.rows.length && rep.data.data.completed + rep.data.data.open === rep.data.data.total
  && rep.data.data.byAction.reduce((a, b) => a + b.count, 0) === rep.data.data.total, short(rep.data.data.byAction));
check('only user-request tickets are listed', !rep.data.data.rows.some(x => x.id === hw.data.data.id));
rep = await req('GET', '/api/tickets/reports/user-requests?from=2026-10-01&to=2026-10-31', { token: tech.token });
check('October contains the permissions change', mine(rep.data.data.rows).map(x => x.id).join() === String(created.modify.id), short(mine(rep.data.data.rows)));
rep = await req('GET', '/api/tickets/reports/user-requests?from=2026-11-01&to=2026-11-30&action=Suspend%20User', { token: tech.token });
check('filter by request type', rep.data.data.rows.length >= 1 && rep.data.data.rows.every(x => x.action === 'Suspend User'), short(rep.data.data.rows));

// status change shows in the report
const upd = await req('PUT', `/api/tickets/${created.suspend.id}`, { token: tech.token, body: { status: 'Resolved', stage: 'Resolved' } });
check('technician resolves the suspend request', upd.status === 200, short(upd.data));
rep = await req('GET', '/api/tickets/reports/user-requests?from=2026-11-01&to=2026-11-30&status=Resolved', { token: tech.token });
check('status filter and new status shown', rep.data.data.rows.some(x => x.id === created.suspend.id && x.status === 'Resolved') && rep.data.data.rows.every(x => x.status === 'Resolved'), short(rep.data.data.rows));

console.log('\n=== access and input ===');
rep = await req('GET', '/api/tickets/reports/user-requests?from=2026-01-01&to=2026-12-31', { token: hr.token });
check('employee sees only requests of their own department', rep.status === 200 && rep.data.data.rows.some(x => x.id === created.modify.id) && !rep.data.data.rows.some(x => x.id === created.create.id), short(mine(rep.data.data.rows)));
check('anonymous cannot read the report', (await req('GET', '/api/tickets/reports/user-requests')).status === 401);
check('bad date -> 400', (await req('GET', '/api/tickets/reports/user-requests?from=2026-13-01', { token: tech.token })).status === 400);
check('reversed range -> 400', (await req('GET', '/api/tickets/reports/user-requests?from=2026-12-01&to=2026-11-01', { token: tech.token })).status === 400);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
