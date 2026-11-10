import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, encodeFunctionData, http } from "viem";
import type { Address } from "viem";
import { rillAbi } from "../../src/contracts/rill";

let config: {
  rpcUrl: string;
  contract: Address;
  accounts: Address[];
  snapshot: string;
};
const rpc = (method: string, params: unknown[] = []) =>
  fetch(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }).then(async (response) => {
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  });
test.beforeAll(async () => {
  config = JSON.parse(await readFile("/tmp/qms-qa/runtime.json", "utf8"));
});
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  config = JSON.parse(await readFile("/tmp/qms-qa/runtime.json", "utf8"));
  await rpc("evm_revert", [config.snapshot]);
  config.snapshot = await rpc("evm_snapshot");
  await writeFile("/tmp/qms-qa/runtime.json", JSON.stringify(config));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});
async function injectWallet(page: Page) {
  await page.exposeFunction(
    "rillTestRpc",
    ({ method, params }: { method: string; params?: unknown[] }) =>
      rpc(method, params),
  );
  await page.addInitScript(
    ({ account }) => {
      const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
      const state = {
        account,
        chain: "0x7a69",
        reject: false,
        connected: sessionStorage.getItem("rill-test-permission") === "yes",
      };
      const provider = {
        async request({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) {
          if (method === "eth_requestAccounts") {
            state.connected = true;
            sessionStorage.setItem("rill-test-permission", "yes");
            return [state.account];
          }
          if (method === "eth_accounts")
            return state.connected ? [state.account] : [];
          if (method === "eth_chainId") return state.chain;
          if (
            method === "wallet_switchEthereumChain" ||
            method === "wallet_addEthereumChain"
          ) {
            state.chain = "0x7a69";
            listeners.chainChanged?.forEach((fn) => fn(state.chain));
            return null;
          }
          if (method === "eth_sendTransaction" && state.reject) {
            state.reject = false;
            throw Object.assign(new Error("User rejected the request"), {
              code: 4001,
            });
          }
          return (window as any).rillTestRpc({ method, params });
        },
        on(event: string, fn: (...args: unknown[]) => void) {
          (listeners[event] ??= []).push(fn);
        },
        removeListener(event: string, fn: (...args: unknown[]) => void) {
          listeners[event] = listeners[event]?.filter((item) => item !== fn);
        },
      };
      (window as any).testWallet = {
        state,
        emit(event: string) {
          listeners[event]?.forEach((fn) => fn());
        },
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "rill-test",
                name: "Local test wallet",
                rdns: "test.rill",
              },
              provider,
            },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
    },
    { account: config.accounts[0] },
  );
}
async function connect(page: Page) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Local test wallet" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function trial(page: Page) {
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await page
    .getByRole("link", { name: "Try a 1-minute stream", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/streams\/1$/);
}

test("a contributor request preserves exact terms through review, funding, and refresh", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/#/request");
  await connect(page);
  await page.getByLabel("Recipient wallet").fill(config.accounts[1]);
  await page.getByLabel("Stream name").fill("November design retainer");
  await page.getByLabel("Requested amount").fill("1.000000000000000001");
  await page
    .getByRole("button", { name: "Create request link", exact: true })
    .click();
  const link = await page.getByLabel("Payment request link").inputValue();
  await page.screenshot({
    path: "/tmp/qms-qa/request-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/qms-qa/request-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(link);
  await expect(page.getByLabel("Total payment")).toHaveValue(
    "1.000000000000000001",
  );
  await expect(page.getByLabel("Stream name")).toHaveValue(
    "November design retainer",
  );
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "November design retainer",
  );
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/streams\/1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "November design retainer",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "November design retainer",
  );
});

