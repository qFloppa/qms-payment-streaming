import { isAddress } from "viem";
import type { Address } from "viem";
import { accounting, sameAddress, validateStream } from "./domain";
import type { StreamRow } from "./domain";

export const MAX_PAYOUTS = 25;
export type PayoutRow = { recipient: string; amount: string; label: string };
export type PaymentRequest = PayoutRow & { duration: number };
export const templates = [
  { label: "1-minute trial", duration: 60 },
  { label: "Weekly contributor", duration: 604800 },
  { label: "Monthly retainer", duration: 2592000 },
] as const;

export function validateLabel(label: string) {
  const value = label.trim();
  if (new TextEncoder().encode(value).length > 80)
    throw new Error(
      "Keep the stream name within 80 bytes (usually 80 characters).",
    );
  return value;
}

export function summarizeStreams(
  streams: StreamRow[],
  wallet: Address,
  timestamp: bigint,
) {
  let available = 0n,
    incoming = 0n,
    outgoing = 0n,
    active = 0;
  const forecast = Array.from({ length: 7 }, (_, index) => ({
    timestamp: timestamp + BigInt(index + 1) * 86400n,
    incoming: 0n,
    outgoing: 0n,
  }));
  for (const stream of streams) {
    const receiver = sameAddress(stream.recipient, wallet);
    const sender = sameAddress(stream.sender, wallet);
    if (!receiver && !sender) continue;
    const values = accounting(stream, timestamp);
    if (receiver) available += values.available;
    if (!stream.cancelledAt && timestamp < stream.endTime) active++;
    if (receiver && sender) continue;
    if (receiver) incoming += values.scheduled;
    if (sender) outgoing += values.scheduled;
    let previous = values.unlocked;
    for (const day of forecast) {
      const next = accounting(stream, day.timestamp).unlocked;
      if (receiver) day.incoming += next - previous;
      if (sender) day.outgoing += next - previous;
      previous = next;
    }
  }
  return { available, incoming, outgoing, active, forecast };
}

export function parsePaymentRequest(
  params: URLSearchParams,
): (PaymentRequest & { chainId: number }) | undefined {
  if (!params.has("request")) return undefined;
  for (const key of [
    "request",
    "recipient",
    "amount",
    "duration",
    "name",
    "network",
  ])
    if (params.getAll(key).length > 1)
      throw new Error(
        "This payment request contains duplicate terms. Ask for a new link.",
      );
  const recipient = params.get("recipient") ?? "";
  const amount = params.get("amount") ?? "";
  const seconds = params.get("duration") ?? "";
  const network = params.get("network") ?? "";
  const duration = Number(seconds),
    chainId = Number(network);
  if (
    params.get("request") !== "1" ||
    !/^\d+$/.test(seconds) ||
    !/^\d+$/.test(network) ||
    !Number.isSafeInteger(chainId) ||
    chainId < 1
  )
    throw new Error(
      "This payment request is incomplete or invalid. Ask for a new link.",
    );
  const errors = validateStream(recipient, amount, duration);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return {
    recipient,
    amount,
    duration,
    label: validateLabel(params.get("name") ?? ""),
    chainId,
  };
}

export function buildRequestUrl(
  base: string,
  request: PaymentRequest,
  chainId: number,
  contract: string,
) {
  const params = new URLSearchParams({
    request: "1",
    recipient: request.recipient,
    amount: request.amount,
    duration: String(request.duration),
    name: request.label,
    network: String(chainId),
  });
  parsePaymentRequest(params);
  if (!isAddress(contract))
    throw new Error(
      "Select a verified Rill deployment before creating a request link.",
    );
  const url = new URL(base);
  url.search = new URLSearchParams({ contract }).toString();
  url.hash = `/create?${params}`;
  return url.toString();
}

export function parsePayoutCsv(text: string): PayoutRow[] {
  if (text.length > 50000)
    throw new Error("CSV is too large. Import up to 25 recipients.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const finishField = () => {
    row.push(field.trim());
    field = "";
    closed = false;
  };
  const finishRow = () => {
    finishField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
    } else if (char === ",") finishField();
    else if (char === "\n") finishRow();
    else if (char === '"' && !field && !closed) quoted = true;
    else if (char === '"' || (closed && char.trim()))
      throw new Error("CSV contains a malformed quoted field.");
    else if (!closed) field += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  finishRow();
  if (
    rows
      .shift()
      ?.map((value) => value.toLowerCase())
      .join(",") !== "recipient,amount,name"
  )
    throw new Error("Use CSV headers: recipient,amount,name.");
  if (!rows.length || rows.length > MAX_PAYOUTS)
    throw new Error("Import between 1 and 25 recipients.");
  return rows.map((values, index) => {
    if (values.length !== 3)
      throw new Error(`CSV row ${index + 2} must have three columns.`);
    const [recipient, amount, label] = values;
    const errors = validateStream(recipient, amount, 60);
    if (Object.keys(errors).length)
      throw new Error(`CSV row ${index + 2}: ${Object.values(errors)[0]}`);
    return { recipient, amount, label: validateLabel(label) };
  });
}
