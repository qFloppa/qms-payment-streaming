import { accounting, formatAmount } from "../lib/domain";
import type { Stream } from "../lib/domain";

export function Timeline({
  stream,
  timestamp,
}: {
  stream: Stream;
  timestamp: bigint;
}) {
  const values = accounting(stream, timestamp);
  const duration = stream.endTime - stream.startTime;
  const remaining =
    timestamp < stream.endTime ? Number(stream.endTime - timestamp) : 0;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const share = (stream.deposit * BigInt(i + 1)) / 60n;
    return share <= stream.withdrawn
      ? "withdrawn"
      : share <= values.unlocked
        ? "available"
        : "scheduled";
  });
  function timeLabel(value: bigint) {
    const seconds = Number(value);
    return seconds >= 3600
      ? `${Math.floor(seconds / 3600)}h`
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return (
    <section className="stream-timeline">
      <div className="row-between">
        <h2>
          {duration === 60n ? "The minute, so far" : "The stream, so far"}
        </h2>
        <span className="small accent">
          {stream.cancelledAt
            ? "Accrual stopped"
            : remaining
              ? remaining < 60
                ? `${remaining} seconds left`
                : `${Math.ceil(remaining / 60)} minutes left`
              : "Fully unlocked"}
        </span>
      </div>
      <div className="timeline-bars" aria-label="Confirmed payment timeline">
        {ticks.map((state, index) => (
          <i className={state} key={index} />
        ))}
      </div>
      <div className="timeline-scale">
        {[0n, 1n, 2n, 3n, 4n].map((index) => (
          <span key={index.toString()}>
            {timeLabel((duration * index) / 4n)}
          </span>
        ))}
      </div>
      <dl className="stream-balances">
        <div>
          <dt>Unlocked</dt>
          <dd>{formatAmount(values.unlocked)} QMS</dd>
        </div>
        <div>
          <dt>Withdrawn</dt>
          <dd>{formatAmount(stream.withdrawn)} QMS</dd>
        </div>
        <div>
          <dt>Still scheduled</dt>
          <dd>{formatAmount(values.scheduled)} QMS</dd>
        </div>
        {stream.refunded > 0n ? (
          <div>
            <dt>Returned to sender</dt>
            <dd>{formatAmount(stream.refunded)} QMS</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
