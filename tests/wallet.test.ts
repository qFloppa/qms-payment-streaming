import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SubmissionGate,
  assertWalletContext,
  parsePending,
  receiptState,
} from "../src/lib/transactions.ts";
const wallet = "0x1111111111111111111111111111111111111111";
test("account and network changes invalidate reviewed transactions before sending", () => {
  assert.doesNotThrow(() =>
    assertWalletContext(wallet, 19480, [wallet], "0x4c18"),
  );
  assert.throws(() => assertWalletContext(wallet, 19480, [], "0x4c18"));
  assert.throws(() =>
    assertWalletContext(
      wallet,
      19480,
      ["0x2222222222222222222222222222222222222222"],
      "0x4c18",
    ),
  );
  assert.throws(() => assertWalletContext(wallet, 19480, [wallet], "0x1"));
});
test("signature rejection releases the submission lock for a deliberate retry", async () => {
  const gate = new SubmissionGate();
  await assert.rejects(
    gate.run(async () => {
      throw Object.assign(new Error("rejected"), { code: 4001 });
    }),
  );
  assert.equal(await gate.run(async () => "retry"), "retry");
});
test("duplicate submissions cannot send while a wallet decision is outstanding", async () => {
  const gate = new SubmissionGate();
  let finish!: () => void;
  const first = gate.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await assert.rejects(gate.run(async () => "duplicate"));
  finish();
  await first;
});
test("pending metadata survives reload, malformed data is ignored, timeouts remain pending", () => {
  const pending = {
    hash: `0x${"a".repeat(64)}`,
    chainId: 19480,
    contract: wallet,
    wallet,
    action: "create",
    submittedAt: 10,
  };
  assert.deepEqual(parsePending(JSON.stringify([pending])), [pending]);
  assert.deepEqual(parsePending('[{"hash":"broken"}]'), []);
  assert.deepEqual(parsePending("bad json"), []);
  assert.equal(receiptState(undefined), "pending");
  assert.equal(receiptState({ status: "reverted" }), "failed");
  assert.equal(receiptState({ status: "success" }), "confirmed");
});

test("batch recovery retains its exact calldata and rejects incomplete batch records", () => {
  const item = {
    hash: `0x${"b".repeat(64)}`,
    chainId: 19480,
    contract: wallet,
    wallet,
    action: "batch",
    submittedAt: 1,
    data: "0x12345678",
    value: "3000000000000000000",
    count: 2,
  };
  assert.deepEqual(parsePending(JSON.stringify([item])), [item]);
  for (const corrupt of [
    { ...item, count: 0 },
    { ...item, count: 26 },
    { ...item, data: undefined },
    { ...item, value: undefined },
    { ...item, data: "0x12broken" },
  ])
    assert.deepEqual(parsePending(JSON.stringify([corrupt])), []);
});
