pragma solidity ^0.4.25;

/** AuthentiFi product registry. Product identifiers are SHA-256 digests. */
contract Authentifi {
    struct codeObj {
        bytes32 code;
        bool isVerified;
        uint256 scanCount;
        uint256 activationTime;
        address currentOwner;
    }

    address public owner;
    mapping(bytes32 => codeObj) private codeArr;
    event CodeCreated(bytes32 indexed codeHash, address indexed owner);
    event ProductActivated(bytes32 indexed codeHash, uint256 activationTime);
    event ProductScanned(bytes32 indexed codeHash, uint256 scanCount, address indexed scanner);
    event OwnerChanged(bytes32 indexed codeHash, address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner); _; }

    constructor() public { owner = msg.sender; }

    function createCode(bytes32 _codeHash) public onlyOwner {
        require(_codeHash != bytes32(0));
        require(codeArr[_codeHash].code == bytes32(0));
        codeArr[_codeHash] = codeObj(_codeHash, false, 0, 0, msg.sender);
        emit CodeCreated(_codeHash, msg.sender);
    }

    function activateProduct(bytes32 _codeHash) public onlyOwner {
        require(codeArr[_codeHash].code != bytes32(0));
        require(!codeArr[_codeHash].isVerified);
        codeArr[_codeHash].isVerified = true;
        codeArr[_codeHash].activationTime = now;
        emit ProductActivated(_codeHash, now);
    }

    function verifyProduct(bytes32 _codeHash) public returns (uint256) {
        require(codeArr[_codeHash].code != bytes32(0));
        require(codeArr[_codeHash].isVerified);
        codeArr[_codeHash].scanCount += 1;
        emit ProductScanned(_codeHash, codeArr[_codeHash].scanCount, msg.sender);
        return codeArr[_codeHash].scanCount;
    }

    function changeOwner(bytes32 _codeHash, address _newOwner) public onlyOwner {
        require(codeArr[_codeHash].code != bytes32(0));
        require(codeArr[_codeHash].isVerified);
        require(_newOwner != address(0));
        address previousOwner = codeArr[_codeHash].currentOwner;
        codeArr[_codeHash].currentOwner = _newOwner;
        emit OwnerChanged(_codeHash, previousOwner, _newOwner);
    }

    function getCode(bytes32 _codeHash) public view returns (bytes32, bool, uint256, uint256, address) {
        codeObj storage product = codeArr[_codeHash];
        return (product.code, product.isVerified, product.scanCount, product.activationTime, product.currentOwner);
    }
}
