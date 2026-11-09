import { isAddress, keccak256 } from "viem";
import type { Address, Hash } from "viem";
import { client, chain } from "./config";
import { rillAbi, rillRuntimeHash } from "../contracts/rill";
import { sameAddress } from "./domain";
import type { StreamRow } from "./domain";

export const legacyRuntimeHash =
  "0xf2c103e279572ac31806764e3b405b9e4c43651d3d4ac3356d818d0b21cc9b27";
export async function inspectContract(address: string, blockNumber?: bigint) {
  if (!isAddress(address))
    throw new Error("The configured stream contract address is invalid.");
  const [network, code] = await Promise.all([
    client.getChainId(),
    client.getBytecode({ address, blockNumber }),
  ]);
  if (network !== chain.id)
    throw new Error(
      "The RPC is on a different network. Transactions are disabled.",
    );
  const hash = code ? keccak256(code) : undefined;
  const version =
    hash === rillRuntimeHash ? 2 : hash === legacyRuntimeHash ? 1 : undefined;
  if (!version)
    throw new Error(
      "This address is not a verified Rill contract on this network.",
    );
  return { address, version };
}

export async function verifyContract(
  address: string,
  blockNumber?: bigint,
): Promise<Address> {
  return (await inspectContract(address, blockNumber)).address;
}
export async function readStream(
  address: Address,
  id: bigint,
  blockNumber: bigint,
  version = 1,
): Promise<StreamRow> {
  const stream = await client.readContract({
    address,
    abi: rillAbi,
    functionName: "getStream",
    args: [id],
    blockNumber,
  });
  const label =
    version === 2
      ? await client.readContract({
          address,
          abi: rillAbi,
          functionName: "streamLabel",
          args: [id],
          blockNumber,
        })
      : "";
  return { ...stream, id, label };
}
export type Snapshot = {
  blockNumber: bigint;
  timestamp: bigint;
  balance?: bigint;
  streams: StreamRow[];
  count: bigint;
  detail?: StreamRow;
  verified?: Address;
  version?: number;
};
export async function readSnapshot(
  contract: string,
  wallet?: Address,
  page = 0,
  id?: bigint,
): Promise<Snapshot> {
  const block = await client.getBlock();
  const balancePromise = wallet
    ? client.getBalance({ address: wallet, blockNumber: block.number })
    : undefined;
  const balance = await balancePromise;
  if (!contract)
    return {
      blockNumber: block.number,
      timestamp: block.timestamp,
      balance,
      streams: [],
      count: 0n,
    };
  const { address, version } = await inspectContract(contract, block.number);
  const [count, detail] = await Promise.all([
    wallet
      ? client.readContract({
          address,
          abi: rillAbi,
          functionName: "streamCount",
          args: [wallet],
          blockNumber: block.number,
        })
      : 0n,
    id !== undefined
      ? readStream(address, id, block.number, version)
      : undefined,
  ]);
  const indexed: bigint[] = [];
  if (wallet) {
    const size = page < 0 ? 100n : 20n;
    const start = page < 0 ? 0n : BigInt(page * 20);
    const end = page < 0 ? count : start + size;
    // Never use a single page as a wallet total. Every read is pinned to this block.
    for (let cursor = start; cursor < end; cursor += size) {
      const [ids] = await client.readContract({
        address,
        abi: rillAbi,
        functionName: "streamsFor",
        args: [wallet, cursor, size],
        blockNumber: block.number,
      });
      indexed.push(...ids);
    }
  }
  const streams: StreamRow[] = [];
  const ids = [...new Set(indexed)];
  for (let i = 0; i < ids.length; i += 5)
    streams.push(
      ...(await Promise.all(
        ids
          .slice(i, i + 5)
          .map((id) => readStream(address, id, block.number, version)),
      )),
    );
  return {
    blockNumber: block.number,
    timestamp: block.timestamp,
    balance,
    streams,
    count,
    detail,
    verified: address,
    version,
  };
}
export type ActivityEvent = {
  hash: Hash;
  index: number;
  blockNumber: bigint;
  name: string;
  amount: bigint;
  streamId: bigint;
};
export async function readEvents(
  address: Address,
  toBlock: bigint,
  wallet?: Address,
  id?: bigint,
) {
  const fromBlock = toBlock >= 1999n ? toBlock - 1999n : 0n;
  const logs = await client.getContractEvents({
    address,
    abi: rillAbi,
    fromBlock,
    toBlock,
    strict: true,
  });
  const candidates = logs.filter(
    (log) => id === undefined || log.args.streamId === id,
  );
  const ownership = new Map<bigint, boolean>();
  if (wallet && id === undefined) {
    const ids = [...new Set(candidates.map((log) => log.args.streamId))];
    for (let i = 0; i < ids.length; i += 5)
      await Promise.all(
        ids.slice(i, i + 5).map(async (streamId) => {
          const stream = await readStream(address, streamId, toBlock);
          ownership.set(
            streamId,
            sameAddress(wallet, stream.sender) ||
              sameAddress(wallet, stream.recipient),
          );
        }),
      );
  }
  const events: ActivityEvent[] = candidates
    .filter((log) => id !== undefined || ownership.get(log.args.streamId))
    .map((log) => ({
      hash: log.transactionHash,
      index: log.logIndex,
      blockNumber: log.blockNumber,
      name:
        log.eventName === "StreamCreated"
          ? "Stream funded"
          : log.eventName === "Withdrawal"
            ? "Withdrawal"
            : "Stream cancelled",
      amount:
        "deposit" in log.args
          ? log.args.deposit
          : "amount" in log.args
            ? log.args.amount
            : log.args.refund,
      streamId: log.args.streamId,
    }));
  events.sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? b.index - a.index
      : a.blockNumber > b.blockNumber
        ? -1
        : 1,
  );
  return { events, fromBlock };
}
