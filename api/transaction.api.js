const { ethers, BigNumber } = require("ethers");
const tokenAbi = require("../abi/token/tokenAbi.json");
const RPC_ADDRESS = require("../config").RPC_ADDRESS;

global.provider = new ethers.providers.JsonRpcProvider(RPC_ADDRESS);

const parseAddress = (address) => {
  //40bytes long => 24bytes are filled with zeros
  return "0x" + address.substr(26);
};

const getTokenSymbol = async (address) => {
  const tokenContract = new ethers.Contract(address, tokenAbi, global.provider);
  return await tokenContract.symbol();
};

const parsePrices = (data) => {
  data = data.replace("0x", "");
  let input = removeZeros(data.substr(0, 128));
  let output = removeZeros(data.substr(128));
  return [input, output];
};

const removeZeros = (data) => {
  return data.replace(/0{10,}/, "").replace(/0{10,}/, "");
};

const filterTransaction = (transferred) => {
  let senders = transferred.map((transfer) => transfer.sender);
  return transferred.filter((transfer) => {
    if (senders.indexOf(transfer.receiver) !== -1) return true;
    else return false;
  });
};

const getTokensTransferred = async (hash) => {
  let transaction;
  try {
    transaction = await global.provider.getTransactionReceipt(hash);
  } catch {
    return {
      tokensTransferred: null,
      transactionFee: null,
      contract: null,
    };
  }
  let transferred = [];
  for (let i = 0; i < transaction.logs.length; i++) {
    let log = transaction.logs[i];
    if (log.topics.length === 3) {
      try {
        var symbol = await getTokenSymbol(log.address);
      } catch {
        continue;
      }
      let nextLog = transaction.logs[i + 1];
      if (
        nextLog &&
        log.topics[1] === nextLog.topics[1] &&
        log.topics[2] === nextLog.topics[2]
      )
        i++;
      transferred.push({
        sender: parseAddress(log.topics[1]),
        receiver: parseAddress(log.topics[2]),
        token: log.address,
        amount: BigNumber.from(log.data),
        symbol: symbol,
      });
    }
    if (log.topics.length === 1) i++;
  }
  transferred = filterTransaction(transferred);
  return {
    tokensTransferred: transferred,
    gasUsed: transaction.gasUsed,
    gasPrice: transaction.effectiveGasPrice,
    contract: transaction.to.toLowerCase(),
  };
};

const getSwaps = async (hash) => {
  const transaction = await global.provider.getTransactionReceipt(hash);
  let swaps = [];
  for (let i = 0; i < transaction.logs.length; i++) {
    if (transaction.logs[i].topics.length === 1) {
      let log = transaction.logs[i + 1];
      swaps.push([
        parseAddress(log.topics[1]),
        parseAddress(log.topics[2]),
        parsePrices(log.data),
      ]);
      i++;
    }
  }
  return swaps;
};

module.exports = {
  getTokensTransferred,
  getSwaps,
};
