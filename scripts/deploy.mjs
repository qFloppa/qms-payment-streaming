import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

class DeploymentError extends Error {}
const fail = (message) => {
  throw new DeploymentError(message);
};

try {
  const rpcUrl = process.env.RILL_RPC_URL ?? "https://rpc.testnet.qms.finance";
  let url;
  try {
    url = new URL(rpcUrl);
  } catch {
    fail("RILL_RPC_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(url.protocol))
    fail("RILL_RPC_URL must use HTTP(S).");
  const allowLocal = process.env.RILL_ALLOW_LOCAL_CHAIN === "true";
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (allowLocal && !loopback)
    fail("Local development requires a loopback RPC URL.");
  const transport = http(rpcUrl, { retryCount: 0, timeout: 15000 });
  const probe = createPublicClient({ transport });
  const chainId = await probe.getChainId();
  if (chainId !== 19480 && !allowLocal)
    fail(`Unexpected chain ID ${chainId}; expected QMS Testnet 19480.`);
  if (!Number.isSafeInteger(chainId) || chainId < 1)
    fail("RPC returned an invalid chain ID.");
  const chain = defineChain({
    id: chainId,
    name: chainId === 19480 ? "QMS Testnet" : "Rill local development",
    nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  let account;
  if (process.env.RILL_PRIVATE_KEY) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.RILL_PRIVATE_KEY))
      fail("RILL_PRIVATE_KEY must be a valid 32-byte hex key.");
    try {
      account = privateKeyToAccount(process.env.RILL_PRIVATE_KEY);
    } catch {
      fail("RILL_PRIVATE_KEY is invalid.");
    }
  } else if (allowLocal && process.env.RILL_LOCAL_ACCOUNT) {
    if (!isAddress(process.env.RILL_LOCAL_ACCOUNT))
      fail("RILL_LOCAL_ACCOUNT must be a valid address.");
    account = process.env.RILL_LOCAL_ACCOUNT;
  } else {
    fail(
      "Set RILL_PRIVATE_KEY in your local environment, or use an explicit local unlocked account.",
    );
  }
  const artifact = JSON.parse(
    await readFile(
      new URL("../contracts/artifacts/RillStream.json", import.meta.url),
      "utf8",
    ),
  );
  const client = createPublicClient({
    chain,
    transport,
    pollingInterval: allowLocal ? 50 : 2000,
  });
  const wallet = createWalletClient({ account, chain, transport });
  // Recheck the network immediately before sending a signed transaction.
  if ((await client.getChainId()) !== chainId)
    fail("The RPC chain changed before deployment.");
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 180000 });
  } catch {
    fail(
      `Deployment confirmation pending or unavailable. Retain transaction hash ${hash} and check its receipt before retrying.`,
    );
  }
  if (receipt.status !== "success" || !receipt.contractAddress)
    fail(`Deployment reverted: ${hash}`);
  const code = await client.getBytecode({ address: receipt.contractAddress });
  if (!code || keccak256(code) !== artifact.runtimeHash)
    fail(`Deployment runtime verification failed: ${hash}`);
  console.log(
    JSON.stringify(
      {
        chainId,
        address: receipt.contractAddress,
        transactionHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        runtimeHash: artifact.runtimeHash,
      },
      null,
      2,
    ),
  );
} catch (error) {
  // Third-party RPC errors can include URL credentials and signing input.
  console.error(
    error instanceof DeploymentError
      ? error.message
      : "Deployment failed. Check the RPC, account balance, and local configuration; sensitive error details were omitted.",
  );
  process.exitCode = 1;
}
