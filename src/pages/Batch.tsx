import { useState } from "react";
import { ArrowUpRight, FileUp, Plus, Trash2, Users } from "lucide-react";
import { maxUint256 } from "viem";
import type { Address } from "viem";
import { useRill } from "../context/RillContext";
import type { Review } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { formatAmount, parseAmount, validateStream } from "../lib/domain";
import { MAX_PAYOUTS, parsePayoutCsv, validateLabel } from "../lib/workspace";
import type { PayoutRow } from "../lib/workspace";
import { friendlyError } from "../lib/transactions";
import {
  ContactPicker,
  DurationSelect,
  V2Notice,
} from "../components/WorkspaceFields";
import {
  ContractNotice,
  Dialog,
  ErrorNotice,
  PageHeading,
} from "../components/Primitives";
import { ReviewDialog } from "../components/ReviewDialog";

const emptyRow = (): PayoutRow & { key: string } => ({
  key: crypto.randomUUID(),
  recipient: "",
  amount: "",
  label: "",
});
export function Batch() {
  const { wallet, contract, setWalletOpen, prepare } = useRill();
  const { data, error: chainError } = useSnapshot(contract, wallet.account);
  const [rows, setRows] = useState([emptyRow(), emptyRow()]);
  const [duration, setDuration] = useState(604800);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState("");
  const [csvError, setCsvError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review>();
  function update(key: string, field: keyof PayoutRow, value: string) {
    setRows((items) =>
      items.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }
  let total = 0n;
  for (const row of rows) {
    try {
      total += parseAmount(row.amount);
    } catch {
      /* Invalid rows are reported before review. */
    }
  }
  async function reviewPayouts() {
    setError("");
    if (!wallet.account) {
      setWalletOpen(true);
      return;
    }
    setLoading(true);
    try {
      const payouts = rows.map((row, index) => {
        const errors = validateStream(
          row.recipient.trim(),
          row.amount,
          duration,
        );
        if (Object.keys(errors).length)
          throw new Error(
            `Recipient ${index + 1}: ${Object.values(errors)[0]}`,
          );
        return {
          recipient: row.recipient.trim() as Address,
          amount: parseAmount(row.amount),
          duration: BigInt(duration),
          label: validateLabel(row.label),
        };
      });
      if (total > maxUint256)
        throw new Error("The combined payout exceeds the supported amount.");
      setReview(await prepare({ action: "batch", payouts, value: total }));
    } catch (issue) {
      setError(friendlyError(issue));
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHeading
        title="One team. One transaction."
        subtitle="Fund your contributors together. Every person gets their own stream."
      >
        <button
          className="secondary"
          onClick={() => {
            setCsvError("");
            setImporting(true);
          }}
        >
          <FileUp size={17} /> Import CSV
        </button>
      </PageHeading>
      {data?.version === 1 ? <V2Notice /> : null}
      <div className="batch-layout">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void reviewPayouts();
          }}
          noValidate
        >
          <div className="section-heading">
            <h2>Your contributors</h2>
            <span className="count-badge">
              {rows.length} / {MAX_PAYOUTS}
            </span>
          </div>
          <div className="payout-rows">
            {rows.map((row, index) => (
              <fieldset className="payout-row" key={row.key}>
                <legend>
                  <span className="recipient-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>{" "}
                  Recipient {index + 1}
                </legend>
                <div className="payout-row-fields">
                  <div className="field">
                    <label htmlFor={`${row.key}-recipient`}>
                      Wallet address
                    </label>
                    <input
                      id={`${row.key}-recipient`}
                      value={row.recipient}
                      placeholder="0x…"
                      onChange={(event) =>
                        update(row.key, "recipient", event.target.value)
                      }
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <ContactPicker
                      onSelect={(address) =>
                        update(row.key, "recipient", address)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${row.key}-amount`}>Amount · QMS</label>
                    <input
                      id={`${row.key}-amount`}
                      value={row.amount}
                      placeholder="0.00"
                      inputMode="decimal"
                      onChange={(event) =>
                        update(row.key, "amount", event.target.value)
                      }
                    />
                  </div>
                  <div className="field payout-name">
                    <label htmlFor={`${row.key}-name`}>
                      Stream name{" "}
                      <span className="muted">· optional, public</span>
                    </label>
                    <input
                      id={`${row.key}-name`}
                      value={row.label}
                      placeholder="Design retainer"
                      onChange={(event) =>
                        update(row.key, "label", event.target.value)
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-button remove-payout"
                  aria-label={`Remove recipient ${index + 1}`}
                  disabled={rows.length === 1}
                  onClick={() =>
                    setRows((items) =>
                      items.filter((item) => item.key !== row.key),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            className="secondary add-recipient"
            disabled={rows.length >= MAX_PAYOUTS}
            onClick={() => setRows((items) => [...items, emptyRow()])}
          >
            <Plus size={17} /> Add recipient
          </button>
          {error || chainError ? (
            <ErrorNotice message={error || chainError!} />
          ) : null}
          {!contract ? <ContractNotice /> : null}
          <button
            className="primary full batch-mobile-review"
            disabled={loading || data?.version === 1}
          >
            {loading
              ? "Estimating network fee…"
              : wallet.account
                ? `Review ${rows.length} payouts`
                : "Connect wallet to review"}
            <ArrowUpRight size={17} />
          </button>
        </form>
        <aside className="payment-preview payout-summary">
          <span className="eyebrow">PAYOUT SUMMARY</span>
          <h2>
            A shared start.
            <br />
            Individual streams.
          </h2>
          <p className="small muted summary-label">Total to fund</p>
          <p className="payment-amount">
            {formatAmount(total)} <span>QMS</span>
          </p>
          <div className="summary-people">
            <Users size={17} /> {rows.length} contributors · 1 transaction
          </div>
          <DurationSelect value={duration} onChange={setDuration} />
          <p className="small muted">
            All streams start together after confirmation. Recipients withdraw
            independently as their payments unlock.
          </p>
          <div className="summary-rule" />
          <p className="small muted">
            You fund the full total upfront, plus the network fee. You can
            cancel individual streams; unlocked amounts stay with recipients.
          </p>
        </aside>
      </div>
      {review ? (
        <ReviewDialog review={review} onClose={() => setReview(undefined)} />
      ) : null}
      {importing ? (
        <Dialog
          title="Bring your payout list."
          onClose={() => setImporting(false)}
        >
          <p className="muted">
            Paste a CSV or choose a file. Use the headers{" "}
            <code>recipient,amount,name</code>. Importing replaces the current
            rows.
          </p>
          <label className="file-upload">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 50000) {
                  setCsvError("CSV is too large. Import up to 25 recipients.");
                  return;
                }
                try {
                  setCsv(await file.text());
                  setCsvError("");
                } catch {
                  setCsvError(
                    "The file could not be read. Try pasting its contents.",
                  );
                }
              }}
            />
          </label>
          <label htmlFor="csv-input">CSV contents</label>
          <textarea
            id="csv-input"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            rows={7}
            placeholder={"recipient,amount,name\n0x…,10,Design retainer"}
            spellCheck={false}
          />
          {csvError ? <ErrorNotice message={csvError} /> : null}
          <button
            className="primary full"
            onClick={() => {
              try {
                setRows(
                  parsePayoutCsv(csv).map((row) => ({
                    ...row,
                    key: crypto.randomUUID(),
                  })),
                );
                setImporting(false);
                setError("");
              } catch (issue) {
                setCsvError((issue as Error).message);
              }
            }}
          >
            Use these recipients
          </button>
        </Dialog>
      ) : null}
    </>
  );
}
