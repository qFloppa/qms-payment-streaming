import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useRill } from "../context/RillContext";
import type { Review } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import {
  accounting,
  durationLabel,
  formatAmount,
  sameAddress,
  shortAddress,
  streamStatus,
} from "../lib/domain";
import { chain, explorerUrl } from "../lib/config";
import { friendlyError } from "../lib/transactions";
import {
  ContractNotice,
  CopyButton,
  ErrorNotice,
  PageHeading,
} from "../components/Primitives";
import { ReviewDialog } from "../components/ReviewDialog";
import { ActivityFeed } from "../components/ActivityFeed";
import { Timeline } from "../components/Timeline";

export function StreamDetail({ id }: { id: bigint }) {
  const { contract, wallet, prepare, setWalletOpen, busy, pending } = useRill();
  const { data, error, refresh } = useSnapshot(contract, wallet.account, 0, id);
  const [review, setReview] = useState<Review>();
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!contract)
    return (
      <>
        <PageHeading title="Stream details" />
        <ContractNotice />
      </>
    );
  if (error)
    return (
      <>
        <PageHeading title="Stream details" />
        <ErrorNotice message={error} retry={refresh} />
      </>
    );
  if (!data?.detail)
    return (
      <p className="loading" role="status">
        Reading this stream…
      </p>
    );
  const stream = data.detail;
  const values = accounting(stream, data.timestamp);
  const self = sameAddress(stream.sender, stream.recipient);
  const recipient = sameAddress(stream.recipient, wallet.account);
  const sender = sameAddress(stream.sender, wallet.account);
  const duration = Number(stream.endTime - stream.startTime);
  const status = streamStatus(stream, data.timestamp);
  const pendingAction = pending.some(
    (tx) => tx.streamId === id.toString() && sameAddress(tx.contract, contract),
  );
  async function action(type: "withdraw" | "cancel") {
    if (!wallet.account) {
      setWalletOpen(true);
      return;
    }
    setActionError("");
    setLoading(true);
    try {
      setReview(await prepare({ action: type, streamId: id }));
    } catch (error) {
      setActionError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }
  const date = (time: bigint) =>
    new Date(Number(time) * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const contractUrl = explorerUrl("address", contract);
  return (
    <>
      <PageHeading
        title={
          self && sender && duration === 60
            ? "Your first minute"
            : `Stream #${id}`
        }
        subtitle={`${self && sender ? "You to you" : `${shortAddress(stream.sender)} to ${shortAddress(stream.recipient)}`} · ${formatAmount(stream.deposit).replace(/\.0+$/, "")} QMS over ${duration === 60 ? "60 seconds" : durationLabel(duration)}`}
      >
        <span className="stream-status">
          <i className="status-dot" />
          {status}
        </span>
      </PageHeading>
      <div className="detail-layout">
        <div className="stream-primary">
          <section className="withdraw-card">
            <p className="muted">Available to withdraw</p>
            <p
              className={`available-amount ${formatAmount(values.available).length > 12 ? "long-amount" : ""}`}
              data-testid="available"
            >
              {formatAmount(values.available)} <span>QMS</span>
            </p>
            <div className="withdraw-actions">
              <button
                className="primary"
                disabled={
                  loading ||
                  busy ||
                  pendingAction ||
                  (wallet.account
                    ? !recipient ||
                      values.available === 0n ||
                      wallet.network !== chain.id
                    : false)
                }
                onClick={() => void action("withdraw")}
              >
                {pendingAction
                  ? "Transaction pending…"
                  : loading
                    ? "Preparing…"
                    : !wallet.account
                      ? "Connect to withdraw"
                      : "Withdraw QMS"}
                <ArrowUpRight size={18} />
              </button>
              <span className="small muted">
                {recipient
                  ? "To your connected wallet"
                  : "Only the recipient can withdraw"}
              </span>
            </div>
            {values.available === 0n ? (
              <p className="small muted empty-available">
                {stream.withdrawn === stream.deposit || stream.cancelledAt
                  ? "All available QMS has been withdrawn."
                  : "QMS becomes available as new blocks confirm."}
              </p>
            ) : null}
          </section>
          <Timeline stream={stream} timestamp={data.timestamp} />
        </div>
        <aside className="stream-facts">
          <h2>Stream details</h2>
          <dl className="facts">
            <div className="mobile-parties">
              <dt>From / to</dt>
              <dd>
                <CopyButton
                  compact
                  value={stream.sender}
                  label={sender ? "Your wallet" : undefined}
                />{" "}
                /{" "}
                <CopyButton
                  compact
                  value={stream.recipient}
                  label={recipient ? "your wallet" : undefined}
                />
              </dd>
            </div>
            <div className="desktop-fact">
              <dt>From</dt>
              <dd>
                <CopyButton
                  compact
                  value={stream.sender}
                  label={sender ? "Your wallet" : undefined}
                />
              </dd>
            </div>
            <div className="desktop-fact">
              <dt>To</dt>
              <dd>
                <CopyButton
                  compact
                  value={stream.recipient}
                  label={recipient ? "Your wallet" : undefined}
                />
              </dd>
            </div>
            <div>
              <dt>Funded</dt>
              <dd>{formatAmount(stream.deposit)} QMS</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{date(stream.startTime)}</dd>
            </div>
            <div>
              <dt>{stream.cancelledAt ? "Cancelled" : "Ends"}</dt>
              <dd>{date(stream.cancelledAt || stream.endTime)}</dd>
            </div>
            <div className="desktop-fact">
              <dt>Network</dt>
              <dd>{chain.name}</dd>
            </div>
          </dl>
          <div className="detail-links">
            {contractUrl ? (
              <a
                className="text-link"
                href={contractUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on QMSScan <ArrowUpRight size={15} />
              </a>
            ) : null}
            <CopyButton value={location.href} label="Share stream" />
          </div>
          {sender && !stream.cancelledAt && data.timestamp < stream.endTime ? (
            <div className="cancel-action desktop-cancel">
              <button
                className="text-button accent"
                disabled={loading || busy || pendingAction}
                onClick={() => void action("cancel")}
              >
                Cancel stream
              </button>
              <p className="small muted">
                Unlocked QMS stays available to the recipient.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
      {actionError ? <ErrorNotice message={actionError} /> : null}
      <ActivityFeed
        contract={data.verified!}
        block={data.blockNumber}
        streamId={id}
      />
      <div className="mobile-cancel">
        {sender && !stream.cancelledAt && data.timestamp < stream.endTime ? (
          <div className="cancel-action">
            <button
              className="text-button accent"
              disabled={loading || busy || pendingAction}
              onClick={() => void action("cancel")}
            >
              Cancel stream
            </button>
            <p className="small muted">
              Unlocked QMS stays available to the recipient.
            </p>
          </div>
        ) : null}
      </div>
      <p className="block-note small muted">
        Amounts confirmed at block {data.blockNumber.toString()} ·{" "}
        <button className="text-button" onClick={refresh}>
          Refresh
        </button>
      </p>
      {status === "Completed" ? (
        <a className="text-link" href="#/create">
          Create another stream <ArrowUpRight size={16} />
        </a>
      ) : null}
      {review ? (
        <ReviewDialog review={review} onClose={() => setReview(undefined)}>
          {review.action === "cancel" ? (
            <>
              <p>
                The recipient keeps{" "}
                <strong>{formatAmount(values.available)} QMS</strong> still
                available to withdraw. About{" "}
                <strong>{formatAmount(values.scheduled)} QMS</strong> returns to
                you.
              </p>
              <p className="small muted">
                These are estimates from the latest block. More QMS may unlock
                before your cancellation confirms.
              </p>
            </>
          ) : (
            <p className="review-amount">
              {formatAmount(values.available)} <span>QMS available</span>
            </p>
          )}
        </ReviewDialog>
      ) : null}
    </>
  );
}