test("CSV batch funds independent contributors, populates the dashboard, and permits a recipient withdrawal", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/#/batch");
  await connect(page);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV contents")
    .fill(
      `recipient,amount,name\n${config.accounts[1]},1,Design\n${config.accounts[2]},2,Development`,
    );
  await page
    .getByRole("button", { name: "Use these recipients", exact: true })
    .click();
  await page.getByLabel("Payout duration").selectOption("60");
  await page.screenshot({
    path: "/tmp/qms-qa/batch-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/qms-qa/batch-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Review 2 payouts", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("3.00000");
  await expect(page.getByRole("dialog")).toContainText("Development");
  await page.screenshot({
    path: "/tmp/qms-qa/batch-review.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/streams$/);
  await expect(
    page.getByRole("link").filter({ hasText: "Development" }),
  ).toBeVisible();
  await page.goto("/#/");
  await expect(page.getByTestId("outgoing-total")).toContainText("3.00000");
  await page.screenshot({
    path: "/tmp/qms-qa/workspace-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/qms-qa/workspace-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const stream = await client.readContract({
    address: config.contract,
    abi: rillAbi,
    functionName: "getStream",
    args: [1n],
  });
  await rpc("evm_setNextBlockTimestamp", [Number(stream.startTime + 30n)]);
  await rpc("evm_mine");
  await page.evaluate((account) => {
    (window as any).testWallet.state.account = account;
    (window as any).testWallet.emit("accountsChanged");
  }, config.accounts[1]);
  await page.goto("/#/streams/1");
  await expect(page.getByTestId("available")).toContainText("0.50000");
  await page.getByRole("button", { name: "Withdraw QMS", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByText("Withdrawal confirmed.", { exact: false }),
  ).toBeVisible();
  expect(
    (
      await client.readContract({
        address: config.contract,
        abi: rillAbi,
        functionName: "getStream",
        args: [1n],
      })
    ).withdrawn,
  ).toBe(500000000000000000n);
});

test("contacts persist for their wallet and can populate a new named stream", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/#/contacts");
  await connect(page);
  await page.getByLabel("Contact name").fill("Alex · Design");
  await page.getByLabel("Wallet address").fill(config.accounts[1]);
  await page.getByRole("button", { name: "Save contact", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Alex · Design", { exact: true })).toBeVisible();
  await page.goto("/#/create");
  await page.getByLabel("Saved recipient").selectOption(config.accounts[1]);
  await expect(page.getByLabel("Recipient", { exact: true })).toHaveValue(
    config.accounts[1],
  );
  await page.evaluate((account) => {
    (window as any).testWallet.state.account = account;
    (window as any).testWallet.emit("accountsChanged");
  }, config.accounts[2]);
  await page.goto("/#/contacts");
  await expect(page.getByText("Alex · Design", { exact: true })).toHaveCount(0);
});

test("changing the connected recipient invalidates a previously generated request link", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/#/request");
  await connect(page);
  await page.getByLabel("Requested amount").fill("1");
  await page
    .getByRole("button", { name: "Create request link", exact: true })
    .click();
  await expect(page.getByLabel("Payment request link")).toBeVisible();
  await page.evaluate((account) => {
    (window as any).testWallet.state.account = account;
    (window as any).testWallet.emit("accountsChanged");
  }, config.accounts[1]);
  await expect(page.getByLabel("Recipient wallet")).toHaveValue(
    new RegExp(config.accounts[1], "i"),
  );
  await expect(page.getByLabel("Payment request link")).toHaveCount(0);
});

test("a pending batch survives refresh and confirms all streams only after mining", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/#/batch");
  await connect(page);
  await page
    .getByLabel("Wallet address", { exact: true })
    .nth(0)
    .fill(config.accounts[1]);
  await page
    .getByLabel("Wallet address", { exact: true })
    .nth(1)
    .fill(config.accounts[2]);
  await page.getByLabel("Amount · QMS", { exact: true }).nth(0).fill("1");
  await page.getByLabel("Amount · QMS", { exact: true }).nth(1).fill("2");
  await page
    .getByRole("button", { name: "Review 2 payouts", exact: true })
    .click();
  await rpc("evm_setAutomine", [false]);
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByText("Transaction submitted.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Transaction pending.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("2 streams created.", { exact: false }),
  ).toHaveCount(0);
  await rpc("evm_mine");
  await rpc("evm_setAutomine", [true]);
  await expect(page).toHaveURL(/#\/streams$/);
  await expect(
    page.getByText("2 streams created.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".stream-row")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rill:v1:pending") ?? "[]").length,
    ),
  ).toBe(0);
});

test("wallet totals and incoming filters include streams beyond the first hundred", async ({
  page,
}) => {
  for (let batch = 0; batch < 4; batch++) {
    const hash = await rpc("eth_sendTransaction", [
      {
        from: config.accounts[0],
        to: config.contract,
        gas: "0xb71b00",
        value: "0x15af1d78b58c40000",
        data: encodeFunctionData({
          abi: rillAbi,
          functionName: "createStreams",
          args: [
            Array.from({ length: 25 }, () => ({
              recipient: config.accounts[1],
              amount: 1000000000000000000n,
              duration: 60n,
              label: "",
            })),
          ],
        }),
      },
    ]);
    await expect
      .poll(
        async () => (await rpc("eth_getTransactionReceipt", [hash]))?.status,
      )
      .toBe("0x1");
  }
  const hash = await rpc("eth_sendTransaction", [
    {
      from: config.accounts[1],
      to: config.contract,
      gas: "0x7a120",
      value: "0xde0b6b3a7640000",
      data: encodeFunctionData({
        abi: rillAbi,
        functionName: "createNamedStream",
        args: [config.accounts[0], 60n, "Beyond the first page"],
      }),
    },
  ]);
  await expect
    .poll(async () => (await rpc("eth_getTransactionReceipt", [hash]))?.status)
    .toBe("0x1");
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await expect(page.getByTestId("outgoing-total")).toContainText("100.00000");
  await expect(
    page.getByText("101 total payment records", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/streams?filter=Incoming");
  await expect(page.locator(".stream-row")).toHaveCount(1);
  await expect(page.locator(".stream-row")).toContainText(
    "Beyond the first page",
  );
  await page.goto("/#/streams?filter=Outgoing");
  for (let index = 0; index < 4; index++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("Page 5 · 100 streams", { exact: true }),
  ).toBeVisible();
  await page.evaluate((account) => {
    (window as any).testWallet.state.account = account;
    (window as any).testWallet.emit("accountsChanged");
  }, config.accounts[1]);
  await expect(
    page.getByText("Page 1 · 1 streams", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stream-row")).toHaveCount(1);
});

test("the original V1 runtime remains usable while V2-only features explain setup", async ({
  page,
}) => {
  const legacy = JSON.parse(
    await readFile("tests/fixtures/rill-v1.json", "utf8"),
  );
  const hash = await rpc("eth_sendTransaction", [
    { from: config.accounts[0], data: legacy.bytecode, gas: "0x4c4b40" },
  ]);
  await expect
    .poll(async () => (await rpc("eth_getTransactionReceipt", [hash]))?.status)
    .toBe("0x1");
  const receipt = await rpc("eth_getTransactionReceipt", [hash]);
  expect(receipt.status).toBe("0x1");
  await injectWallet(page);
  await page.goto(`/?contract=${receipt.contractAddress}#/create?trial=1`);
  await connect(page);
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/streams\/1$/);
  await expect(
    page.getByRole("heading", { name: "Your first minute", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "/batch";
  });
  await expect(
    page.getByText("This deployment supports individual streams.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review 2 payouts", exact: true }),
  ).toBeDisabled();
});
test("approved first visit and missing-wallet flow render on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Rill — Payment streams");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A payment.A little at a time.",
  );
  await page.screenshot({
    path: "/tmp/qms-qa/first-visit.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(
    page.getByText("No browser wallet found.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/qms-qa/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  expect(errors).toEqual([]);
});
test("real trial accrues, withdraws, refreshes, and completes with onchain receipts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await trial(page);
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const stream = await client.readContract({
    address: config.contract,
    abi: rillAbi,
    functionName: "getStream",
    args: [1n],
  });
  await rpc("evm_setNextBlockTimestamp", [Number(stream.startTime + 15n)]);
  await rpc("evm_mine");
  await expect(page.getByTestId("available")).toContainText("0.25000");
  await page.getByRole("button", { name: "Withdraw QMS" }).click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByText("Withdrawal confirmed.", { exact: false }),
  ).toBeVisible();
  await rpc("evm_setNextBlockTimestamp", [Number(stream.startTime + 45n)]);
  await rpc("evm_mine");
  await expect(page.getByTestId("available")).toContainText("0.50000");
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.screenshot({
    path: "/tmp/qms-qa/active-stream.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/qms-qa/active-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.reload();
  await expect(page.getByTestId("available")).toContainText("0.50000");
  await rpc("evm_setNextBlockTimestamp", [Number(stream.endTime)]);
  await rpc("evm_mine");
  await expect(
    page.getByText("Fully unlocked", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Withdraw QMS" }).click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  const final = await client.readContract({
    address: config.contract,
    abi: rillAbi,
    functionName: "getStream",
    args: [1n],
  });
  expect(final.withdrawn).toBe(1000000000000000000n);
  expect(await client.getBalance({ address: config.contract })).toBe(0n);
  expect(errors).toEqual([]);
});
test("signature rejection preserves the form and permits an explicit retry", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await page.goto("/#/create?trial=1");
  await page.screenshot({
    path: "/tmp/qms-qa/create-stream.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/qms-qa/create-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: "/tmp/qms-qa/review-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => {
    (window as any).testWallet.state.reject = true;
  });
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Signature declined.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Total payment")).toHaveValue("1.00");
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/streams\/1$/);
});
test("wrong networks can be switched and insufficient funds lead to the faucet", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await page.evaluate(() => {
    (window as any).testWallet.state.chain = "0x1";
    (window as any).testWallet.emit("chainChanged");
  });
  await page
    .getByRole("button", { name: "Switch network", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Switch network", exact: true }),
  ).toHaveCount(0);
  await rpc("anvil_setBalance", [config.accounts[0], "0x0"]);
  await page.goto("/#/create?trial=1");
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await expect(
    page.getByText("Not enough QMS", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get test QMS", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open faucet" })).toHaveAttribute(
    "href",
    "https://faucet.testnet.qms.finance",
  );
});
test("cancellation preserves the recipient entitlement and removes further accrual", async ({
  page,
}) => {
  await trial(page);
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const original = await client.readContract({
    address: config.contract,
    abi: rillAbi,
    functionName: "getStream",
    args: [1n],
  });
  await rpc("evm_setNextBlockTimestamp", [Number(original.startTime + 30n)]);
  await rpc("evm_mine");
  await expect(page.getByTestId("available")).toContainText("0.50000");
  await page
    .getByRole("button", { name: "Cancel stream", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm cancellation", exact: true })
    .click();
  await expect(page.locator(".stream-status")).toHaveText("Cancelled");
  await page.getByRole("button", { name: "Withdraw QMS" }).click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByText("Withdrawal confirmed.", { exact: false }),
  ).toBeVisible();
  const final = await client.readContract({
    address: config.contract,
    abi: rillAbi,
    functionName: "getStream",
    args: [1n],
  });
  expect(final.refunded + final.withdrawn).toBe(1000000000000000000n);
});

test("a submitted transaction survives refresh and confirms only when mined", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await page.goto("/#/create?trial=1");
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await rpc("evm_setAutomine", [false]);
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByText("Transaction submitted.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rill:v1:pending") ?? "[]").length,
    ),
  ).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Transaction pending.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Stream created.", { exact: false })).toHaveCount(
    0,
  );
  await rpc("evm_mine");
  await rpc("evm_setAutomine", [true]);
  await expect(page).toHaveURL(/#\/streams\/1$/);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rill:v1:pending") ?? "[]").length,
    ),
  ).toBe(0);
});

