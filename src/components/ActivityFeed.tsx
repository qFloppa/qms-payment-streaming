import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Address } from "viem";
import { readEvents } from "../lib/chain";
import type { ActivityEvent } from "../lib/chain";
import { formatAmount } from "../lib/domain";
import { explorerUrl } from "../lib/config";
import { ErrorNotice } from "./Primitives";

export function ActivityFeed({
  contract,
  block,
  wallet,
  streamId,
}: {
  contract: Address;
  block: bigint;
  wallet?: Address;
  streamId?: bigint;
}) {
  const key = `${contract}:${wallet}:${streamId}`;
  const [result, setResult] = useState<{
    key: string;
    events: ActivityEvent[];
    from: bigint;
  }>();
  const [older, setOlder] = useState<bigint>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResult(undefined);
    setOlder(undefined);
  }, [key]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    // Keep watching the newest range after the visitor loads historical pages.
    const ranges = older === undefined ? [block] : [block, older];
    void Promise.all(
      ranges.map((to) => readEvents(contract, to, wallet, streamId)),
    )
      .then((pages) => {
        if (active)
          setResult((previous) => {
            const merged = new Map<string, ActivityEvent>();
            if (previous?.key === key)
              for (const item of previous.events)
                if (
                  item.blockNumber <= block &&
                  !pages.some(
                    (page, index) =>
                      item.blockNumber >= page.fromBlock &&
                      item.blockNumber <= ranges[index],
                  )
                )
                  merged.set(`${item.hash}:${item.index}`, item);
            // Replace queried ranges so orphaned events cannot linger after a reorg.
            for (const page of pages)
              for (const item of page.events)
                merged.set(`${item.hash}:${item.index}`, item);
            const fromBlock = pages.reduce(
              (first, page) =>
                page.fromBlock < first ? page.fromBlock : first,
              block,
            );
            return {
              key,
              events: [...merged.values()].sort((a, b) =>
                a.blockNumber === b.blockNumber
                  ? b.index - a.index
                  : a.blockNumber > b.blockNumber
                    ? -1
                    : 1,
              ),
              from:
                previous?.key === key && previous.from < fromBlock
                  ? previous.from
                  : fromBlock,
            };
          });
      })
      .catch(() => {
        if (active)
          setError("Activity could not be loaded. Try loading it again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, contract, block, wallet, streamId, older, retry]);
  const events = result?.key === key ? result.events : [];
  return (
    <section className="activity-section">
      <div className="row-between">
        <h2>Activity</h2>
        <span className="small muted">
          {streamId ? "This stream" : "Your wallet"}
        </span>
      </div>
      {error ? (
        <ErrorNotice
          message={error}
          retry={() => setRetry((value) => value + 1)}
        />
      ) : null}
      {events.map((event) => {
        const url = explorerUrl("tx", event.hash);
        return (
          <div className="activity-row" key={`${event.hash}:${event.index}`}>
            <span className="activity-icon">
              {event.name === "Withdrawal" ? (
                <ArrowDownLeft size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </span>
            <div>
              <a href={`#/streams/${event.streamId}`}>{event.name}</a>
              <span className="mobile-block small muted">
                Block {event.blockNumber.toString()}
              </span>
            </div>
            <span className="activity-amount">
              {formatAmount(event.amount)} QMS
            </span>
            {url ? (
              <a
                className="small muted"
                href={url}
                title={event.hash}
                target="_blank"
                rel="noreferrer"
              >
                Block {event.blockNumber.toString()} <ArrowUpRight size={12} />
              </a>
            ) : (
              <span className="small muted activity-block" title={event.hash}>
                Block {event.blockNumber.toString()}
              </span>
            )}
          </div>
        );
      })}
      {!events.length ? (
        <p className="muted">
          {loading
            ? "Reading onchain activity…"
            : "No activity in this block range."}
        </p>
      ) : null}
      {result?.from ? (
        <button
          className="text-button accent"
          disabled={loading}
          onClick={() => setOlder(result.from - 1n)}
        >
          Load earlier activity
        </button>
      ) : null}
    </section>
  );
}
