import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  createWalletClient,
  custom,
  decodeEventLog,
  encodeFunctionData,
  isAddress,
  zeroAddress,
} from "viem";
import type { Address, Hex, TransactionReceipt } from "viem";
import { rillAbi } from "../contracts/rill";
import { useWallet } from "../hooks/useWallet";
import type { Provider } from "../hooks/useWallet";
import { chain, client } from "../lib/config";
import { verifyContract, inspectContract } from "../lib/chain";
import { sameAddress } from "../lib/domain";
import {
  assertWalletContext,
  friendlyError,
  parsePending,
  receiptState,
  SubmissionGate,
} from "../lib/transactions";
import type { Action, Pending } from "../lib/transactions";
import { getSaved, save } from "../lib/storage";

export type Intent = {
  action: Action;
  recipient?: Address;
  value?: bigint;
  duration?: number;
  streamId?: bigint;
  bytecode?: Hex;
  label?: string;
  payouts?: {
    recipient: Address;
    amount: bigint;
    duration: bigint;
    label: string;
  }[];
};
export type Review = Intent & {
  account: Address;
  contract: Address;
  provider: Provider;
  revision: number;
  data: Hex;
  gas: bigint;
  gasPrice: bigint;
  fee: bigint;
};
type Feedback = {
  state: "awaiting" | "pending" | "confirmed" | "failed";
  message: string;
  hash?: Hex;
};

