import { useState } from "react";
import type { ReactNode } from "react";
import { useRill } from "../context/RillContext";
import type { Review } from "../context/RillContext";
import { chain } from "../lib/config";
import { durationLabel, formatAmount } from "../lib/domain";
import { friendlyError } from "../lib/transactions";
import { CopyButton, Dialog, ErrorNotice } from "./Primitives";

export function ReviewDialog({
  review,
  onClose,
  children,
}: {
  review: Review;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { submit, busy, wallet } = useRill();
  const [error, setError] = useState("");
  const changed = wallet.version !== review.revision;
  const title =
    review.action === "cancel"
      ? "Cancel this stream?"
      : review.action === "withdraw"
        ? "Review withdrawal"
        : review.action === "deploy"
          ? "Deploy Rill"
          : "Review your stream";
  return (
    <Dialog title={title} onClose={onClose}>
      {review.action === "create" ? (
        <>
          <p className="review-amount">
            {formatAmount(review.value ?? 0n)} <span>QMS</span>
          </p>
          <dl className="facts">
            <div>
              <dt>Recipient</dt>
              <dd>
                <CopyButton value={review.recipient!} />
              </dd>
            </div>
            <div>
              <dt>Unlock over</dt>
              <dd>{durationLabel(review.duration!)}</dd>
            </div>
          </dl>
          <p className="small muted">Starts when your transaction confirms.</p>
        </>
      ) : null}
      {children}
      <dl className="facts">
        <div>
          <dt>Network</dt>
          <dd>{chain.name}</dd>
        </div>
        <div>
          <dt>Estimated maximum fee</dt>
          <dd>{formatAmount(review.fee, 8)} QMS</dd>
        </div>
      </dl>
      <p className="small muted">
        Your wallet pays the network fee separately. Unused gas is not charged.
      </p>
      {error || changed ? (
        <ErrorNotice
          message={
            changed
              ? "Your wallet changed. Close this review and review the action again."
              : error
          }
        />
      ) : null}
      <button
        className="primary full"
        disabled={busy || changed}
        onClick={async () => {
          setError("");
          try {
            await submit(review);
            onClose();
          } catch (error) {
            setError(friendlyError(error));
          }
        }}
      >
        {busy
          ? "Confirm in your wallet…"
          : review.action === "cancel"
            ? "Confirm cancellation"
            : "Confirm in wallet"}
      </button>
      <button className="text-button full" onClick={onClose}>
        Back
      </button>
    </Dialog>
  );
}
