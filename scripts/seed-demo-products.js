require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql');
const Web3 = require('web3');

const countArg = process.argv.find(arg => arg.startsWith('--count='));
const count = Math.max(1, Math.min(10000, Number(countArg ? countArg.split('=')[1] : 100) || 100));
const databaseOnly = process.argv.includes('--database-only');
const brands = [
  {brand:'Anker', models:['Nano Charger 30W','Soundcore Motion+','PowerCore 20K','737 Power Bank','Prime Dock 14-in-1'], maker:'Anker Innovations', location:'Shenzhen, Trung Quốc'},
  {brand:'Apple', models:['iPhone 16','MacBook Air 15','AirPods Pro 2','Apple Watch Series 10','iPad Air 11'], maker:'Apple Manufacturing', location:'California, Hoa Kỳ'},
  {brand:'Asus', models:['Zenbook 14 OLED','ROG Zephyrus G14','Vivobook S 15','ProArt PX13','ROG Ally X'], maker:'ASUS Technology', location:'Taipei, Đài Loan'},
  {brand:'Biti’s', models:['Hunter X Lite','Hunter Street','Biti’s Hunter Core','Sandal Urban','Hunter Running'], maker:'Biti’s Footwear', location:'Bình Dương, Việt Nam'},
  {brand:'Canon', models:['EOS R50','EOS R6 Mark II','RF 50mm F1.8','PowerShot G7 X III','RF 24-105mm F4'], maker:'Canon Inc.', location:'Oita, Nhật Bản'},
  {brand:'Dell', models:['XPS 13','Inspiron 14 Plus','Latitude 7450','Alienware m16 R2','Precision 5690'], maker:'Dell Technologies', location:'Austin, Hoa Kỳ'},
  {brand:'Garmin', models:['Forerunner 265','Venu 3','Fenix 8','Edge 540','Instinct 2X Solar'], maker:'Garmin Ltd.', location:'Taipei, Đài Loan'},
  {brand:'Logitech', models:['MX Master 3S','MX Keys S','Brio 4K','G Pro X Superlight 2','Zone Vibe 100'], maker:'Logitech International', location:'Lausanne, Thụy Sĩ'},
  {brand:'Nike', models:['Air Max DN','Pegasus 41','Dunk Low Retro','Air Force 1 ’07','Vomero 18'], maker:'Nike Manufacturing', location:'Hồ Chí Minh, Việt Nam'},
  {brand:'Samsung', models:['Galaxy S25','Galaxy Buds3 Pro','Galaxy Watch Ultra','T7 Shield 2TB','Galaxy Tab S10+'], maker:'Samsung Electronics', location:'Bắc Ninh, Việt Nam'},
  {brand:'Sony', models:['WH-1000XM5','Alpha 7 IV','PlayStation 5 Slim','WF-1000XM5','FE 24-70mm F2.8 GM II'], maker:'Sony Corporation', location:'Tokyo, Nhật Bản'},
  {brand:'Xiaomi', models:['Xiaomi 15','Redmi Note 14 Pro','Smart Band 9 Pro','Robot Vacuum X20+','Power Bank 20K'], maker:'Xiaomi Communications', location:'Bắc Giang, Việt Nam'}
];
const descriptions = [
  'Hàng chính hãng, kiểm định chất lượng trước khi xuất xưởng.',
  'Phiên bản phân phối chính thức, có tem định danh Astryx.',
  'Sản phẩm thuộc lô hàng tiêu chuẩn, hỗ trợ truy xuất nguồn gốc.',
  'Được đóng gói và kiểm tra theo quy trình của nhà sản xuất.'
];

function makeProduct(index) {
  const id = index + 1;
  const source = brands[index % brands.length];
  const model = source.models[Math.floor(index / brands.length) % source.models.length];
  const serialForHash = `AX-${String(id).padStart(6,'0')}`;
  const serial = id === 1 ? 'AX-00001' : serialForHash;
  const batch = `LOT-${2025 + Math.floor(index / 240)}-${String(Math.floor(index / 20) % 12 + 1).padStart(2,'0')}`;
  const uid = `ASTRYX-DEMO-${String(id).padStart(6,'0')}`;
  const issuedAt = new Date(Date.UTC(2025,0,1) + id * 3600000);
  const timestamp = issuedAt.toISOString();
  const salt = crypto.createHash('sha256').update(`astryx-demo-fixture-v1:${id}`).digest('hex').slice(0,32);
  const hash = crypto.createHash('sha256').update([source.brand,model,batch,serialForHash,uid,timestamp,salt].join('')).digest('hex');
  return {
    id, codeHash:hash, brand:source.brand, model, serial, batch, uid,
    description:`${descriptions[(id - 1) % descriptions.length]} Mã tư liệu thử nghiệm ${String(id).padStart(4,'0')}.`,
    manufacturerName:source.maker, manufacturerLocation:source.location,
    salt, issuedAt, timestamp
  };
}

