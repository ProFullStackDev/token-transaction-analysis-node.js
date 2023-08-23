const {
	RPC_ADDRESS,
	PANSWAP_ADDRESS,
	BNB_ADDRESS,
	USDT_ADDRESS
} = require("../config");

const Web3 = require('web3');
const web3 = new Web3(RPC_ADDRESS);

const PANSWAP_CONTRACT = PANSWAP_ADDRESS.toLowerCase();
const pancakeSwapAbi = require("../abi/router/pancakeRouterAbi.json");
const tokenAbi = require("../abi/token/tokenAbi.json");

async function calcSell(tokensToSell, tokenAddres) {
	const BNBTokenAddress = BNB_ADDRESS;
	const tokenRouter = await new web3.eth.Contract(tokenAbi, tokenAddres);
	const tokenDecimals = await tokenRouter.methods.decimals().call();
	tokensToSell = setDecimals(tokensToSell, tokenDecimals);
	let amountOut;
	try {
		let router = await new web3.eth.Contract(pancakeSwapAbi, PANSWAP_CONTRACT);
		amountOut = await router.methods.getAmountsOut(tokensToSell, [tokenAddres, BNBTokenAddress]).call();
		amountOut = web3.utils.fromWei(amountOut[1]);
	} catch (error) {
		return;
	}
	if (!amountOut) return 0;
	return amountOut;
}

async function calcBNBPrice() {
	let bnbToSell = web3.utils.toWei("1", "ether");
	let amountOut;
	try {
		let router = await new web3.eth.Contract(pancakeSwapAbi, PANSWAP_CONTRACT);
		amountOut = await router.methods.getAmountsOut(bnbToSell, [BNB_ADDRESS, USDT_ADDRESS]).call();
		amountOut = web3.utils.fromWei(amountOut[1]);
	} catch (error) { }
	if (!amountOut) return 0;
	return amountOut;
}

function setDecimals(number, decimals) {
	number = number.toString();
	let numberAbs = number.split('.')[0]
	let numberDecimals = number.split('.')[1] ? number.split('.')[1] : '';
	while (numberDecimals.length < decimals) {
		numberDecimals += "0";
	}
	return numberAbs + numberDecimals;
}

async function calcUSD(address = "BNB") {
	// query pancakeswap to get the price of BNB in USDT
	let bnbPrice = await calcBNBPrice()
	if (address === "BNB") return bnbPrice;
	// Them amount of tokens to sell. adjust this value based on you need, you can encounter errors with high supply tokens when this value is 1.
	let tokens_to_sell = 1;
	let priceInBnb = await calcSell(tokens_to_sell, address) / tokens_to_sell; // calculate TOKEN price in BNB
	return (priceInBnb ? priceInBnb : 1) * bnbPrice;
}

module.exports = calcUSD;