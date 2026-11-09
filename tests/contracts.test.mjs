import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  http,
  keccak256,
  parseEther,
  toHex,
  zeroAddress,
} from "viem";
import { startLocalChain } from "../scripts/local-chain.mjs";

const artifact = JSON.parse(
  await readFile(
    new URL("../contracts/artifacts/RillStream.json", import.meta.url),
    "utf8",
  ),
);
const receiverArtifacts = Object.fromEntries(
  await Promise.all(
    ["RejectingReceiver", "ReentrantReceiver"].map(async (name) => [
      name,
      JSON.parse(
        await readFile(
          new URL(`../contracts/artifacts/${name}.json`, import.meta.url),
          "utf8",
        ),
      ),
    ]),
  ),
);
let local, client, wallets, address, snapshot;
const unit = parseEther("1");
const read = (functionName, args = []) =>
  client.readContract({ address, abi: artifact.abi, functionName, args });
const stream = (id = 1n) => read("getStream", [id]);
const balances = (id = 1n) => read("balances", [id]);

async function transaction(
  wallet,
  contract,
  abi,
  functionName,
  args = [],
  value = 0n,
  success = true,
) {
  const hash = await wallet.writeContract({
    address: contract,
    abi,
    functionName,
    args,
    value,
    gas: 3_000_000n,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(
    receipt.status,
    success ? "success" : "reverted",
    `${functionName} transaction status`,
  );
  return receipt;
}
const send = (wallet, functionName, args = [], value = 0n, success = true) =>
  transaction(
    wallet,
    address,
    artifact.abi,
    functionName,
    args,
    value,
    success,
  );

async function deploy(compiled) {
  const hash = await wallets[0].deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode,
    gas: 5_000_000n,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  assert.ok(receipt.contractAddress);
  return receipt.contractAddress;
}

async function create({
  sender = wallets[0],
  recipient = wallets[1].account.address,
  amount = unit,
  duration = 60n,
} = {}) {
  const receipt = await send(
    sender,
    "createStream",
    [recipient, duration],
    amount,
  );
  const event = receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({ abi: artifact.abi, ...log });
      } catch {
        return null;
      }
    })
    .find((log) => log?.eventName === "StreamCreated");
  assert.ok(event, "creation event identifies the stream");
  return {
    id: event.args.streamId,
    receipt,
    data: await stream(event.args.streamId),
  };
}

async function at(timestamp) {
  await client.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(timestamp)],
  });
  await client.request({ method: "evm_mine" });
}
async function nextAt(timestamp) {
  await client.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(timestamp)],
  });
}

async function conserved(id = 1n) {
  const data = await stream(id);
  const [unlocked, available, scheduled] = await balances(id);
  assert.equal(
    data.deposit,
    data.withdrawn + available + scheduled + data.refunded,
    "deposit is conserved",
  );
  assert.equal(
    unlocked,
    data.withdrawn + available,
    "available excludes prior withdrawals",
  );
}

before(async () => {
  local = await startLocalChain();
  client = local.client;
  const accounts = await client.request({ method: "eth_accounts" });
  wallets = accounts
    .slice(0, 3)
    .map((account) =>
      createWalletClient({
        account,
        chain: local.chain,
        transport: http(local.rpcUrl),
      }),
    );
  address = await deploy(artifact);
});
beforeEach(async () => {
  if (snapshot)
    await client.request({ method: "evm_revert", params: [snapshot] });
  snapshot = await client.request({ method: "evm_snapshot" });
});
after(async () => {
  await local?.stop();
});

// Catches accidental runtime drift that would disable the app's contract verification.
test("deployed runtime matches the exported compiled identity", async () => {
  assert.equal(
    keccak256(await client.getBytecode({ address })),
    artifact.runtimeHash,
  );
});

