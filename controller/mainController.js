const { getTokensTransferred } = require("../api/transaction.api");
const { getAmountsOut, getRefund } = require("../api/token.api");
const calcUSD = require("../api/tokenprice.api");

let profitUnit = "";
let profitToken = "";
let addedFee = 0;
let response;

const test = async (req, res) => {

	//get transaction hash
	const hash = req.params.hash;
	response = {};
	addedFee = 0;
	let { tokensTransferred, gasUsed, gasPrice, contract } = await getTokensTransferred(hash);
	if (!tokensTransferred) {
		res.status(401).json({
			error: "Invalid transaction hash!"
		});
		return;
	}

	//calculate the profit of the original contract
	let previousProfit = toBNB(calcProfit(tokensTransferred, contract));
	response.profitByTokenOriginalTransaction = previousProfit + profitUnit;

	//emulate the swaps in the current time
	tokensTransferred = await currentSwaps(tokensTransferred);

	if(tokensTransferred.error) {
		res.status(401).json(tokensTransferred);
		return;
	}

	if (tokensTransferred.length !== 0 && previousProfit !== 0) {

		//calculate the current price of token
		let tokenPrice = await calcUSD(profitToken);
		const flashloanExist = await calcRefund(tokensTransferred, contract);

		if(flashloanExist.error) {
			res.status(401).json(flashloanExist);
			return;
		}

		let absoluteProfit = toBNB(calcProfit(tokensTransferred, contract, "current")) - addedFee / tokenPrice;

		if (flashloanExist) {
			response.inputAmountByToken = 0 + profitUnit;
			response.outAmountByTokenOriginalTransaction = previousProfit + profitUnit;
			response.outAmountByTokenNewTransaction = absoluteProfit + profitUnit;
		}

		response.profitByTokenNewTransaction = absoluteProfit + profitUnit;
		response.profitByBUSDOriginalTransaction = `${tokenPrice * previousProfit} US$`;
		response.profitByBUSDNewTransaction = `${tokenPrice * absoluteProfit} US$`;
		response.tokenPrice = `${tokenPrice} US$`;
	}

	//gas estimation	
	response.gasFee = `${toBNB(gasUsed * gasPrice)} BNB`;
	response.gasPrice = `${toBNB(gasPrice).toFixed(10)} BNB`;
	response.gasUsed = gasUsed.toString();
	res.json(response);
}

const calcProfit = (tokensTransferred, contract, time = "previous") => {
	const filtered = filterTransaction(tokensTransferred);
	if (filtered.length === 0) return 0;
	let inputTrans = filtered.filter(transferred => transferred.receiver === contract).pop();
	let amountIn = inputTrans?.amount;
	let outputTrans = filtered.filter(transferred => transferred.sender === contract).shift();
	let amountOut = outputTrans?.amount;
	if (!amountIn | !amountOut) return 0;
	if (time === "previous") {
		response.inputAmountByToken = toBNB(amountOut) + ` ${outputTrans.symbol}`;
		response.outAmountByTokenOriginalTransaction = toBNB(amountIn) + ` ${inputTrans.symbol}`;
	} else {
		response.outAmountByTokenNewTransaction = toBNB(amountIn) + ` ${inputTrans.symbol}`;
	}
	profitUnit = ` ${outputTrans.symbol}`;
	profitToken = outputTrans.token;
	return amountIn.sub(amountOut);
}

const filterTransaction = (transferred) => {
	transferred.forEach((transfer) => {
		let count = transferred.filter(trans => {
			if (trans === 0) return false;
			return trans.amount.eq(transfer.amount);
		}).length;
		if (count > 1) {
			transferred = transferred.map(trans => {
				if (trans === 0 || trans.amount.eq(transfer.amount)) {
					return 0;
				} else {
					return trans;
				}
			})
		}
	});
	return transferred.filter(transfer => transfer !== 0);
}

const currentSwaps = async (tokensTransferred) => {
	//get amount outs while testing
	let swaps = [];
	for (let i = 0; i < tokensTransferred.length - 1; i++) {
		let amountOut = await getAmountsOut(tokensTransferred, i);
		if(amountOut.error) return amountOut;
		if (tokensTransferred.filter(trans => trans.amount.eq(tokensTransferred[i + 1].amount)).length < 2) {
			tokensTransferred[i + 1].amount = amountOut;
		}
		swaps.push(amountOut);
	}
	return tokensTransferred;
}

const toBNB = (value) => {
	return value / 10 ** 18;
}

const calcRefund = async (tokensTransferred, contract) => {
	let receivers = tokensTransferred.map(transfer => transfer.receiver);
	let assetTransfer = tokensTransferred.filter((transfer, index) => {
		let rightIndex = receivers.indexOf(transfer.sender);
		if (rightIndex > index && transfer.sender !== contract) return true;
		return false;
	});
	for (let transfer of assetTransfer) {
		let paybackTransfer = tokensTransferred.find(trans => (
			trans.receiver === transfer.sender
		));
		let refund = await getRefund(transfer, paybackTransfer);
		if(refund.error) return refund;
		addedFee += toBNB(refund.sub(paybackTransfer.amount)) * await calcUSD(paybackTransfer.token);
	}
	return assetTransfer.length !== 0;
}

module.exports = {
	test
};