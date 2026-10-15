require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
const QRCode = require('qrcode');

const app = express();
const configuredPort = Number(process.env.PORT);
const port = configuredPort && configuredPort !== 3306 ? configuredPort : 8080;
const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545';
const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
const abi = [
  {constant:false,inputs:[{name:'_codeHash',type:'bytes32'}],name:'createCode',outputs:[],payable:false,stateMutability:'nonpayable',type:'function'},
  {constant:false,inputs:[{name:'_codeHash',type:'bytes32'}],name:'activateProduct',outputs:[],payable:false,stateMutability:'nonpayable',type:'function'},
  {constant:false,inputs:[{name:'_codeHash',type:'bytes32'}],name:'verifyProduct',outputs:[{name:'',type:'uint256'}],payable:false,stateMutability:'nonpayable',type:'function'},
  {constant:false,inputs:[{name:'_codeHash',type:'bytes32'},{name:'_newOwner',type:'address'}],name:'changeOwner',outputs:[],payable:false,stateMutability:'nonpayable',type:'function'},
  {constant:true,inputs:[{name:'_codeHash',type:'bytes32'}],name:'getCode',outputs:[{name:'',type:'bytes32'},{name:'',type:'bool'},{name:'',type:'uint256'},{name:'',type:'uint256'},{name:'',type:'address'}],payable:false,stateMutability:'view',type:'function'}
];
let contractAddress = process.env.CONTRACT_ADDRESS || '';
try {
  if (!contractAddress) contractAddress = JSON.parse(fs.readFileSync(path.join(__dirname, 'contract-address.json'), 'utf8')).address;
} catch (_) {}
let contract = contractAddress ? web3.eth.contract(abi).at(contractAddress) : null;
const db = mysql.createConnection({
  host: process.env.database_host || 'localhost', user: process.env.database_user || 'root',
  password: process.env.database_password || '', database: process.env.database_name || 'authentifi'
});
let dbReady = false;
const memoryLogs = [];
const memoryProducts = new Map();
const memoryOwnership = new Map();
const handshakeSessions = new Map();
app.use(express.json({limit:'32kb'}));
app.use(express.urlencoded({extended:true}));
app.use((req,res,next) => {
  const requested = path.posix.normalize(req.path);
  const publicPages = ['/index.html','/verify.html','/createCodes.html','/createRetailer.html','/test-qr.html'];
  if (/\.html?$/i.test(requested) && !publicPages.includes(requested)) return res.status(404).send('Not found');
  next();
});
app.use(express.static(path.join(__dirname, 'views')));