// Catches incorrect slopes, inclusion of prior withdrawals, and wall-clock calculations.
test("a one-QMS minute unlocks 0.75 QMS at second 45 after a 0.25-QMS withdrawal", async () => {
  const { data } = await create();
  assert.deepEqual(await balances(), [0n, 0n, unit]);
  await nextAt(data.startTime + 15n);
  const receipt = await send(wallets[1], "withdraw", [1n]);
  const withdrawal = decodeEventLog({ abi: artifact.abi, ...receipt.logs[0] });
  assert.equal(withdrawal.eventName, "Withdrawal");
  assert.equal(withdrawal.args.amount, 250000000000000000n);
  await at(data.startTime + 45n);
  assert.deepEqual(await balances(), [
    750000000000000000n,
    500000000000000000n,
    250000000000000000n,
  ]);
  await conserved();
});

// Catches rounding dust trapped forever after the final timestamp.
test("a seven-wei deposit pays all seven at completion and nothing twice", async () => {
  const { data } = await create({ amount: 7n });
  await nextAt(data.endTime);
  await send(wallets[1], "withdraw", [1n]);
  assert.equal((await stream()).withdrawn, 7n);
  assert.deepEqual(await balances(), [7n, 0n, 0n]);
  await send(wallets[1], "withdraw", [1n], 0n, false);
  await conserved();
});

test("only the recipient may withdraw even when all funds have unlocked", async () => {
  const { data } = await create();
  await at(data.endTime);
  await send(wallets[0], "withdraw", [1n], 0n, false);
  await send(wallets[2], "withdraw", [1n], 0n, false);
  assert.equal((await stream()).withdrawn, 0n);
  await send(wallets[1], "withdraw", [1n]);
  await conserved();
});

test("only the sender may cancel", async () => {
  await create();
  await send(wallets[1], "cancel", [1n], 0n, false);
  await send(wallets[2], "cancel", [1n], 0n, false);
  assert.equal((await stream()).cancelledAt, 0n);
});

// Catches refunding vested money, continued accrual, and withholding recipient funds.
test("cancellation freezes accrual and refunds only scheduled funds", async () => {
  const { data } = await create();
  await nextAt(data.startTime + 15n);
  await send(wallets[1], "withdraw", [1n]);
  const senderBefore = await client.getBalance({
    address: wallets[0].account.address,
  });
  await nextAt(data.startTime + 45n);
  const cancelled = await send(wallets[0], "cancel", [1n]);
  const event = decodeEventLog({ abi: artifact.abi, ...cancelled.logs[0] });
  assert.equal(event.eventName, "StreamCancelled");
  assert.equal(event.args.refund, 250000000000000000n);
  const senderAfter = await client.getBalance({
    address: wallets[0].account.address,
  });
  assert.equal(
    senderAfter -
      senderBefore +
      cancelled.gasUsed * cancelled.effectiveGasPrice,
    250000000000000000n,
  );
  assert.deepEqual(await balances(), [
    750000000000000000n,
    500000000000000000n,
    0n,
  ]);
  await at(data.endTime + 1000n);
  assert.deepEqual(await balances(), [
    750000000000000000n,
    500000000000000000n,
    0n,
  ]);
  await send(wallets[1], "withdraw", [1n]);
  const final = await stream();
  assert.equal(final.withdrawn, 750000000000000000n);
  assert.equal(final.refunded, 250000000000000000n);
  assert.equal(await client.getBalance({ address }), 0n);
  await conserved();
});

test("completed streams cannot be cancelled", async () => {
  const { data } = await create();
  await nextAt(data.endTime);
  await send(wallets[0], "cancel", [1n], 0n, false);
  assert.equal((await stream()).refunded, 0n);
});

test("cancelled streams cannot refund a second time", async () => {
  await create();
  await send(wallets[0], "cancel", [1n]);
  const refunded = (await stream()).refunded;
  await send(wallets[0], "cancel", [1n], 0n, false);
  assert.equal((await stream()).refunded, refunded);
  await conserved();
});

