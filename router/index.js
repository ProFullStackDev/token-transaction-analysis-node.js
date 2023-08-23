const { ethers } = require("ethers");
const address = require("./address");
const abi = require("./abi");

let router = {};
for (let swap in address) {
    router[swap] = new ethers.Contract(address[swap], abi[swap], global.provider);
}

module.exports = router;