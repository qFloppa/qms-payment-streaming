import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Wallet } from "lucide-react";
import type { Address } from "viem";
import { useRill } from "../context/RillContext";
import type { Review } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { chain } from "../lib/config";
import {
  durationLabel,
  formatAmount,
  formatRate,
  parseAmount,
  sameAddress,
  shortAddress,
  validateStream,
} from "../lib/domain";
import { friendlyError } from "../lib/transactions";
import {
  ContractNotice,
  ErrorNotice,
  PageHeading,
} from "../components/Primitives";
import { ReviewDialog } from "../components/ReviewDialog";
import { ContactPicker, V2Notice } from "../components/WorkspaceFields";
import {
  parsePaymentRequest,
  templates,
  validateLabel,
} from "../lib/workspace";

export function Create({
  trial,
  search = "",
}: {
  trial: boolean;
  search?: string;
}) {
  const [prefill] = useState(() => {
    try {
      return {
        request: parsePaymentRequest(new URLSearchParams(search)),
        error: "",
      };
    } catch (issue) {
      return { request: undefined, error: (issue as Error).message };
    }
  });
  const request = prefill.request;
  const { wallet, contract, setWalletOpen, setFaucetOpen, prepare } = useRill();
  const { data, error: chainError } = useSnapshot(contract, wallet.account);
  const [self, setSelf] = useState(trial && !request);
  const [recipient, setRecipient] = useState(request?.recipient ?? "");
  const [label, setLabel] = useState(request?.label ?? "");
  const [amount, setAmount] = useState(
    request?.amount ?? (trial ? "1.00" : ""),
  );
  const [duration, setDuration] = useState(request?.duration ?? 60);
  const [custom, setCustom] = useState(
    !!request && ![60, 3600, 86400].includes(request.duration),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review>();
  const address = self ? (wallet.account ?? "") : recipient.trim();
  const requestError =
    prefill.error ||
    (request && request.chainId !== chain.id
      ? "This request is for a different network. Ask for a link on the current Rill network."
      : "");
  let value = 0n;
  try {
    value = parseAmount(amount);
  } catch {
    /* An empty or invalid form is not a payment. */
  }
  async function reviewStream() {
    setError("");
    if (requestError) {
      setError(requestError);
      return;
    }
    if (!wallet.account) {
      setWalletOpen(true);
      return;
    }
    const validation = validateStream(address, amount, duration);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setLoading(true);
    try {
      setReview(
        await prepare({
          action: "create",
          recipient: address as Address,
          duration,
          value: parseAmount(amount),
          label: validateLabel(label),
        }),
      );
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Create a stream"
        subtitle="Set the payment. Let time take care of the rest."
      />
      {requestError ? (
        <ErrorNotice message={requestError} />
      ) : request ? (
        <div className="notice request-notice">
          <span>
            Payment request · Review the recipient and terms before funding.
            This link is an unsigned proposal, and you can edit the terms below.
          </span>
        </div>
      ) : null}
      {!request && !trial ? (
        <div className="template-row">
          <span className="small muted">START WITH</span>
          {templates.map((template) => (
            <button
              className="template-button"
              type="button"
              key={template.duration}
              onClick={() => {
                setDuration(template.duration);
                setCustom(![60, 3600, 86400].includes(template.duration));
                if (template.duration === 60) {
                  setSelf(true);
                  setAmount("1.00");
                } else {
                  setSelf(false);
                  if (data?.version === 2) setLabel(template.label);
                }
              }}
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="create-layout">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void reviewStream();
          }}
          noValidate
        >
          <div className="field">
            <div className="row-between">
              <label htmlFor="recipient">Recipient</label>
              <button
                type="button"
                className="text-button accent"
                onClick={() => {
                  setSelf(true);
                  if (!wallet.account) setWalletOpen(true);
                }}
              >
                Use my wallet
              </button>
            </div>
            <div className="recipient-input">
              {self ? <Wallet size={18} /> : null}
              <input
                id="recipient"
                value={
                  self
                    ? wallet.account
                      ? "Your connected wallet"
                      : ""
                    : recipient
                }
                placeholder={self ? "Connect your wallet" : "0x…"}
                onChange={(event) => {
                  setSelf(false);
                  setRecipient(event.target.value);
                }}
                aria-invalid={!!errors.recipient}
                aria-describedby="recipient-help recipient-error"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <p id="recipient-help" className="small muted">
              You can send a stream to yourself to try it out.
            </p>
            <ContactPicker
              onSelect={(value) => {
                setSelf(false);
                setRecipient(value);
              }}
            />
            {errors.recipient ? (
              <p id="recipient-error" className="field-error" role="alert">
                {errors.recipient}
              </p>
            ) : null}
          </div>
          {!trial || request ? (
            <div className="field">
              <label htmlFor="stream-name">Stream name</label>
              <input
                id="stream-name"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="November design retainer"
              />
              <p className="small muted">
                Optional. Names are public on chain.
              </p>
            </div>
          ) : null}
          <div className="field">
            <div className="row-between">
              <label htmlFor="amount">Total payment</label>
              <span className="small muted">
                Balance:{" "}
                {data?.balance === undefined
                  ? "—"
                  : formatAmount(data.balance, 3)}{" "}
                QMS
              </span>
            </div>
            <div className="amount-input">
              <input
                id="amount"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "amount-error" : undefined}
              />
              <span>QMS</span>
            </div>
            {errors.amount ? (
              <p id="amount-error" className="field-error" role="alert">
                {errors.amount}
              </p>
            ) : null}
          </div>
          <fieldset className="duration-field">
            <legend>Unlock over</legend>
            <div className="duration-options">
              {[
                [60, "1 minute"],
                [3600, "1 hour"],
                [86400, "1 day"],
              ].map(([seconds, label]) => (
                <button
                  type="button"
                  aria-pressed={!custom && duration === seconds}
                  key={seconds}
                  onClick={() => {
                    setCustom(false);
                    setDuration(Number(seconds));
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => setCustom(true)}
              >
                Custom
              </button>
            </div>
            {custom ? (
              <label className="custom-duration">
                Duration in seconds
                <input
                  type="number"
                  min="60"
                  max="31536000"
                  value={duration || ""}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </label>
            ) : null}
            <p className="small muted">
              Starts when your transaction confirms.
            </p>
            {errors.duration ? (
              <p className="field-error" role="alert">
                {errors.duration}
              </p>
            ) : null}
          </fieldset>
          <div className="cancel-terms">
            <p>
              <Check size={18} />
              You can cancel at any time.
            </p>
            <p className="muted small">
              The recipient keeps the amount already unlocked.
              <br />
              The rest returns to you.
            </p>
          </div>
          {wallet.account && !contract ? <ContractNotice /> : null}
          {chainError ? <ErrorNotice message={chainError} /> : null}
          {data?.version === 1 && label ? <V2Notice /> : null}
          {error ? <ErrorNotice message={error} /> : null}
          <button
            type="submit"
            className="primary"
            disabled={loading || !!requestError}
          >
            {loading
              ? "Estimating network fee…"
              : wallet.account
                ? "Review stream"
                : "Connect wallet to review"}
            <ArrowUpRight size={17} />
          </button>
          <p className="small muted review-caption">
            You will review the network fee before signing.
          </p>
          {wallet.account &&
          ((data?.balance !== undefined && data.balance <= value) ||
            /not enough/i.test(error)) ? (
            <button
              className="text-button accent"
              type="button"
              onClick={() => setFaucetOpen(true)}
            >
              Get test QMS
            </button>
          ) : null}
        </form>
        <aside className="payment-preview">
          <h2>Your payment</h2>
          <p className="small muted">Preview · not started</p>
          <div className="row-between payment-route">
            <span>You</span>
            <ArrowRight size={21} />
            <span>
              {self || sameAddress(address, wallet.account)
                ? "You"
                : address
                  ? shortAddress(address)
                  : "Recipient"}
            </span>
          </div>
          <p className="small muted">Total payment</p>
          <p className="payment-amount">{formatAmount(value)} QMS</p>
          <dl className="facts">
            <div>
              <dt>Duration</dt>
              <dd>{durationLabel(duration)}</dd>
            </div>
            <div>
              <dt>Rate</dt>
              <dd>≈ {formatRate(value, duration)} QMS / sec</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{chain.name}</dd>
            </div>
          </dl>
          <div className="mini-timeline" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="row-between small muted">
            <span>Start</span>
            <span>Fully unlocked in {durationLabel(duration)}</span>
          </div>
          <p className="small muted preview-note">
            This is test QMS, with no monetary value. Your wallet pays a small
            network fee.
          </p>
        </aside>
      </div>
      {review ? (
        <ReviewDialog review={review} onClose={() => setReview(undefined)} />
      ) : null}
    </>
  );
}