test("switching accounts invalidates a prepared review and never sends it", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await page.goto("/#/create?trial=1");
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate((account) => {
    (window as any).testWallet.state.account = account;
    (window as any).testWallet.emit("accountsChanged");
  }, config.accounts[1]);
  await expect(
    page.getByRole("button", { name: "Confirm in wallet", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Your wallet changed.", { exact: false }),
  ).toBeVisible();
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  expect(
    await client.readContract({
      address: config.contract,
      abi: rillAbi,
      functionName: "streamCount",
      args: [config.accounts[0]],
    }),
  ).toBe(0n);
});

test("a recovered wallet cancellation is never reported as a created stream", async ({
  page,
}) => {
  const hash = await rpc("eth_sendTransaction", [
    {
      from: config.accounts[0],
      to: config.accounts[0],
      value: "0x0",
      gas: "0x5208",
    },
  ]);
  await injectWallet(page);
  await page.goto("/");
  await connect(page);
  await page.evaluate(
    ({ hash, contract, wallet }) => {
      localStorage.setItem(
        "rill:v1:pending",
        JSON.stringify([
          {
            hash,
            contract,
            wallet,
            chainId: 31337,
            action: "create",
            submittedAt: Date.now(),
            intentChanged: true,
          },
        ]),
      );
    },
    { hash, contract: config.contract, wallet: config.accounts[0] },
  );
  await page.reload();
  await expect(
    page.getByText("The transaction reverted or was cancelled", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("Stream created.", { exact: false })).toHaveCount(
    0,
  );
});

test("unverified contracts are rejected and wallet deployment produces a verified share link", async ({
  page,
}) => {
  await injectWallet(page);
  await page.goto(`/?contract=${config.accounts[2]}#/create?trial=1`);
  await connect(page);
  await page
    .getByRole("button", { name: "Use my wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review stream", exact: true })
    .click();
  await expect(
    page
      .getByText("This address is not a verified Rill contract", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?contract=#/setup");
  await page
    .getByRole("button", { name: "Review deployment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rill is ready." }),
  ).toBeVisible();
  const share = await page
    .getByRole("link", { name: "Open Rill", exact: true })
    .getAttribute("href");
  expect(new URL(share!).searchParams.get("contract")).toMatch(
    /^0x[0-9a-fA-F]{40}$/,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Rill is ready." }),
  ).toBeVisible();
});

test("a self stream is listed once and activity links return to its detail", async ({
  page,
}) => {
  await trial(page);
  await page.goto("/#/streams");
  await expect(page.locator(".stream-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Incoming", exact: true }).click();
  await expect(page.locator(".stream-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Outgoing", exact: true }).click();
  await expect(page.locator(".stream-row")).toHaveCount(1);
  await page.goto("/#/activity");
  await page.getByRole("link", { name: "Stream funded", exact: true }).click();
  await expect(page).toHaveURL(/#\/streams\/1$/);
});
test("loading older activity retains history while new blocks add new payments", async ({
  page,
}) => {
  await trial(page);
  await rpc("anvil_mine", ["0x7d1"]);
  await page.goto("/#/activity");
  await page
    .getByRole("button", { name: "Load earlier activity", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Stream funded", exact: true }),
  ).toHaveCount(1);
  await rpc("eth_sendTransaction", [
    {
      from: config.accounts[0],
      to: config.contract,
      value: "0xde0b6b3a7640000",
      gas: "0x7a120",
      data: encodeFunctionData({
        abi: rillAbi,
        functionName: "createStream",
        args: [config.accounts[0], 60n],
      }),
    },
  ]);
  await expect(
    page.getByRole("link", { name: "Stream funded", exact: true }),
  ).toHaveCount(2);
});
