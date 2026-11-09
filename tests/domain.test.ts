import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAmount,
  formatAmount,
  formatRate,
  accounting,
  validateStream,
} from "../src/lib/domain.ts";
const sender = "0x1111111111111111111111111111111111111111";
const data = {
  sender,
  recipient: sender,
  deposit: 1000000000000000000n,
  withdrawn: 250000000000000000n,
  refunded: 0n,
  startTime: 100n,
  endTime: 160n,
  cancelledAt: 0n,
} as const;
test("amounts preserve wei precision and reject ambiguous or excess decimal input", () => {
  assert.equal(parseAmount("1.000000000000000007"), 1000000000000000007n);
  assert.equal(parseAmount("0.000000000000000001"), 1n);
  for (const value of [
    "0",
    "-1",
    "1e3",
    "1,000",
    "1.0000000000000000001",
    "",
    ".",
    "Infinity",
  ])
    assert.throws(() => parseAmount(value));
  assert.equal(formatAmount(500000000000000000n), "0.50000");
  assert.equal(formatAmount(7n), "0.000000000000000007");
});
test("confirmed accounting excludes withdrawals, clamps completion, and retains cancelled entitlement", () => {
  assert.deepEqual(accounting(data, 145n), {
    unlocked: 750000000000000000n,
    available: 500000000000000000n,
    scheduled: 250000000000000000n,
  });
  assert.deepEqual(accounting({ ...data, withdrawn: 0n }, 99n), {
    unlocked: 0n,
    available: 0n,
    scheduled: 1000000000000000000n,
  });
  assert.deepEqual(accounting({ ...data, deposit: 7n, withdrawn: 0n }, 160n), {
    unlocked: 7n,
    available: 7n,
    scheduled: 0n,
  });
  assert.deepEqual(
    accounting(
      { ...data, cancelledAt: 145n, refunded: 250000000000000000n },
      200n,
    ),
    {
      unlocked: 750000000000000000n,
      available: 500000000000000000n,
      scheduled: 0n,
    },
  );
});
test("validation rejects zero recipients and durations outside the contract range", () => {
  assert.deepEqual(validateStream(sender, "1", 60), {});
  assert.ok(
    validateStream("0x0000000000000000000000000000000000000000", "1", 60)
      .recipient,
  );
  assert.ok(validateStream("broken", "0", 59).amount);
  assert.ok(validateStream(sender, "1", 31536001).duration);
  assert.ok(validateStream(sender, "1", 60.5).duration);
});
test("approximate rates round independently from spendable balances and handle tiny payments", () => {
  assert.equal(formatRate(1000000000000000000n, 60), "0.01667");
  assert.equal(formatRate(7n, 60), "< 0.00001");
  assert.equal(formatRate(1n, Infinity), "—");
});