test("recipient, deposit, and both duration bounds are validated on chain", async () => {
  await send(wallets[0], "createStream", [zeroAddress, 60n], unit, false);
  await send(
    wallets[0],
    "createStream",
    [wallets[1].account.address, 60n],
    0n,
    false,
  );
  for (const duration of [0n, 59n, 31536001n])
    await send(
      wallets[0],
      "createStream",
      [wallets[1].account.address, duration],
      unit,
      false,
    );
  assert.equal(await read("streamCount", [wallets[0].account.address]), 0n);
  assert.equal(
    (await create({ duration: 31536000n })).data.endTime -
      (await stream()).startTime,
    31536000n,
  );
});

test("nonexistent stream views and actions reject instead of acting on empty storage", async () => {
  await assert.rejects(stream(0n));
  await assert.rejects(balances(1n));
  await send(wallets[0], "withdraw", [1n], 0n, false);
  await send(wallets[0], "cancel", [1n], 0n, false);
});

test("self-directed streams are indexed once and IDs start at one", async () => {
  const created = await create({ recipient: wallets[0].account.address });
  assert.equal(created.id, 1n);
  assert.equal(await read("streamCount", [wallets[0].account.address]), 1n);
  assert.deepEqual(
    await read("streamsFor", [wallets[0].account.address, 0n, 100n]),
    [[1n], 1n],
  );
});

test("wallet pages preserve unique IDs, cursor progress, empty results, and the 100-item bound", async () => {
  await create();
  await create({ recipient: wallets[0].account.address });
  await create({ sender: wallets[1], recipient: wallets[0].account.address });
  assert.equal(await read("streamCount", [wallets[0].account.address]), 3n);
  assert.equal(await read("streamCount", [wallets[1].account.address]), 2n);
  assert.deepEqual(
    await read("streamsFor", [wallets[0].account.address, 0n, 2n]),
    [[1n, 2n], 2n],
  );
  assert.deepEqual(
    await read("streamsFor", [wallets[0].account.address, 2n, 2n]),
    [[3n], 3n],
  );
  assert.deepEqual(
    await read("streamsFor", [wallets[0].account.address, 100n, 100n]),
    [[], 3n],
  );
  assert.deepEqual(
    await read("streamsFor", [wallets[2].account.address, 0n, 1n]),
    [[], 0n],
  );
  await assert.rejects(
    read("streamsFor", [wallets[0].account.address, 0n, 0n]),
  );
  await assert.rejects(
    read("streamsFor", [wallets[0].account.address, 0n, 101n]),
  );
});

test("rejecting recipient transfers revert accounting and remain recoverable", async () => {
  const compiled = receiverArtifacts.RejectingReceiver;
  const receiver = await deploy(compiled);
  const { data } = await create({ recipient: receiver });
  await nextAt(data.endTime);
  await transaction(
    wallets[0],
    receiver,
    compiled.abi,
    "claim",
    [address, 1n],
    0n,
    false,
  );
  assert.equal((await stream()).withdrawn, 0n);
  assert.deepEqual(await balances(), [unit, unit, 0n]);
  await transaction(wallets[0], receiver, compiled.abi, "setReject", [false]);
  await transaction(wallets[0], receiver, compiled.abi, "claim", [address, 1n]);
  assert.equal(await client.getBalance({ address: receiver }), unit);
  await conserved();
});

test("rejecting sender refunds revert cancellation and leave the scheduled entitlement intact", async () => {
  const compiled = receiverArtifacts.RejectingReceiver;
  const receiver = await deploy(compiled);
  await transaction(
    wallets[0],
    receiver,
    compiled.abi,
    "open",
    [address, wallets[1].account.address, 60n],
    unit,
  );
  const data = await stream();
  await nextAt(data.startTime + 30n);
  await transaction(
    wallets[0],
    receiver,
    compiled.abi,
    "close",
    [address, 1n],
    0n,
    false,
  );
  assert.equal((await stream()).cancelledAt, 0n);
  assert.equal((await stream()).refunded, 0n);
  assert.deepEqual(await balances(), [
    500000000000000000n,
    500000000000000000n,
    500000000000000000n,
  ]);
  await transaction(wallets[0], receiver, compiled.abi, "setReject", [false]);
  await transaction(wallets[0], receiver, compiled.abi, "close", [address, 1n]);
  await conserved();
});

