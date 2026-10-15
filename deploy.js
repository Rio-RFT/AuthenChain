require('dotenv').config();
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

// 1. Kết nối với Ganache (cổng 7545)
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545'));

function deploy() {
    console.log(`Đang kiểm tra kết nối Ganache (${process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545'})...`);
    
    web3.eth.getAccounts((err, accounts) => {
        if (err || !accounts || accounts.length === 0) {
            console.error('\nLỖI KẾT NỐI GANACHE: Không thể kết nối tới http://127.0.0.1:7545 hoặc không tìm thấy tài khoản.');
            console.error('-> Hãy chắc chắn ứng dụng Ganache đang mở và cấu hình PORT là 7545.');
            process.exit(1);
        }
        
        console.log('Đã kết nối Ganache thành công!');
        console.log(`Deploy bằng tài khoản: ${accounts[0]}`);

        // 2. Đọc file ABI và Bytecode
        const abiPath = path.join(__dirname, 'build', 'contracts_authentifi_sol_Authentifi.abi');
        const binPath = path.join(__dirname, 'build', 'contracts_authentifi_sol_Authentifi.bin');

        if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
            console.error('\nLỖI: Chưa có file biên dịch trong thư mục build/.');
            console.error('Vui lòng chạy lệnh: npm run compile');
            process.exit(1);
        }

        const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        const bytecode = '0x' + fs.readFileSync(binPath, 'utf8').trim();

        console.log('Đang gửi giao dịch deploy Authentifi Smart Contract lên Ganache...');

        const AuthentifiContract = web3.eth.contract(abi);

        AuthentifiContract.new({
            from: accounts[0],
            data: bytecode,
            gas: 5000000
        }, (err, contractInstance) => {
            if (err) {
                console.error('\nLỖI khi gửi giao dịch deploy:', err);
                process.exit(1);
            }

            const txHash = contractInstance.transactionHash;
            if (!txHash) {
                console.error('Không nhận được Transaction Hash từ Ganache.');
                process.exit(1);
            }

            console.log(`Giao dịch đã được gửi! TxHash: ${txHash}`);
            console.log('Đang chờ Ganache xác nhận và lấy địa chỉ hợp đồng...');

            // Polling lấy Transaction Receipt
            let attempts = 0;
            const maxAttempts = 30;

            const pollReceipt = setInterval(() => {
                attempts++;
                web3.eth.getTransactionReceipt(txHash, (receiptErr, receipt) => {
                    if (receipt && receipt.contractAddress) {
                        clearInterval(pollReceipt);
                        const deployedAddress = receipt.contractAddress;

                        console.log(`\n======================================================`);
                        console.log(`>>> DEPLOY THÀNH CÔNG! <<<`);
                        console.log(`Địa chỉ Smart Contract: ${deployedAddress}`);
                        console.log(`Block số: ${receipt.blockNumber}`);
                        console.log(`Gas đã dùng: ${receipt.gasUsed}`);
                        console.log(`======================================================\n`);

                        // Keep deployment configuration separate from application source.
                        fs.writeFileSync(path.join(__dirname, 'contract-address.json'), JSON.stringify({ address: deployedAddress, network: 'ganache' }, null, 2) + '\n', 'utf8');
                        console.log(`[OK] Đã lưu địa chỉ hợp đồng vào contract-address.json`);
                        console.log(`[OK] Bây giờ bạn có thể khởi động server bằng lệnh:\n     node server.js\n`);
                        process.exit(0);
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(pollReceipt);
                        console.error('Quá thời gian chờ (Timeout) khi đợi Ganache tạo hợp đồng.');
                        process.exit(1);
                    }
                });
            }, 1000);
        });
    });
}

deploy();
