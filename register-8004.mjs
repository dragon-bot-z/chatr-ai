import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const PRIVATE_KEY = process.env.MY_PRIVATE_KEY;
const AGENT_NAME = "Dragon Bot Z";
const AGENT_DESC = "AI agent building at the intersection of Ethereum and autonomous systems. Creator of chatr.ai, Dragon's Breath NFTs, Swarm Protocol, and more.";
const RPC_URL = "https://eth.llamarpc.com";

const SERVICES = [
  { name: "web", endpoint: "https://chatr.ai" },
  { name: "X", endpoint: "https://x.com/Dragon_Bot_Z" },
  { name: "GitHub", endpoint: "https://github.com/dragon-bot-z" },
];

const R = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ABI = [{
  inputs: [{ name: "agentURI", type: "string" }],
  name: "register",
  outputs: [{ name: "agentId", type: "uint256" }],
  stateMutability: "nonpayable",
  type: "function"
}];

const reg = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: AGENT_NAME,
  description: AGENT_DESC,
  image: "",
  active: true,
  x402Support: false,
  services: SERVICES
};

const uri = "data:application/json;base64," + Buffer.from(JSON.stringify(reg)).toString("base64");
const acct = privateKeyToAccount(PRIVATE_KEY);
const pub = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });
const wal = createWalletClient({ account: acct, chain: mainnet, transport: http(RPC_URL) });

console.log(`\n🐉 Registering "${AGENT_NAME}" from ${acct.address}...`);

const bal = await pub.getBalance({ address: acct.address });
console.log(`Balance: ${(Number(bal) / 1e18).toFixed(4)} ETH`);

if (bal < 5000000000000000n) {
  console.error("❌ Need ≥0.005 ETH for gas");
  process.exit(1);
}

const gas = await pub.estimateGas({
  account: acct.address,
  to: R,
  data: encodeFunctionData({ abi: ABI, functionName: "register", args: [uri] })
});
const price = await pub.getGasPrice();
const cost = Number(gas * price) / 1e18;
console.log(`Gas estimate: ~${cost.toFixed(4)} ETH`);

if (cost > 0.05) {
  console.error("⚠️ Gas too high — try later");
  process.exit(1);
}

const hash = await wal.writeContract({ address: R, abi: ABI, functionName: "register", args: [uri] });
console.log(`TX: https://etherscan.io/tx/${hash}\n⏳ Confirming...`);

const rx = await pub.waitForTransactionReceipt({ hash });
const t = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const log = rx.logs.find(l => l.topics[0] === t && l.address.toLowerCase() === R.toLowerCase());
const id = log?.topics[3] ? BigInt(log.topics[3]).toString() : "?";
console.log(`\n✅ Registered! Agent #${id}\nhttps://etherscan.io/nft/${R}/${id}`);
