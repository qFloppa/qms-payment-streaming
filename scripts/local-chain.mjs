import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createPublicClient, defineChain, http } from "viem";

const require = createRequire(import.meta.url);

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

/** Starts only its own disposable process. Tests always use a fresh free port. */
export async function startLocalChain({ port = 0, chainId = 31337 } = {}) {
  port ||= await freePort();
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid local port.");
  if (!Number.isSafeInteger(chainId) || chainId < 1)
    throw new Error("Invalid local chain ID.");
  const binary = require.resolve(
    `@foundry-rs/anvil-${process.platform}-${process.arch === "x64" ? "amd64" : process.arch}/bin/anvil`,
  );
  const child = spawn(
    binary,
    [
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--chain-id",
      String(chainId),
      "--hardfork",
      "paris",
      "--silent",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  let failure;
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
  });
  child.once("error", (error) => {
    failure = error;
  });
  const rpcUrl = `http://127.0.0.1:${port}`;
  const chain = defineChain({
    id: chainId,
    name: "Rill local development",
    nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 0, timeout: 500 }),
    pollingInterval: 50,
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => {
      const timeout = setTimeout(() => child.kill("SIGKILL"), 2000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.kill("SIGTERM");
    });
  };
  process.once("exit", () => {
    if (!stopped) child.kill("SIGTERM");
  });
  const deadline = Date.now() + 10000;
  try {
    while (Date.now() < deadline) {
      if (failure || child.exitCode !== null)
        throw failure ?? new Error(`Anvil exited: ${stderr}`);
      try {
        if ((await client.getChainId()) === chainId)
          return { port, rpcUrl, chain, client, stop };
      } catch {
        /* The owned process is still starting. */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Anvil did not become ready: ${stderr}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const local = await startLocalChain({
    port: Number(process.env.RILL_LOCAL_PORT ?? 8545),
    chainId: Number(process.env.RILL_LOCAL_CHAIN_ID ?? 31337),
  });
  console.log(`Local development chain ${local.chain.id}: ${local.rpcUrl}`);
  console.log("Disposable Anvil accounts only. Stop with Ctrl+C.");
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await local.stop();
      process.exit(0);
    });
}
