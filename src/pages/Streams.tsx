import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useRill } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { useContacts } from "../hooks/useContacts";
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

export function Streams({ initialFilter = "All" }: { initialFilter?: string }) {
  const { wallet, contract, setWalletOpen } = useRill();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState(
    ["Incoming", "Outgoing"].includes(initialFilter) ? initialFilter : "All",
  );
  const { data, error, refresh } = useSnapshot(contract, wallet.account, -1);
  const { contacts } = useContacts(wallet.account);
  const filtered =
    data?.streams
      .filter(
        (stream) =>
          filter === "All" ||
          sameAddress(
            wallet.account,
            filter === "Incoming" ? stream.recipient : stream.sender,
          ),
      )
      .slice()
      .sort((a, b) => (a.id > b.id ? -1 : 1)) ?? [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 20) - 1),
  );
  return (
    <>
      <PageHeading
        title="Your streams"
        subtitle="Payments moving at their own pace."
      >
        <a className="primary" href="#/create">
          Create a stream <ArrowUpRight size={17} />
        </a>
      </PageHeading>
      {!wallet.account ? (
        <div className="empty-state">
          <h2>A place for your payments.</h2>
          <p className="muted">
            Connect your wallet to see incoming and outgoing streams.
          </p>
          <button className="primary" onClick={() => setWalletOpen(true)}>
            Connect wallet
          </button>
        </div>
      ) : !contract ? (
        <ContractNotice />
      ) : error ? (
        <ErrorNotice message={error} retry={refresh} />
      ) : !data ? (
        <p className="loading" role="status">Reading your streams…</p>
      ) : data.count === 0n ? (
        <div className="empty-state">
          <h2>Your first minute starts here.</h2>
          <p className="muted">
            Try a real payment. Stream 1 test QMS to yourself over 60 seconds.
          </p>
          <a className="primary" href="#/create?trial=1">
            Try a 1-minute stream <ArrowUpRight size={17} />
          </a>
        </div>
      ) : (
        <>
          <div className="filter-tabs" aria-label="Filter streams">
            {["All", "Incoming", "Outgoing"].map((item) => (
              <button
                aria-pressed={filter === item}
                key={item}
                onClick={() => {
                  setFilter(item);
                  setPage(0);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="streams-table">
            {filtered
              .slice(currentPage * 20, (currentPage + 1) * 20)
              .map((stream) => {
                const incoming = sameAddress(stream.recipient, wallet.account);
                const self = sameAddress(stream.sender, stream.recipient);
                return (
                  <a
                    className="stream-row"
                    href={`#/streams/${stream.id}`}
                    key={stream.id.toString()}
                  >
                    <span className="stream-row-icon">
                      {incoming ? (
                        <ArrowDownLeft size={20} />
                      ) : (
                        <ArrowUpRight size={20} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {stream.label ||
                          contacts.find((contact) =>
                            sameAddress(
                              contact.address,
                              incoming ? stream.sender : stream.recipient,
                            ),
                          )?.name ||
                          (self
                            ? "You to you"
                            : shortAddress(
                                incoming ? stream.sender : stream.recipient,
                              ))}
                      </strong>
                      <span className="small muted">
                        Stream #{stream.id.toString()} ·{" "}
                        {self
                          ? "Self stream"
                          : incoming
                            ? "Incoming"
                            : "Outgoing"}
                      </span>
                    </div>
                    <span className="stream-row-status">
                      {streamStatus(stream, data.timestamp)}
                    </span>
                    <div className="stream-row-money">
                      <strong>
                        {formatAmount(
                          accounting(stream, data.timestamp).available,
                        )}{" "}
                        QMS
                      </strong>
                      <span className="small muted">Available to withdraw</span>
                    </div>
                    <ArrowUpRight size={18} />
                  </a>
                );
              })}
          </div>
          <div className="pagination">
            <button
              className="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span className="small muted">
              Page {currentPage + 1} · {filtered.length} streams
            </span>
            <button
              className="secondary"
              disabled={(currentPage + 1) * 20 >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
          <p className="small muted">
            Filters cover all your streams. Self streams appear once.
          </p>
        </>
      )}
    </>
  );
}
