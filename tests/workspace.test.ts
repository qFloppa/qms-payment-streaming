import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEther } from "viem";
import type { Address } from "viem";
import type { StreamRow } from "../src/lib/domain.ts";
import {
  summarizeStreams,
  parsePayoutCsv,
  parsePaymentRequest,
  buildRequestUrl,
  validateLabel,
} from "../src/lib/workspace.ts";

const me: Address = "0x1111111111111111111111111111111111111111";
const other: Address = "0x2222222222222222222222222222222222222222";
const base: StreamRow = {
  id: 1n,
  sender: other,
  recipient: me,
  deposit: parseEther("100"),
  withdrawn: parseEther("20"),
  refunded: 0n,
  startTime: 0n,
  endTime: 100n,
  cancelledAt: 0n,
};

test("portfolio totals include every stream and retain cancelled claims without double-counting self cash flow", () => {
  const streams = [
    base,
    { ...base, id: 2n, sender: me, recipient: other, withdrawn: 0n },
    { ...base, id: 3n, sender: me, withdrawn: 0n },
    { ...base, id: 4n, cancelledAt: 40n, refunded: parseEther("60") },
  ];
  const summary = summarizeStreams(streams, me, 50n);
  assert.equal(summary.available, parseEther("100")); // 30 + 50 self + 20 cancelled
  assert.equal(summary.incoming, parseEther("50"));
  assert.equal(summary.outgoing, parseEther("50"));
  assert.equal(summary.active, 3);
  assert.equal(summary.forecast[0].incoming, parseEther("50"));
  assert.equal(summary.forecast[0].outgoing, parseEther("50"));
  assert.equal(summary.forecast[1].incoming, 0n);
  assert.equal(
    summarizeStreams(
      Array.from({ length: 121 }, (_, id) => ({ ...base, id: BigInt(id) })),
      me,
      50n,
    ).available,
    parseEther("3630"),
  );
});

test("forecast computes separate daily release buckets and clamps the final day", () => {
  const summary = summarizeStreams(
    [{ ...base, deposit: parseEther("300"), withdrawn: 0n, endTime: 259200n }],
    me,
    43200n,
  );
  assert.deepEqual(
    summary.forecast.map((day) => day.incoming),
    [parseEther("100"), parseEther("100"), parseEther("50"), 0n, 0n, 0n, 0n],
  );
});

test("CSV preserves quoted names and exact wei amounts while rejecting malformed or oversized payouts", () => {
  const rows = parsePayoutCsv(
    `recipient,amount,name\r\n${other},0.000000000000000001,"Design, November"\r\n${me},2,"A ""quoted"" name"\r\n`,
  );
  assert.deepEqual(rows, [
    {
      recipient: other,
      amount: "0.000000000000000001",
      label: "Design, November",
    },
    { recipient: me, amount: "2", label: 'A "quoted" name' },
  ]);
  for (const text of [
    "bad,headers",
    `recipient,amount,name\n${other},-1,Test`,
    `recipient,amount,name\n${other},1,"Unclosed`,
    `recipient,amount,name\n${other},1,"ok"bad`,
    `recipient,amount,name\n${Array(26).fill(`${other},1,Test`).join("\n")}`,
  ])
    assert.throws(() => parsePayoutCsv(text));
});

test("request links round-trip exact terms and discard unrelated base URL parameters", () => {
  const request = {
    recipient: other,
    amount: "1.000000000000000001",
    duration: 604800,
    label: "Design & development",
  };
  const url = new URL(
    buildRequestUrl(
      "https://rill.example/?old=value#/activity",
      request,
      19480,
      me,
    ),
  );
  assert.equal(url.searchParams.get("contract"), me);
  assert.equal(url.searchParams.has("old"), false);
  assert.deepEqual(
    parsePaymentRequest(new URLSearchParams(url.hash.split("?")[1])),
    { ...request, chainId: 19480 },
  );
  for (const suffix of ["&amount=2", "&duration=1", "&network=1"])
    assert.throws(() =>
      parsePaymentRequest(new URLSearchParams(url.hash.split("?")[1] + suffix)),
    );
  assert.throws(() =>
    parsePaymentRequest(
      new URLSearchParams(
        `request=1&recipient=${other}&amount=0&duration=60&network=19480`,
      ),
    ),
  );
  assert.equal(parsePaymentRequest(new URLSearchParams()), undefined);
});

test("names use the contract's UTF-8 byte limit", () => {
  assert.equal(validateLabel("é".repeat(40)), "é".repeat(40));
  assert.throws(() => validateLabel("é".repeat(41)));
});