// Catches removing the guard from any entry point, including stream creation.
test("a receiver cannot reenter withdrawal, cancellation, or creation during either transfer", async () => {
  const compiled = receiverArtifacts.ReentrantReceiver;
  const receiver = await deploy(compiled);
  await transaction(
    wallets[0],
    receiver,
    compiled.abi,
    "open",
    [address],
    unit,
  );
  const data = await stream();
  await nextAt(data.startTime + 15n);
  await transaction(wallets[0], receiver, compiled.abi, "claim");
  const probe = (name) =>
    client.readContract({
      address: receiver,
      abi: compiled.abi,
      functionName: name,
    });
  assert.equal(await probe("callbacks"), 1n);
  for (const name of [
    "withdrawReentered",
    "cancelReentered",
    "createReentered",
  ])
    assert.equal(await probe(name), false);
  assert.equal((await stream()).withdrawn, 250000000000000000n);
  assert.equal(await read("streamCount", [receiver]), 1n);
  await nextAt(data.startTime + 30n);
  await transaction(wallets[0], receiver, compiled.abi, "close");
  assert.equal(await probe("callbacks"), 2n);
  for (const name of [
    "withdrawReentered",
    "cancelReentered",
    "createReentered",
  ])
    assert.equal(await probe(name), false);
  assert.equal((await stream()).refunded, 500000000000000000n);
  await transaction(wallets[0], receiver, compiled.abi, "claim");
  assert.equal(await client.getBalance({ address: receiver }), unit);
  await conserved();
});

test("very large deposits accrue without multiplication overflow", async () => {
  const amount = 1n << 252n;
  const { data } = await create();
  // Anvil's transaction pool caps transaction cost at uint128. Seed only the
  // deposit and escrow balance for this extreme-value EVM fixture, then run
  // the actual deployed views and withdrawal transaction. amount * 45 > uint256.
  const base = BigInt(
    keccak256(
      encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [1n, 0n]),
    ),
  );
  await client.request({
    method: "anvil_setStorageAt",
    params: [
      address,
      toHex(base + 2n, { size: 32 }),
      toHex(amount, { size: 32 }),
    ],
  });
  await client.request({
    method: "anvil_setBalance",
    params: [address, toHex(amount)],
  });
  await at(data.startTime + 45n);
  assert.deepEqual(await balances(), [
    5427754182999196660479889922282245680622030531201901439349574250370927951872n,
    5427754182999196660479889922282245680622030531201901439349574250370927951872n,
    1809251394333065553493296640760748560207343510400633813116524750123642650624n,
  ]);
  await nextAt(data.endTime);
  await send(wallets[1], "withdraw", [1n]);
  assert.equal((await stream()).withdrawn, amount);
  await conserved();
});

function deployCli(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/deploy.mjs"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, RILL_PRIVATE_KEY: "", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, output }));
  });
}

test("deployment CLI refuses an unexpected chain before signing and redacts RPC credentials", async () => {
  const secretRpc = local.rpcUrl.replace(
    "http://",
    "http://do-not-log:rpc-secret@",
  );
  const result = await deployCli({
    RILL_RPC_URL: secretRpc,
    RILL_ALLOW_LOCAL_CHAIN: "false",
  });
  assert.equal(result.code, 1);
  assert.match(result.output, /Unexpected chain ID 31337/);
  assert.doesNotMatch(result.output, /do-not-log|rpc-secret/);
});

test("deployment CLI allows an explicit local unlocked account and verifies runtime after mining", async () => {
  const result = await deployCli({
    RILL_RPC_URL: local.rpcUrl,
    RILL_ALLOW_LOCAL_CHAIN: "true",
    RILL_LOCAL_ACCOUNT: wallets[0].account.address,
  });
  assert.equal(result.code, 0, result.output);
  const parsed = JSON.parse(result.output);
  assert.equal(parsed.chainId, 31337);
  assert.equal(parsed.runtimeHash, artifact.runtimeHash);
  assert.equal(
    keccak256(await client.getBytecode({ address: parsed.address })),
    artifact.runtimeHash,
  );
});
