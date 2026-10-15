require('dotenv').config({quiet:true});
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql');
const Web3 = require('web3');

const port = Number(process.env.PORT) && Number(process.env.PORT) !== 3306 ? Number(process.env.PORT) : 8080;
const baseUrl = `http://127.0.0.1:${port}`;
const contractAddress = process.env.CONTRACT_ADDRESS || JSON.parse(fs.readFileSync(path.join(__dirname,'..','contract-address.json'),'utf8')).address;
const abi = JSON.parse(fs.readFileSync(path.join(__dirname,'..','build','contracts_authentifi_sol_Authentifi.abi'),'utf8'));
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545'));
const contract = web3.eth.contract(abi).at(contractAddress);
const db = mysql.createConnection({host:process.env.database_host||'localhost',user:process.env.database_user||'root',password:process.env.database_password||'',database:process.env.database_name||'authentifi'});
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const pass = label => console.log(`PASS ${label}`);
function assert(value,message){if(!value)throw new Error(message)}
function getCode(hash){return new Promise((resolve,reject)=>contract.getCode(hash,(e,result)=>e?reject(e):resolve(result)))}
function query(sql,args){return new Promise((resolve,reject)=>db.query(sql,args,(e,rows)=>e?reject(e):resolve(rows)))}
async function post(url,body){const response=await fetch(baseUrl+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()}}

async function main(){
  await new Promise((resolve,reject)=>db.connect(e=>e?reject(e):resolve()));
  const health=await fetch(baseUrl+'/health').then(r=>r.json());
  assert(health.blockchain,'Server chưa kết nối blockchain');
  assert(health.mysql,'Server chưa kết nối MySQL');
  const accounts=await new Promise((resolve,reject)=>web3.eth.getAccounts((e,a)=>e?reject(e):resolve(a)));
  assert(accounts.length>1,'Ganache cần ít nhất hai tài khoản');

  const serial='ACCEPTANCE-'+Date.now();
  const created=await post('/QRCodeForManufacturer',{brand:'Astryx Test Lab',model:'Acceptance Fixture',serial,batch:'TC-2026',uid:serial,description:'Automated local acceptance fixture',manufacturerName:'Astryx Test Lab',manufacturerLocation:'Ho Chi Minh City, Vietnam'});
  assert(created.status===201 && /^0x[0-9a-f]{64}$/.test(created.data.codeHash),'TC-01 tạo mã/hash: '+JSON.stringify(created.data));
  let chain=await getCode(created.data.codeHash);
  assert(chain[0].toLowerCase()===created.data.codeHash.toLowerCase() && !chain[1],'TC-01 hash chưa được tạo đúng trên chain');
  pass('TC-01 tạo mã SHA-256 trên Ganache');

  const activation=await post(`/api/products/${created.data.codeHash}/activate`,{});
  assert(activation.status===200 && activation.data.activated,'TC-02 API kích hoạt thất bại');
  chain=await getCode(created.data.codeHash);
  assert(chain[1]===true && Number(chain[3])>0,'TC-02 isVerified/activationTime sai');
  pass('TC-02 kích hoạt sản phẩm');

  const first=await post('/api/verify',{codeHash:created.data.codeHash,location:{latitude:10.7769,longitude:106.7009}});
  assert(first.status===200 && first.data.card==='green' && first.data.scanCount===1,'TC-03 lượt đầu không xanh/scanCount=1');
  const scanRows=await query('SELECT COUNT(*) AS count FROM SCAN_LOGS WHERE product_code=?',[created.data.codeHash.slice(2)]);
  assert(Number(scanRows[0].count)===1,'TC-03 chưa lưu scan log');
  pass('TC-03 quét lần đầu trả thẻ xanh và ghi log');

  const second=await post('/api/verify',{codeHash:created.data.codeHash,location:{latitude:10.7769,longitude:106.7009}});
  assert(second.status===200 && second.data.card==='red' && second.data.scanCount>1,'TC-04 lượt trùng không cảnh báo đỏ');
  const anomalyRows=await query('SELECT COUNT(*) AS count FROM SCAN_LOGS WHERE product_code=? AND anomaly_flag=1',[created.data.codeHash.slice(2)]);
  assert(Number(anomalyRows[0].count)>=1,'TC-04 thiếu anomaly_flag');
  pass('TC-04 quét lặp trả thẻ đỏ và đánh dấu bất thường');

  const fake='0x'+crypto.createHash('sha256').update('not-registered-'+Date.now()).digest('hex');
  const invalid=await post('/api/verify',{codeHash:fake});
  assert(invalid.status===404 && invalid.data.valid===false && invalid.data.card==='red','TC-05 mã giả không bị từ chối đúng');
  pass('TC-05 mã không có trên chain bị từ chối');

  const oldOwner=chain[4];
  const expired=await post('/api/ownership/handshake',{codeHash:created.data.codeHash,newOwner:accounts[1],ttlSeconds:2});
  assert(expired.status===201,'TC-06 không tạo được phiên hết hạn');
  await wait(2300);
  const late=await post(`/api/ownership/handshake/${expired.data.token}/confirm`,{party:'seller',participantToken:expired.data.sellerToken});
  assert(late.status===410,'TC-06 phiên hết hạn không trả HTTP 410');
  chain=await getCode(created.data.codeHash);
  assert(chain[4].toLowerCase()===oldOwner.toLowerCase(),'TC-06 owner đã đổi sau khi hết hạn');
  pass('TC-06 phiên hết hạn bị hủy, owner giữ nguyên (TTL rút gọn 2 giây)');

  const live=await post('/api/ownership/handshake',{codeHash:created.data.codeHash,newOwner:accounts[1],ttlSeconds:600});
  assert(live.status===201,'Không tạo được phiên handshake hợp lệ');
  const seller=await post(`/api/ownership/handshake/${live.data.token}/confirm`,{party:'seller',participantToken:live.data.sellerToken});
  assert(seller.status===200 && seller.data.status==='awaiting_confirmations','Seller confirmation sai');
  const buyer=await post(`/api/ownership/handshake/${live.data.token}/confirm`,{party:'buyer',participantToken:live.data.buyerToken});
  assert(buyer.status===200 && buyer.data.status==='completed','Buyer confirmation chưa hoàn tất bàn giao');
  chain=await getCode(created.data.codeHash);
  assert(chain[4].toLowerCase()===accounts[1].toLowerCase(),'Handshake hoàn tất nhưng owner không đổi');
  const history=await query('SELECT COUNT(*) AS count FROM OWNERSHIP_LOGS WHERE product_code=?',[created.data.codeHash.slice(2)]);
  assert(Number(history[0].count)>=2,'Thiếu ownership history trong MySQL');
  pass('Handshake hợp lệ: hai bên xác nhận, owner và lịch sử được cập nhật');
  console.log(`Acceptance complete. Fixture: ${created.data.codeHash}`);
}

main().catch(error=>{console.error('Acceptance failed:',error.message);process.exitCode=1;}).finally(()=>db.end());