function query(connection, sql, values) {
  return new Promise((resolve,reject) => connection.query(sql,values,(err,result) => err ? reject(err) : resolve(result)));
}
function send(method,args,from) {
  return new Promise((resolve,reject) => method.apply(null,args.concat([{from,gas:350000}],(err,result) => err ? reject(err) : resolve(result))));
}
function readCode(contract,hash) {
  const codeHash = hash.startsWith('0x') ? hash : '0x'+hash;
  return new Promise((resolve,reject) => contract.getCode(codeHash,(err,result) => err ? reject(err) : resolve(result)));
}

async function main() {
  if (process.argv.includes('--preview')) {
    const products = Array.from({length:count},(_,i) => makeProduct(i));
    console.log(`Prepared ${products.length} deterministic product fixtures (${new Set(products.map(p=>p.codeHash)).size} unique SHA-256 hashes).`);
    products.slice(0,10).forEach(p => console.log(`${p.codeHash}  ${p.brand} / ${p.model} / ${p.serial}`));
    return;
  }
  const db = mysql.createConnection({
    host:process.env.database_host || 'localhost', user:process.env.database_user || 'root',
    password:process.env.database_password || '', database:process.env.database_name || 'authentifi'
  });
  await new Promise((resolve,reject) => db.connect(err => err ? reject(err) : resolve()));
  const products = Array.from({length:count},(_,i) => makeProduct(i));
  let contract = null, chainAccount = null;
  if (!databaseOnly) {
    let address = process.env.CONTRACT_ADDRESS || '';
    if (!address) address = JSON.parse(fs.readFileSync(path.join(__dirname,'..','contract-address.json'),'utf8')).address;
    const rpc = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545';
    const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const accounts = await new Promise((resolve,reject) => web3.eth.getAccounts((err,result) => err ? reject(err) : resolve(result)));
    if (!accounts.length) throw new Error('Ganache chưa có tài khoản. Hãy mở Ganache và deploy hợp đồng trước.');
    chainAccount = accounts[0];
    const abi = JSON.parse(fs.readFileSync(path.join(__dirname,'..','build','contracts_authentifi_sol_Authentifi.abi'),'utf8'));
    contract = web3.eth.contract(abi).at(address);
  }

  let created = 0, activated = 0, dbRows = 0;
  try {
    for (const p of products) {
      if (contract) {
        const [storedHash,isActive] = await readCode(contract,'0x'+p.codeHash);
        if (!storedHash || /^0x0{64}$/i.test(storedHash)) {
          await send(contract.createCode,['0x'+p.codeHash],chainAccount); created++;
        }
        if (!isActive) { await send(contract.activateProduct,['0x'+p.codeHash],chainAccount); activated++; }
      }
      await query(db,`INSERT INTO PRODUCTS
        (code_hash,brand,model,serial_id,batch_id,uid,description,manufacturer_name,manufacturer_location,salt,issued_at,activated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE brand=VALUES(brand),model=VALUES(model),serial_id=VALUES(serial_id),batch_id=VALUES(batch_id),uid=VALUES(uid),description=VALUES(description),manufacturer_name=VALUES(manufacturer_name),manufacturer_location=VALUES(manufacturer_location),salt=VALUES(salt),issued_at=VALUES(issued_at),activated_at=COALESCE(VALUES(activated_at),activated_at)`,
        [p.codeHash,p.brand,p.model,p.serial,p.batch,p.uid,p.description,p.manufacturerName,p.manufacturerLocation,p.salt,p.issuedAt,contract?new Date():null]);
      if (contract) await query(db,'INSERT INTO OWNERSHIP_LOGS (product_code,owner_address,transfer_time) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM OWNERSHIP_LOGS WHERE product_code = ?)',[p.codeHash,chainAccount,p.issuedAt,p.codeHash]);
      dbRows++;
      if (dbRows % 25 === 0 || dbRows === count) console.log(`Seeded ${dbRows}/${count} products`);
    }
    console.log(`Done: ${dbRows} product rows upserted${databaseOnly?' (database only)':`; ${created} on-chain records created; ${activated} activated`}.`);
    if (databaseOnly) console.log('Database-only fixtures will not pass /api/verify until their hashes are registered and activated on-chain.');
  } finally { db.end(); }
}

main().catch(err => {
  if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    console.error('Demo seeding failed: không kết nối được MySQL. Kiểm tra dịch vụ MySQL và database_* trong .env.');
  } else console.error('Demo seeding failed:',err.message);
  process.exitCode=1;
});