function initialContract() {
  return (
    new URLSearchParams(location.search).get("contract") ??
    (import.meta.env.VITE_STREAM_CONTRACT_ADDRESS ||
      getSaved(`contract:${chain.id}`) ||
      "")
  );
}
function useRillState() {
  const wallet = useWallet();
  const [walletOpen, setWalletOpen] = useState(false);
  const [faucetOpen, setFaucetOpen] = useState(false);
  const [contract, setContract] = useState(initialContract);
  const contractRef = useRef(contract);
  contractRef.current = contract;
  const [pending, setPending] = useState<Pending[]>(() =>
    parsePending(getSaved("pending")),
  );
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [feedback, setFeedback] = useState<Feedback>();
  const [busy, setBusy] = useState(false);
  const [receiptVersion, setReceiptVersion] = useState(0);
  const gate = useRef(new SubmissionGate());
  const watching = useRef(new Set<string>());
  const [storageError, setStorageError] = useState("");
  const storePending = useCallback((items: Pending[]) => {
    pendingRef.current = items;
    setPending(items);
    if (!save("pending", JSON.stringify(items)))
      setStorageError(
        "This browser cannot save pending transactions. Keep the transaction hash before closing this page.",
      );
  }, []);
  const acceptContract = useCallback(async (address: Address) => {
    await verifyContract(address);
    save(`contract:${chain.id}`, address);
    setContract(address);
    const url = new URL(location.href);
    url.searchParams.set("contract", address);
    history.replaceState(null, "", url);
  }, []);

  const settle = useCallback(
    async (item: Pending, receipt: TransactionReceipt, cancelled = false) => {
      // A successful replacement transfer is not a successful stream action.
      // Match the receipt to the intended contract, wallet, event, and stream ID.
      const matchingEvent = receipt.logs.some((log) => {
        if (!sameAddress(log.address, item.contract)) return false;
        try {
          const event = decodeEventLog({ abi: rillAbi, ...log });
          if (
            (item.action === "create" || item.action === "batch") &&
            event.eventName === "StreamCreated"
          )
            return sameAddress(event.args.sender, item.wallet);
          if (item.action === "withdraw" && event.eventName === "Withdrawal")
            return (
              sameAddress(event.args.recipient, item.wallet) &&
              event.args.streamId.toString() === item.streamId
            );
          if (item.action === "cancel" && event.eventName === "StreamCancelled")
            return (
              sameAddress(event.args.sender, item.wallet) &&
              event.args.streamId.toString() === item.streamId
            );
        } catch {
          /* Other contracts may emit unrelated logs. */
        }
        return false;
      });
      let exactIntent = true;
      if (item.data) {
        const transaction = await client.getTransaction({
          hash: receipt.transactionHash,
        });
        exactIntent =
          transaction.input === item.data &&
          transaction.value.toString() === item.value;
      }
      const batchCount = receipt.logs.filter((log) => {
        if (!sameAddress(log.address, item.contract)) return false;
        try {
          const event = decodeEventLog({ abi: rillAbi, ...log });
          return (
            event.eventName === "StreamCreated" &&
            sameAddress(event.args.sender, item.wallet)
          );
        } catch {
          return false;
        }
      }).length;
      const matches =
        exactIntent &&
        (item.action !== "batch" || batchCount === item.count) &&
        sameAddress(receipt.from, item.wallet) &&
        (item.action === "deploy"
          ? !!receipt.contractAddress
          : sameAddress(receipt.to ?? undefined, item.contract) &&
            matchingEvent);
      const failed =
        receiptState(receipt) !== "confirmed" ||
        cancelled ||
        item.intentChanged ||
        !matches;
      if (!failed && item.action === "deploy" && receipt.contractAddress)
        await acceptContract(receipt.contractAddress);
      setFeedback({
        state: failed ? "failed" : "confirmed",
        message: failed
          ? "The transaction reverted or was cancelled in your wallet. No action was completed."
          : item.action === "batch"
            ? `${batchCount} streams created. Your contributors’ payments are now unlocking.`
            : item.action === "create"
              ? "Stream created. Your payment is now unlocking."
              : item.action === "withdraw"
                ? "Withdrawal confirmed. QMS is back in the recipient’s wallet."
                : item.action === "cancel"
                  ? "Stream cancelled. Unlocked QMS remains available to the recipient."
                  : "Rill deployed and verified. Your app is ready to share.",
        hash: receipt.transactionHash,
      });
      storePending(pendingRef.current.filter((tx) => tx.hash !== item.hash));
      setReceiptVersion((value) => value + 1);
      if (!failed && item.action === "batch") {
        const accounts = await wallet.selected?.provider.request({
          method: "eth_accounts",
        });
        if (
          sameAddress(accounts?.[0], item.wallet) &&
          sameAddress(contractRef.current, item.contract)
        )
          location.hash = "/streams";
      }
      if (!failed && item.action === "create") {
        for (const log of receipt.logs) {
          if (!sameAddress(log.address, item.contract)) continue;
          try {
            const decoded = decodeEventLog({ abi: rillAbi, ...log });
            if (
              decoded.eventName === "StreamCreated" &&
              sameAddress(decoded.args.sender, item.wallet)
            ) {
              // A receipt from a previous account never redirects the new account.
              const accounts = await wallet.selected?.provider.request({
                method: "eth_accounts",
              });
              if (
                sameAddress(accounts?.[0], item.wallet) &&
                sameAddress(contractRef.current, item.contract)
              )
                location.hash = `/streams/${decoded.args.streamId}`;
            }
          } catch {
            /* Unrelated log. */
          }
        }
      }
    },
    [acceptContract, storePending, wallet.selected],
  );

  useEffect(() => {
    let active = true;
    const check = () => {
      for (const item of pendingRef.current.filter(
        (tx) => tx.chainId === chain.id,
      )) {
        if (watching.current.has(item.hash)) continue;
        const watchKey = item.hash;
        watching.current.add(watchKey);
        let cancelled = false;
        void client
          .waitForTransactionReceipt({
            hash: item.hash,
            timeout: 15000,
            onReplaced: (replacement) => {
              cancelled = replacement.reason === "cancelled";
              if (replacement.reason === "replaced") cancelled = true; // Changed intent needs a fresh review.
              const next = {
                ...item,
                hash: replacement.transaction.hash,
                intentChanged: cancelled || item.intentChanged,
              };
              storePending(
                pendingRef.current.map((tx) =>
                  tx.hash === item.hash ? next : tx,
                ),
              );
              item.hash = next.hash;
              item.intentChanged = next.intentChanged;
            },
          })
          .then((receipt) => {
            if (active) return settle(item, receipt, cancelled);
          })
          .catch(() => {
            // A timeout or RPC failure is not evidence of a reverted transaction.
          })
          .finally(() => watching.current.delete(watchKey));
      }
    };
    check();
    const timer = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pending.length, settle, storePending]);

  async function checkContext(
    review: Pick<
      Review,
      "account" | "provider" | "contract" | "revision" | "action"
    >,
  ) {
    if (
      wallet.revision.current !== review.revision ||
      (review.action !== "deploy" &&
        !sameAddress(contractRef.current, review.contract))
    )
      throw new Error(
        "Your wallet or contract changed. Review this action again.",
      );
    const [accounts, network, rpcNetwork] = await Promise.all([
      review.provider.request({ method: "eth_accounts" }),
      review.provider.request({ method: "eth_chainId" }),
      client.getChainId(),
    ]);
    assertWalletContext(review.account, chain.id, accounts, network);
    if (rpcNetwork !== chain.id)
      throw new Error("The RPC network changed. Review this action again.");
    if (review.action !== "deploy") await verifyContract(review.contract);
    if (wallet.revision.current !== review.revision)
      throw new Error("Your wallet changed. Review this action again.");
  }
  async function prepare(intent: Intent): Promise<Review> {
    if (!wallet.account || !wallet.selected)
      throw new Error("Connect your wallet to continue.");
    if (wallet.network !== chain.id)
      throw new Error(`Switch to ${chain.name} to continue.`);
    if (
      pendingRef.current.some(
        (tx) =>
          tx.chainId === chain.id && sameAddress(tx.wallet, wallet.account),
      )
    )
      throw new Error(
        "A transaction is still pending. Check its receipt before starting another.",
      );
    if (intent.action !== "deploy" && !isAddress(contract))
      throw new Error(
        "Rill is not deployed yet. Open the setup link to deploy a stream contract.",
      );
    if (intent.action === "batch" || intent.label) {
      if ((await inspectContract(contract)).version !== 2)
        throw new Error(
          "Names and batch payouts need Rill V2. Open setup to deploy it.",
        );
    }
    const data =
      intent.action === "batch"
        ? encodeFunctionData({
            abi: rillAbi,
            functionName: "createStreams",
            args: [intent.payouts!],
          })
        : intent.action === "create"
          ? intent.label
            ? encodeFunctionData({
                abi: rillAbi,
                functionName: "createNamedStream",
                args: [
                  intent.recipient!,
                  BigInt(intent.duration!),
                  intent.label,
                ],
              })
            : encodeFunctionData({
                abi: rillAbi,
                functionName: "createStream",
                args: [intent.recipient!, BigInt(intent.duration!)],
              })
          : intent.action === "deploy"
            ? intent.bytecode!
            : encodeFunctionData({
                abi: rillAbi,
                functionName: intent.action,
                args: [intent.streamId!],
              });
    const context = {
      ...intent,
      data,
      account: wallet.account,
      provider: wallet.selected.provider,
      contract:
        intent.action === "deploy" ? zeroAddress : (contract as Address),
      revision: wallet.revision.current,
    };
    await checkContext(context);
    const [estimated, gasPrice, balance] = await Promise.all([
      client.estimateGas({
        account: context.account,
        to: intent.action === "deploy" ? undefined : context.contract,
        data,
        value: intent.value ?? 0n,
      }),
      client.getGasPrice(),
      client.getBalance({ address: context.account }),
    ]);
    const gas = (estimated * 120n + 99n) / 100n;
    const fee = gas * gasPrice;
    if (balance < (intent.value ?? 0n) + fee)
      throw new Error(
        "Not enough QMS for this payment and the network fee. Get test QMS from the faucet, then try again.",
      );
    await checkContext(context);
    return { ...context, gas, gasPrice, fee };
  }
  async function submit(review: Review) {
    return gate.current.run(async () => {
      setBusy(true);
      setFeedback(undefined);
      try {
        await checkContext(review);
        const fresh = await prepare(review);
        if (fresh.fee > review.fee)
          throw new Error(
            "The network fee increased. Close this review and review the updated fee.",
          );
        await checkContext(review);
        setFeedback({
          state: "awaiting",
          message: "Confirm in your wallet. The stream has not started yet.",
        });
        const walletClient = createWalletClient({
          account: review.account,
          chain,
          transport: custom(review.provider),
        });
        const hash = await walletClient.sendTransaction({
          to: review.action === "deploy" ? undefined : review.contract,
          data: review.data,
          value: review.value ?? 0n,
          gas: review.gas,
          gasPrice: review.gasPrice,
          type: "legacy",
        });
        const item: Pending = {
          hash,
          chainId: chain.id,
          contract: review.contract,
          wallet: review.account,
          action: review.action,
          data: review.data,
          value: (review.value ?? 0n).toString(),
          ...(review.action === "batch"
            ? { count: review.payouts!.length }
            : {}),
          submittedAt: Date.now(),
          ...(review.streamId === undefined
            ? {}
            : { streamId: review.streamId.toString() }),
        };
        storePending([...pendingRef.current, item]);
        setFeedback({
          state: "pending",
          message: "Transaction submitted. Waiting for a block confirmation.",
          hash,
        });
      } catch (error) {
        setFeedback({ state: "failed", message: friendlyError(error) });
        throw error;
      } finally {
        setBusy(false);
      }
    });
  }
  return {
    wallet,
    walletOpen,
    setWalletOpen,
    faucetOpen,
    setFaucetOpen,
    contract,
    acceptContract,
    pending,
    feedback,
    setFeedback,
    busy,
    prepare,
    submit,
    receiptVersion,
    storageError,
  };
}
type RillState = ReturnType<typeof useRillState>;
const Context = createContext<RillState | null>(null);
export function RillProvider({ children }: { children: ReactNode }) {
  const state = useRillState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useRill() {
  const state = useContext(Context);
  if (!state) throw new Error("Rill context is missing.");
  return state;
}
