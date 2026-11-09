import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createWalletClient, http } from "viem";
import { startLocalChain } from "./local-chain.mjs";
import { createServer } from "vite";
const local = await startLocalChain();
try {
  const accounts = await local.client.request({ method: "eth_accounts" });
  await local.client.request({
    method: "anvil_setBlockTimestampInterval",
    params: [0],
  });
  const wallet = createWalletClient({
    account: accounts[0],
    chain: local.chain,
    transport: http(local.rpcUrl),
  });
  const artifact = JSON.parse(
    await readFile(
      new URL("../contracts/artifacts/RillStream.json", import.meta.url),
      "utf8",
    ),
  );
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });
  const receipt = await local.client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress || receipt.status !== "success")
    throw new Error("Local deployment failed");
  process.env.VITE_LOCAL_DEVELOPMENT = "true";
  process.env.VITE_RPC_URL = local.rpcUrl;
  process.env.VITE_CHAIN_ID = String(local.chain.id);
  process.env.VITE_STREAM_CONTRACT_ADDRESS = receipt.contractAddress;
  await mkdir("/tmp/qms-qa", { recursive: true });
  const snapshot = await local.client.request({ method: "evm_snapshot" });
  await writeFile(
    "/tmp/qms-qa/runtime.json",
    JSON.stringify({
      rpcUrl: local.rpcUrl,
      contract: receipt.contractAddress,
      accounts,
      snapshot,
    }),
  );
  const vite = await createServer({
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  });
  await vite.listen();
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await vite.close();
      await local.stop();
      process.exit(0);
    });
} catch (error) {
  await local.stop();
  throw error;
}
