import { isAddress, keccak256 } from "viem";
import type { Address, Hash } from "viem";
import { client, chain } from "./config";
import { rillAbi, rillRuntimeHash } from "../contracts/rill";
import { sameAddress } from "./domain";
import type { StreamRow } from "./domain";

export async function verifyContract(
  address: string,
  blockNumber?: bigint,
): Promise<Address> {
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
  if (!code || keccak256(code) !== rillRuntimeHash)
    throw new Error(
      "This address is not a verified Rill contract on this network.",
    );
  return address;
}
export async function readStream(
  address: Address,
  id: bigint,
  blockNumber: bigint,
): Promise<StreamRow> {
  const stream = await client.readContract({
    address,
    abi: rillAbi,
    functionName: "getStream",
    args: [id],
    blockNumber,
  });
  return { ...stream, id };
}
export type Snapshot = {
  blockNumber: bigint;
  timestamp: bigint;
  balance?: bigint;
  streams: StreamRow[];
  count: bigint;
  detail?: StreamRow;
  verified?: Address;
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
  const address = await verifyContract(contract, block.number);
  const [count, indexed, detail] = await Promise.all([
    wallet
      ? client.readContract({
          address,
          abi: rillAbi,
          functionName: "streamCount",
          args: [wallet],
          blockNumber: block.number,
        })
      : 0n,
    wallet
      ? client.readContract({
          address,
          abi: rillAbi,
          functionName: "streamsFor",
          args: [wallet, BigInt(page * 20), 20n],
          blockNumber: block.number,
        })
      : ([[], 0n] as const),
    id !== undefined ? readStream(address, id, block.number) : undefined,
  ]);
  const streams: StreamRow[] = [];
  const ids = [...new Set(indexed[0])];
  for (let i = 0; i < ids.length; i += 5)
    streams.push(
      ...(await Promise.all(
        ids.slice(i, i + 5).map((id) => readStream(address, id, block.number)),
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
