import { createPublicClient, defineChain, http } from "viem";
const env = import.meta.env;
const local = env.VITE_LOCAL_DEVELOPMENT === "true";
const rpc = local ? env.VITE_RPC_URL : "https://rpc.testnet.qms.finance";
if (
  local &&
  (!rpc || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(rpc).hostname))
)
  throw new Error("Local development requires a loopback RPC URL.");
const chainId = local ? Number(env.VITE_CHAIN_ID ?? 31337) : 19480;
if (!Number.isSafeInteger(chainId) || chainId < 1)
  throw new Error("Invalid chain ID.");
export const chain = defineChain({
  id: chainId,
  name: local ? "Rill local development" : "QMS Testnet",
  nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  ...(local
    ? {}
    : {
        blockExplorers: {
          default: { name: "QMSScan", url: "https://testnet.qmsscan.io" },
        },
      }),
});
export const client = createPublicClient({
  chain,
  transport: http(rpc, { timeout: 10000, retryCount: 1 }),
  pollingInterval: local ? 500 : 4000,
  cacheTime: 0,
});
export const faucetUrl = "https://faucet.testnet.qms.finance";
export const explorerUrl = (type: "tx" | "address", value: string) =>
  chain.blockExplorers
    ? `${chain.blockExplorers.default.url}/${type}/${value}`
    : undefined;
