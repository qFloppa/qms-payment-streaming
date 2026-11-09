import { isAddress } from "viem";
import type { Address, Hash } from "viem";
import { sameAddress } from "./domain.ts";
export type Action = "create" | "withdraw" | "cancel" | "deploy";
export type Pending = {
  hash: Hash;
  chainId: number;
  contract: Address;
  wallet: Address;
  action: Action;
  submittedAt: number;
  streamId?: string;
  intentChanged?: boolean;
};
export class SubmissionGate {
  private busy = false;
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy)
      throw new Error("A transaction is already awaiting your wallet.");
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }
}
export function assertWalletContext(
  wallet: string,
  chainId: number,
  accounts: readonly string[],
  currentChain: string,
) {
  if (!sameAddress(accounts[0], wallet) || Number(currentChain) !== chainId)
    throw new Error(
      "Your wallet or network changed. Review this action again.",
    );
}
export function parsePending(raw: string | null): Pending[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is Pending =>
        item &&
        /^0x[0-9a-f]{64}$/i.test(item.hash) &&
        isAddress(item.contract) &&
        isAddress(item.wallet) &&
        Number.isSafeInteger(item.chainId) &&
        item.chainId > 0 &&
        ["create", "withdraw", "cancel", "deploy"].includes(item.action) &&
        Number.isFinite(item.submittedAt) &&
        (item.streamId === undefined || /^\d+$/.test(item.streamId)),
    );
  } catch {
    return [];
  }
}
export function receiptState(receipt?: {
  status: string;
}): "pending" | "failed" | "confirmed" {
  return !receipt
    ? "pending"
    : receipt.status === "success"
      ? "confirmed"
      : "failed";
}
export function friendlyError(error: unknown): string {
  let current = error as
    { code?: number; message?: string; cause?: unknown } | undefined;
  for (
    let i = 0;
    current && i < 8;
    i++, current = current.cause as typeof current
  ) {
    if (
      current.code === 4001 ||
      /user rejected|user denied/i.test(current.message ?? "")
    )
      return "Signature declined. Your payment details are still here. Try again when you’re ready.";
    if (/insufficient funds/i.test(current.message ?? ""))
      return "Not enough QMS for this payment and the network fee. Get test QMS from the faucet, then try again.";
  }
  // Do not render arbitrary RPC or wallet HTML/details, endpoints, or payloads.
  return error instanceof Error &&
    !(error as { shortMessage?: string }).shortMessage
    ? error.message.slice(0, 240)
    : "The request could not be completed. Check your wallet and network, then try again.";
}
