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

export function Create({ trial }: { trial: boolean }) {
  const { wallet, contract, setWalletOpen, setFaucetOpen, prepare } = useRill();
  const { data, error: chainError } = useSnapshot(contract, wallet.account);
  const [self, setSelf] = useState(trial);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(trial ? "1.00" : "");
  const [duration, setDuration] = useState(60);
  const [custom, setCustom] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review>();
  const address = self ? (wallet.account ?? "") : recipient.trim();
  let value = 0n;
  try {
    value = parseAmount(amount);
  } catch {
    /* An empty or invalid form is not a payment. */
  }
  async function reviewStream() {
    setError("");
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
            {errors.recipient ? (
              <p id="recipient-error" className="field-error" role="alert">
                {errors.recipient}
              </p>
            ) : null}
          </div>
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
          {error ? <ErrorNotice message={error} /> : null}
          <button type="submit" className="primary" disabled={loading}>
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
