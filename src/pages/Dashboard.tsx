import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  Link2,
  Plus,
  Users,
} from "lucide-react";
import { useRill } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { useContacts } from "../hooks/useContacts";
import { summarizeStreams } from "../lib/workspace";
import {
  accounting,
  formatAmount,
  sameAddress,
  shortAddress,
  streamStatus,
} from "../lib/domain";
import {
  ContractNotice,
  ErrorNotice,
  PageHeading,
} from "../components/Primitives";
import { V2Notice } from "../components/WorkspaceFields";

export function Dashboard() {
  const { wallet, contract } = useRill();
  const { data, error, refresh } = useSnapshot(contract, wallet.account, -1);
  const { contacts } = useContacts(wallet.account);
  const summary =
    data && wallet.account
      ? summarizeStreams(data.streams, wallet.account, data.timestamp)
      : undefined;
  const labelFor = (address: string) =>
    contacts.find((item) => sameAddress(item.address, address))?.name ??
    shortAddress(address);
  const upcoming =
    data?.streams
      .filter(
        (stream) => !stream.cancelledAt && stream.endTime > data.timestamp,
      )
      .sort((a, b) => (a.endTime < b.endTime ? -1 : 1))
      .slice(0, 4) ?? [];
  const recent =
    data?.streams
      .slice()
      .sort((a, b) => (a.id > b.id ? -1 : 1))
      .slice(0, 4) ?? [];
  const peak =
    summary?.forecast.reduce(
      (max, day) =>
        day.incoming > max || day.outgoing > max
          ? day.incoming > day.outgoing
            ? day.incoming
            : day.outgoing
          : max,
      0n,
    ) ?? 0n;
  const height = (value: bigint) =>
    peak ? Number((value * 10000n) / peak) / 100 : 0;
  return (
    <>
      <PageHeading
        title="Your payments, in motion."
        subtitle="A clear view of what’s earned, what’s committed, and what comes next."
      >
        <a className="primary" href="#/create">
          <Plus size={17} /> Create a stream
        </a>
      </PageHeading>
      {!contract ? (
        <ContractNotice />
      ) : error ? (
        <ErrorNotice message={error} retry={refresh} />
      ) : !data ? (
        <p className="loading" role="status">
          Reading all your payment streams…
        </p>
      ) : null}
      {data?.version === 1 ? <V2Notice /> : null}
      {summary ? (
        <>
          <div className="metrics-grid">
            <section className="metric metric-featured">
              <span>
                <ArrowDownLeft size={16} /> Available to withdraw
              </span>
              <p data-testid="available-total">
                {formatAmount(summary.available, 3)} <small>QMS</small>
              </p>
              <a href="#/streams?filter=Incoming">
                View incoming streams <ArrowRight size={14} />
              </a>
            </section>
            <section className="metric">
              <span>Coming to you</span>
              <p>
                {formatAmount(summary.incoming, 3)} <small>QMS</small>
              </p>
              <small>Still scheduled · incoming</small>
            </section>
            <section className="metric">
              <span>Committed to others</span>
              <p data-testid="outgoing-total">
                {formatAmount(summary.outgoing)} <small>QMS</small>
              </p>
              <small>Still scheduled · outgoing</small>
            </section>
            <section className="metric">
              <span>Active streams</span>
              <p>{summary.active.toString().padStart(2, "0")}</p>
              <small>{data!.streams.length} total payment records</small>
            </section>
          </div>
          <div className="dashboard-columns">
            <section className="workspace-panel forecast-panel">
              <div className="section-heading">
                <div>
                  <h2>The next seven days</h2>
                  <p className="small muted">
                    QMS scheduled to unlock each day
                  </p>
                </div>
                <span className="period-tag">7 DAYS</span>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="incoming-dot" /> Incoming
                </span>
                <span>
                  <i className="outgoing-dot" /> Outgoing
                </span>
              </div>
              <div
                className="forecast-chart"
                role="img"
                aria-label={
                  peak
                    ? "Scheduled incoming and outgoing QMS for the next seven days. Exact daily amounts are available below."
                    : "No QMS is scheduled to unlock over the next seven days."
                }
              >
                {summary.forecast.map((day, index) => (
                  <div className="forecast-day" key={index}>
                    <div className="bar-pair">
                      <div
                        className="forecast-bar incoming-bar"
                        style={{ height: `${height(day.incoming)}%` }}
                        title={`${formatAmount(day.incoming)} QMS incoming`}
                      />
                      <div
                        className="forecast-bar outgoing-bar"
                        style={{ height: `${height(day.outgoing)}%` }}
                        title={`${formatAmount(day.outgoing)} QMS outgoing`}
                      />
                    </div>
                    <span>
                      {new Date(
                        Number(day.timestamp - 86400n) * 1000,
                      ).toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                  </div>
                ))}
                {!peak ? (
                  <p className="chart-empty">
                    Your next payment starts the flow.
                  </p>
                ) : null}
              </div>
              <details className="forecast-details">
                <summary>View daily amounts</summary>
                <table>
                  <caption className="sr-only">
                    Release forecast in QMS, each period spans 24 hours from the
                    latest block
                  </caption>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Incoming QMS</th>
                      <th>Outgoing QMS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.forecast.map((day, index) => (
                      <tr key={index}>
                        <td>Day {index + 1}</td>
                        <td>{formatAmount(day.incoming)}</td>
                        <td>{formatAmount(day.outgoing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <p className="small muted chart-caption">
                Based on funded schedules. Self streams excluded. Withdrawals
                are claimed separately.
              </p>
            </section>
            <section className="workspace-panel ending-panel">
              <div className="section-heading">
                <h2>On the horizon</h2>
                <Clock3 size={18} />
              </div>
              <p className="small muted">Your next streams to finish</p>
              {upcoming.length ? (
                upcoming.map((stream) => (
                  <a
                    className="ending-row"
                    href={`#/streams/${stream.id}`}
                    key={stream.id.toString()}
                  >
                    <span className="ending-date">
                      {new Date(
                        Number(stream.endTime) * 1000,
                      ).toLocaleDateString(undefined, { month: "short" })}
                      <strong>
                        {new Date(Number(stream.endTime) * 1000).getDate()}
                      </strong>
                    </span>
                    <div>
                      <strong>{stream.label || `Stream #${stream.id}`}</strong>
                      <span>
                        {formatAmount(
                          accounting(stream, data!.timestamp).scheduled,
                          3,
                        )}{" "}
                        QMS remaining
                      </span>
                    </div>
                    <ArrowUpRight size={15} />
                  </a>
                ))
              ) : (
                <div className="panel-empty">
                  <Clock3 size={26} />
                  <p>
                    New streams will appear here with their scheduled end dates.
                  </p>
                </div>
              )}
              <a className="text-link" href="#/streams">
                All your streams <ArrowRight size={15} />
              </a>
            </section>
          </div>
          <section className="recent-section">
            <div className="section-heading">
              <h2>Recent streams</h2>
              <a className="text-link small" href="#/streams">
                View all <ArrowRight size={15} />
              </a>
            </div>
            {recent.length ? (
              recent.map((stream) => {
                const incoming = sameAddress(wallet.account, stream.recipient);
                const self = sameAddress(stream.sender, stream.recipient);
                return (
                  <a
                    className="dashboard-stream"
                    href={`#/streams/${stream.id}`}
                    key={stream.id.toString()}
                  >
                    <span
                      className={`stream-avatar ${incoming ? "incoming-avatar" : ""}`}
                    >
                      {incoming ? (
                        <ArrowDownLeft size={19} />
                      ) : (
                        <ArrowUpRight size={19} />
                      )}
                    </span>
                    <div className="dashboard-stream-name">
                      <strong>
                        {stream.label ||
                          (self
                            ? "You to you"
                            : labelFor(
                                incoming ? stream.sender : stream.recipient,
                              ))}
                      </strong>
                      <span>
                        {self
                          ? "Self stream"
                          : incoming
                            ? "Incoming"
                            : "Outgoing"}{" "}
                        · Stream #{stream.id.toString()}
                      </span>
                    </div>
                    <span className="status-chip">
                      {streamStatus(stream, data!.timestamp)}
                    </span>
                    <div className="dashboard-stream-value">
                      <strong>{formatAmount(stream.deposit, 3)} QMS</strong>
                      <span>Total funded</span>
                    </div>
                    <ArrowUpRight size={16} />
                  </a>
                );
              })
            ) : (
              <div className="first-payment-prompt">
                <div>
                  <h3>Start with your first minute.</h3>
                  <p>Stream 1 test QMS to yourself and watch it unlock.</p>
                </div>
                <a className="secondary" href="#/create?trial=1">
                  Try a 1-minute stream <ArrowUpRight size={16} />
                </a>
              </div>
            )}
          </section>
          <p className="small muted portfolio-note">
            All {data!.streams.length} streams · confirmed block{" "}
            {data!.blockNumber.toString()} · balances update as blocks arrive.
          </p>
        </>
      ) : null}
      <div className="workspace-actions">
        <a href="#/batch">
          <Users size={22} />
          <div>
            <strong>Pay your team</strong>
            <span>Multiple contributors. One transaction.</span>
          </div>
          <ArrowUpRight size={18} />
        </a>
        <a href="#/request">
          <Link2 size={22} />
          <div>
            <strong>Get paid with a link</strong>
            <span>Set the terms and share your request.</span>
          </div>
          <ArrowUpRight size={18} />
        </a>
      </div>
    </>
  );
}
