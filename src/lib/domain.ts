import {
  formatUnits,
  isAddress,
  maxUint256,
  parseUnits,
  zeroAddress,
} from "viem";
import type { Address } from "viem";

export type Stream = {
  sender: Address;
  recipient: Address;
  deposit: bigint;
  withdrawn: bigint;
  refunded: bigint;
  startTime: bigint;
  endTime: bigint;
  cancelledAt: bigint;
};
export type StreamRow = Stream & { id: bigint; label?: string };
export function parseAmount(value: string): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(value.trim()))
    throw new Error("Enter a positive QMS amount with up to 18 decimals.");
  const result = parseUnits(value.trim(), 18);
  if (result <= 0n || result > maxUint256)
    throw new Error("Enter a positive amount within the supported range.");
  return result;
}
// Truncate, never round up a spendable value. Reveal sub-display-unit dust.
export function formatAmount(value: bigint, digits = 5): string {
  const exact = formatUnits(value, 18);
  if (value !== 0n && value < 10n ** BigInt(18 - digits)) return exact;
  const [whole, fraction = ""] = exact.split(".");
  return `${whole}.${fraction.padEnd(digits, "0").slice(0, digits)}`;
}
export function formatRate(value: bigint, duration: number): string {
  if (!Number.isSafeInteger(duration) || duration < 60 || duration > 31536000)
    return "—";
  const unit = BigInt(duration) * 10000000000000n;
  if (value > 0n && value < unit) return "< 0.00001";
  return formatAmount(((value + unit / 2n) / unit) * 10000000000000n);
}
export function accounting(data: Stream, timestamp: bigint) {
  const effective = data.cancelledAt ? BigInt(data.cancelledAt) : timestamp;
  const elapsed = effective - BigInt(data.startTime);
  const duration = BigInt(data.endTime - data.startTime);
  const unlocked =
    elapsed <= 0n
      ? 0n
      : elapsed >= duration
        ? data.deposit
        : (data.deposit * elapsed) / duration;
  return {
    unlocked,
    available: unlocked - data.withdrawn,
    scheduled: data.deposit - unlocked - data.refunded,
  };
}
export function validateStream(
  recipient: string,
  amount: string,
  duration: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isAddress(recipient) || recipient.toLowerCase() === zeroAddress)
    errors.recipient = "Enter a valid, nonzero wallet address.";
  try {
    parseAmount(amount);
  } catch (error) {
    errors.amount = (error as Error).message;
  }
  if (!Number.isInteger(duration) || duration < 60 || duration > 31536000)
    errors.duration = "Choose a duration from 60 seconds to 365 days.";
  return errors;
}
export const sameAddress = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const shortAddress = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;
export function durationLabel(seconds: number) {
  if (seconds === 60) return "1 minute";
  if (seconds % 86400 === 0)
    return `${seconds / 86400} ${seconds === 86400 ? "day" : "days"}`;
  if (seconds % 3600 === 0)
    return `${seconds / 3600} ${seconds === 3600 ? "hour" : "hours"}`;
  return `${seconds} seconds`;
}
export function streamStatus(stream: Stream, timestamp: bigint) {
  return stream.cancelledAt
    ? "Cancelled"
    : timestamp < BigInt(stream.endTime)
      ? "Streaming"
      : stream.withdrawn === stream.deposit
        ? "Completed"
        : "Fully unlocked";
}