db.connect(err => {
  if (err) return console.warn('[mysql] KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c; scan log chá»‰ giá»¯ trong bá»™ nhá»›:', err.message);
  db.query(`CREATE TABLE IF NOT EXISTS SCAN_LOGS (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(64) NOT NULL,
    scan_time DATETIME NOT NULL,
    ip_address VARCHAR(45) NULL,
    location_data VARCHAR(255) NULL,
    anomaly_flag BOOLEAN DEFAULT 0,
    INDEX idx_product_code (product_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, createErr => {
    if (createErr) console.warn('[mysql] KhÃ´ng thá»ƒ khá»Ÿi táº¡o SCAN_LOGS:', createErr.message);
    else db.query(`CREATE TABLE IF NOT EXISTS PRODUCTS (
      code_hash CHAR(64) PRIMARY KEY, brand VARCHAR(160) NOT NULL, model VARCHAR(160) NOT NULL,
      serial_id VARCHAR(160) NULL, batch_id VARCHAR(160) NULL, uid VARCHAR(160) NULL,
      description TEXT NULL, manufacturer_name VARCHAR(200) NOT NULL, manufacturer_location VARCHAR(255) NOT NULL,
      salt CHAR(32) NOT NULL, issued_at DATETIME(3) NOT NULL, activated_at DATETIME(3) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, productErr => {
      if (productErr) console.warn('[mysql] KhÃ´ng thá»ƒ khá»Ÿi táº¡o PRODUCTS:', productErr.message);
      else db.query(`CREATE TABLE IF NOT EXISTS OWNERSHIP_LOGS (
        log_id INT AUTO_INCREMENT PRIMARY KEY, product_code CHAR(64) NOT NULL,
        owner_address VARCHAR(42) NOT NULL, transfer_time DATETIME NOT NULL,
        INDEX idx_ownership_product (product_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, ownerErr => {
        if (ownerErr) console.warn('[mysql] KhÃ´ng thá»ƒ khá»Ÿi táº¡o OWNERSHIP_LOGS:', ownerErr.message);
        else { dbReady = true; console.log('[mysql] Product, ownership and scan records ready'); }
      });
    });
  });
});

const q = (sql, args) => new Promise((resolve, reject) => db.query(sql, args, (e, rows) => e ? reject(e) : resolve(rows)));
function requireContract(res) {
  if (!contract) { res.status(503).json({error:'ChÆ°a cáº¥u hÃ¬nh há»£p Ä‘á»“ng. HÃ£y cháº¡y npm run compile, npm run deploy rá»“i khá»Ÿi Ä‘á»™ng láº¡i server.'}); return false; }
  return true;
}
function getAccounts() {
  return new Promise((resolve, reject) => web3.eth.getAccounts((e, accounts) => e ? reject(e) : resolve(accounts)));
}
function tx(method, args) {
  return new Promise((resolve, reject) => {
    const callback = (e, result) => e ? reject(e) : resolve(result);
    method.apply(null, args.concat([{from: web3.eth.defaultAccount, gas: 400000}], callback));
  });
}
function readCode(hash) {
  return new Promise((resolve, reject) => contract.getCode(hash, (e, result) => e ? reject(e) : resolve(result)));
}
function cleanHash(raw) {
  const candidate = String(raw || '').trim().replace(/^https?:\/\/[^/]+\/verify\?code=/i, '').replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(candidate)) throw new Error('MÃ£ sáº£n pháº©m pháº£i lÃ  SHA-256 gá»“m 64 kÃ½ tá»± hex.');
  return '0x' + candidate.toLowerCase();
}
async function resolveProductHash(raw) {
  try { return cleanHash(raw); } catch (_) {}
  const serial = String(raw || '').trim();
  if (!serial || serial.length > 160) return null;
  const candidates = [serial];
  const serialParts = serial.match(/^([A-Za-z][A-Za-z0-9_-]*?)(\d+)$/);
  if (serialParts && serialParts[2].length < 6) candidates.push(serialParts[1] + serialParts[2].padStart(6, '0'));
  for (const candidate of candidates) {
    for (const [hash, product] of memoryProducts) if (String(product.serial || '').trim() === candidate) return hash;
    if (dbReady) {
      const rows = await q('SELECT code_hash FROM PRODUCTS WHERE serial_id = ? ORDER BY issued_at DESC LIMIT 1', [candidate]);
      if (rows.length) return '0x' + String(rows[0].code_hash).replace(/^0x/i, '').toLowerCase();
    }
  }
  return null;
}
async function publicProductCode(hash) {
  const product = memoryProducts.get(hash);
  if (product && product.serial && String(product.serial).trim()) return String(product.serial).trim();
  if (dbReady) {
    const rows = await q('SELECT serial_id AS serial FROM PRODUCTS WHERE code_hash = ? LIMIT 1', [hash.slice(2)]);
    if (rows.length && rows[0].serial) return String(rows[0].serial).trim();
  }
  return hash.slice(2);
}
function sendPage(file) { return (req, res) => res.sendFile(path.join(__dirname, 'views', file)); }

app.get('/', sendPage('index.html'));
app.get('/verify', sendPage('verify.html'));
app.get('/verify-result', sendPage('verify-result.html'));
app.get('/createCodes', sendPage('createCodes.html'));
app.get('/createRetailer', sendPage('createRetailer.html'));
app.get('/test-qr', sendPage('test-qr.html'));
app.get('/health', (req,res) => res.json({ok:true, blockchain:!!contract, mysql:dbReady}));

app.get('/api/qr', async (req,res) => {
  try {
    const hash = await resolveProductHash(req.query.code);
    if (!hash) return res.status(404).json({error:'KhÃ´ng tÃ¬m tháº¥y serial/mÃ£ sáº£n pháº©m Ä‘á»ƒ táº¡o QR.'});
    const requestedCode = String(req.query.code || '').trim();
    const productCode = /^[0-9a-f]{64}$/i.test(requestedCode.replace(/^0x/i, '')) ? await publicProductCode(hash) : requestedCode;
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify?code=${encodeURIComponent(productCode)}`;
    const png = await QRCode.toBuffer(verifyUrl, {type:'png', width:512, margin:4, errorCorrectionLevel:'H', color:{dark:'#11101c',light:'#ffffff'}});
    res.type('png').set('Cache-Control','no-store').send(png);
  } catch(e) { res.status(400).json({error:e.message || 'KhÃ´ng thá»ƒ táº¡o áº£nh QR.'}); }
});

app.post('/QRCodeForManufacturer', async (req, res) => {
  try {
    if (!requireContract(res)) return;
    const {brand, model, description, manufacturerName, manufacturerLocation, serial, batch, uid} = req.body;
    if (![brand,model,manufacturerName,manufacturerLocation].every(v => typeof v === 'string' && v.trim())) return res.status(400).json({error:'ThÆ°Æ¡ng hiá»‡u, máº«u, nhÃ  sáº£n xuáº¥t vÃ  Ä‘á»‹a Ä‘iá»ƒm lÃ  báº¯t buá»™c.'});
    const serialId = String(serial || '').trim();
    if (serialId && [...memoryProducts.values()].some(product => String(product.serial || '').trim() === serialId)) return res.status(409).json({error:'Serial ID Ä‘Ã£ Ä‘Æ°á»£c dÃ¹ng cho sáº£n pháº©m khÃ¡c.'});
    if (serialId && dbReady) {
      const duplicate = await q('SELECT code_hash FROM PRODUCTS WHERE serial_id = ? LIMIT 1', [serialId]);
      if (duplicate.length) return res.status(409).json({error:'Serial ID Ä‘Ã£ Ä‘Æ°á»£c dÃ¹ng cho sáº£n pháº©m khÃ¡c.'});
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString();
    const payload = [brand,model,batch || '',serial || '',uid || '',timestamp,salt].join('');
    const hash = '0x' + crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    const accounts = await getAccounts();
    if (!accounts.length) return res.status(503).json({error:'Ganache chÆ°a cáº¥p tÃ i khoáº£n.'});
    web3.eth.defaultAccount = accounts[0];
    await tx(contract.createCode, [hash]);
    const product = {codeHash:hash,brand:brand.trim(),model:model.trim(),serial:serialId,batch:batch||'',uid:uid||'',description:description||'',manufacturerName:manufacturerName.trim(),manufacturerLocation:manufacturerLocation.trim(),salt,issuedAt:timestamp,activatedAt:null};
    memoryProducts.set(hash, product);
    memoryOwnership.set(hash, [{ownerAddress:accounts[0],transferTime:timestamp,role:'manufacturer'}]);
    if (dbReady) {
      try {
        await q('INSERT INTO PRODUCTS (code_hash,brand,model,serial_id,batch_id,uid,description,manufacturer_name,manufacturer_location,salt,issued_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [hash.slice(2),product.brand,product.model,product.serial,product.batch,product.uid,product.description,product.manufacturerName,product.manufacturerLocation,salt,new Date(timestamp)]);
        await q('INSERT INTO OWNERSHIP_LOGS (product_code,owner_address,transfer_time) VALUES (?,?,?)', [hash.slice(2),accounts[0],new Date(timestamp)]);
      } catch(e) { console.warn('[mysql] KhÃ´ng ghi Ä‘Æ°á»£c product metadata:',e.message); }
    }
    const productCode = serialId || hash.slice(2);
    res.status(201).json({codeHash:hash, productCode, verifyUrl:`${req.protocol}://${req.get('host')}/verify?code=${encodeURIComponent(productCode)}`, brand:brand.trim(), model:model.trim(), timestamp, activated:false, saltIssued:true});
  } catch(e) { res.status(400).json({error:e.message || 'KhÃ´ng thá»ƒ táº¡o mÃ£ trÃªn blockchain.'}); }
});

app.post('/api/products/:hash/activate', async (req,res) => {
  try {
    if (!requireContract(res)) return;
    const hash = cleanHash(req.params.hash); const [productCode] = await readCode(hash);
    if (!productCode || /^0x0{64}$/.test(productCode)) return res.status(404).json({error:'KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.'});
    const accounts = await getAccounts(); if (!accounts.length) return res.status(503).json({error:'Ganache chÆ°a cáº¥p tÃ i khoáº£n.'});
    web3.eth.defaultAccount = accounts[0]; await tx(contract.activateProduct,[hash]);
    const activatedAt = new Date();
    const product = memoryProducts.get(hash); if (product) product.activatedAt = activatedAt.toISOString();
    if (dbReady) { try { await q('UPDATE PRODUCTS SET activated_at = ? WHERE code_hash = ?',[activatedAt,hash.slice(2)]); } catch(e) { console.warn('[mysql] KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c activation time:',e.message); } }
    res.json({ok:true, codeHash:hash, activated:true});
  } catch(e) { res.status(400).json({error:e.message || 'KhÃ´ng thá»ƒ kÃ­ch hoáº¡t sáº£n pháº©m.'}); }
});

app.post('/api/verify', async (req,res) => {
  let hash;
  try {
    if (!requireContract(res)) return;
    hash = await resolveProductHash(req.body.productCode || req.body.codeHash || req.body.code);
    if (!hash) return res.status(404).json({valid:false,card:'red',message:'MÃƒ KHÃ”NG Há»¢P Lá»† â€” KhÃ´ng tÃ¬m tháº¥y serial/mÃ£ sáº£n pháº©m.'});
    const accounts = await getAccounts(); if (!accounts.length) return res.status(503).json({error:'Ganache chÆ°a cáº¥p tÃ i khoáº£n.'});
    web3.eth.defaultAccount = accounts[0];
    const [storedHash, active, oldCount, activatedAt, currentOwner] = await readCode(hash);
    if (!storedHash || /^0x0{64}$/.test(storedHash)) return res.status(404).json({valid:false,card:'red',codeHash:hash,message:'MÃƒ KHÃ”NG Há»¢P Lá»† â€” KhÃ´ng tá»“n táº¡i trÃªn sá»• cÃ¡i.'});
    if (!active) return res.status(409).json({valid:false,card:'red',message:'Sáº¢N PHáº¨M CHÆ¯A ÄÆ¯á»¢C KÃCH HOáº T.'});
    await tx(contract.verifyProduct,[hash]);
    const [, , updatedCount] = await readCode(hash);
    const scanCount = Number(updatedCount);
    const anomaly = scanCount > 1;
    const location = req.body.location && Number.isFinite(req.body.location.latitude) ? `${req.body.location.latitude}, ${req.body.location.longitude}` : null;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().slice(0,45);
    const log = {codeHash:hash, scanCount, scanTime:new Date().toISOString(), ipAddress:ip, location, anomaly};
    if (dbReady) {
      try { await q('INSERT INTO SCAN_LOGS (product_code, scan_time, ip_address, location_data, anomaly_flag) VALUES (?, NOW(), ?, ?, ?)', [hash.slice(2),ip,location,anomaly ? 1 : 0]); }
      catch(e) { console.warn('[mysql] KhÃ´ng ghi Ä‘Æ°á»£c scan log:',e.message); memoryLogs.push(log); }
    } else memoryLogs.push(log);
    let previousScans = [];
    if (anomaly && dbReady) {
      try { previousScans = await q('SELECT scan_time AS scanTime, ip_address AS ipAddress, location_data AS location FROM SCAN_LOGS WHERE product_code = ? AND log_id < LAST_INSERT_ID() ORDER BY log_id DESC LIMIT 4',[hash.slice(2)]); } catch (_) {}
    }
    if (anomaly && !previousScans.length) previousScans = memoryLogs.filter(row => row.codeHash === hash && row.scanCount < scanCount).slice(-4).reverse();
    let product = memoryProducts.get(hash) || null;
    let provenance = memoryOwnership.get(hash) || [];
    if (dbReady) {
      try {
        const rows = await q('SELECT brand,model,serial_id AS serial,batch_id AS batch,description,manufacturer_name AS manufacturerName,manufacturer_location AS manufacturerLocation,issued_at AS issuedAt,activated_at AS activatedAt FROM PRODUCTS WHERE code_hash = ? LIMIT 1',[hash.slice(2)]);
        if (rows.length) product = rows[0];
        const owners = await q('SELECT owner_address AS ownerAddress, transfer_time AS transferTime FROM OWNERSHIP_LOGS WHERE product_code = ? ORDER BY log_id ASC',[hash.slice(2)]);
        if (owners.length) provenance = owners;
      } catch(e) { console.warn('[mysql] KhÃ´ng Ä‘á»c Ä‘Æ°á»£c product provenance:',e.message); }
    }
    res.json({valid:true, codeHash:hash, card:anomaly?'red':'green', scanCount, message:anomaly?'Cáº¢NH BÃO NGHI Váº¤N HÃ€NG GIáº¢ â€” Tem QR cÃ³ dáº¥u hiá»‡u bá»‹ sao chÃ©p/photocopy.':'HÃ€NG CHÃNH HÃƒNG â€” XÃ¡c thá»±c láº§n Ä‘áº§u thÃ nh cÃ´ng.', activatedAt:Number(activatedAt), currentOwner, product, provenance, previousScans, scanLog:log, mysqlLogging:dbReady});
  } catch(e) { res.status(400).json({error:e.message || 'KhÃ´ng thá»ƒ xÃ¡c thá»±c sáº£n pháº©m.'}); }
});

// Two-party transfer handshake; tokens are random, single-use and expire within 600 seconds.
app.post('/api/ownership/handshake', (req,res) => {
  try {
    const codeHash = cleanHash(req.body.codeHash); const newOwner = String(req.body.newOwner || '').trim();
    if (!web3.isAddress(newOwner)) return res.status(400).json({error:'VÃ­ ngÆ°á»i nháº­n khÃ´ng há»£p lá»‡.'});
    const ttlSeconds = Math.min(600, Math.max(1, Number(req.body.ttlSeconds) || 600));
    const token = crypto.randomBytes(32).toString('hex'); const sellerToken = crypto.randomBytes(24).toString('hex'); const buyerToken = crypto.randomBytes(24).toString('hex'); const now = Date.now();
    handshakeSessions.set(token,{codeHash,newOwner,expiresAt:now+ttlSeconds*1000,sellerToken,buyerToken,sellerConfirmed:false,buyerConfirmed:false,completed:false});
    res.status(201).json({token,sellerToken,buyerToken,ttlSeconds,expiresAt:new Date(now+ttlSeconds*1000).toISOString(),status:'awaiting_confirmations'});
  } catch(e) { res.status(400).json({error:e.message}); }
});
app.post('/api/ownership/handshake/:token/confirm', async (req,res) => {
  try {
    if (!requireContract(res)) return;
    const session = handshakeSessions.get(req.params.token);
    if (!session) return res.status(404).json({error:'KhÃ´ng tÃ¬m tháº¥y phiÃªn bÃ n giao.'});
    if (session.completed) return res.status(409).json({error:'PhiÃªn nÃ y Ä‘Ã£ hoÃ n táº¥t.'});
    if (Date.now() > session.expiresAt) { handshakeSessions.delete(req.params.token); return res.status(410).json({error:'PhiÃªn bÃ n giao Ä‘Ã£ háº¿t háº¡n.'}); }
    const party = req.body.party;
    if (party !== 'seller' && party !== 'buyer') return res.status(400).json({error:'party pháº£i lÃ  seller hoáº·c buyer.'});
    const providedToken = String(req.body.participantToken || '');
    const expectedToken = session[party+'Token'];
    if (providedToken.length !== expectedToken.length || !crypto.timingSafeEqual(Buffer.from(providedToken),Buffer.from(expectedToken))) return res.status(403).json({error:'MÃ£ xÃ¡c nháº­n cá»§a bÃªn tham gia khÃ´ng há»£p lá»‡.'});
    session[party+'Confirmed'] = true;
    if (!(session.sellerConfirmed && session.buyerConfirmed)) return res.json({status:'awaiting_confirmations',sellerConfirmed:session.sellerConfirmed,buyerConfirmed:session.buyerConfirmed,expiresAt:new Date(session.expiresAt).toISOString()});
    const accounts = await getAccounts(); if (!accounts.length) return res.status(503).json({error:'Ganache chÆ°a cáº¥p tÃ i khoáº£n.'});
    web3.eth.defaultAccount = accounts[0]; await tx(contract.changeOwner,[session.codeHash,session.newOwner]); session.completed = true;
    const transferTime = new Date().toISOString();
    const history = memoryOwnership.get(session.codeHash) || [];
    history.push({ownerAddress:session.newOwner,transferTime,role:'owner'}); memoryOwnership.set(session.codeHash,history);
    if (dbReady) { try { await q('INSERT INTO OWNERSHIP_LOGS (product_code,owner_address,transfer_time) VALUES (?,?,?)',[session.codeHash.slice(2),session.newOwner,new Date(transferTime)]); } catch(e) { console.warn('[mysql] KhÃ´ng ghi Ä‘Æ°á»£c ownership history:',e.message); } }
    res.json({status:'completed',codeHash:session.codeHash,newOwner:session.newOwner});
  } catch(e) { res.status(400).json({error:e.message || 'KhÃ´ng thá»ƒ hoÃ n táº¥t bÃ n giao.'}); }
});

// Legacy scan endpoint now follows the same verification flow.
app.post('/scan', (req,res,next) => { req.url='/api/verify'; next(); });
app.listen(port, async () => {
  try { const accounts = await getAccounts(); if (accounts.length) web3.eth.defaultAccount=accounts[0]; } catch(e) { console.warn('[chain] Ganache chÆ°a sáºµn sÃ ng:',e.message); }
  console.log(`AuthentiFi server listening at http://localhost:${port}`);
});

