import { useState } from "react";
import { ArrowRight, Check, Link2 } from "lucide-react";
import { useRill } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { chain } from "../lib/config";
import { buildRequestUrl } from "../lib/workspace";
import { durationLabel } from "../lib/domain";
import {
  ContactPicker,
  DurationSelect,
  V2Notice,
} from "../components/WorkspaceFields";
import { CopyButton, ErrorNotice, PageHeading } from "../components/Primitives";

export function Request() {
  const { wallet, contract, setWalletOpen } = useRill();
  const { data, error: chainError } = useSnapshot(contract);
  const [recipient, setRecipient] = useState("");
  const [own, setOwn] = useState(true);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(604800);
  const [generated, setGenerated] = useState({ url: "", context: "" });
  const [error, setError] = useState("");
  const address = own ? (wallet.account ?? "") : recipient;
  const requestContext = JSON.stringify([
    wallet.account,
    contract,
    address,
    amount,
    duration,
    label,
  ]);
  const link = generated.context === requestContext ? generated.url : "";
  function setLink(url: string) {
    setGenerated({ url, context: requestContext });
  }
  function changed() {
    setLink("");
    setError("");
  }
  return (
    <>
      <PageHeading
        title="Good work deserves a stream."
        subtitle="Set your terms. Share a link. Let your client fund the payment."
      />
      <div className="create-layout request-layout">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setLink("");
            try {
              if (!data?.verified)
                throw new Error(
                  "Wait for the contract check or open setup to select a deployment.",
                );
              if (data.version === 1 && label)
                throw new Error(
                  "Named requests need V2. Clear the name or deploy V2 in setup.",
                );
              setLink(
                buildRequestUrl(
                  location.href,
                  { recipient: address, amount, duration, label },
                  chain.id,
                  contract,
                ),
              );
            } catch (issue) {
              setError((issue as Error).message);
            }
          }}
        >
          <div className="field">
            <div className="row-between">
              <label htmlFor="request-recipient">Recipient wallet</label>
              <button
                className="text-button accent"
                type="button"
                onClick={() => {
                  changed();
                  setOwn(true);
                  if (!wallet.account) setWalletOpen(true);
                }}
              >
                Use my wallet
              </button>
            </div>
            <input
              id="request-recipient"
              value={address}
              placeholder="Your wallet address · 0x…"
              onChange={(event) => {
                changed();
                setOwn(false);
                setRecipient(event.target.value);
              }}
              spellCheck={false}
              autoComplete="off"
            />
            <ContactPicker
              onSelect={(value) => {
                changed();
                setOwn(false);
                setRecipient(value);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="request-name">Stream name</label>
            <input
              id="request-name"
              value={label}
              placeholder="November design retainer"
              onChange={(event) => {
                changed();
                setLabel(event.target.value);
              }}
            />
            <p className="small muted">
              Optional. This name will be public when funded.
            </p>
          </div>
          <div className="field">
            <label htmlFor="request-amount">Requested amount</label>
            <div className="amount-input">
              <input
                id="request-amount"
                value={amount}
                placeholder="0.00"
                inputMode="decimal"
                onChange={(event) => {
                  changed();
                  setAmount(event.target.value);
                }}
              />
              <span>QMS</span>
            </div>
          </div>
          <DurationSelect
            value={duration}
            onChange={(value) => {
              changed();
              setDuration(value);
            }}
            label="Unlock over"
          />
          {data?.version === 1 ? <V2Notice /> : null}
          {error || chainError ? (
            <ErrorNotice message={error || chainError!} />
          ) : null}
          <button className="primary" type="submit">
            Create request link <Link2 size={17} />
          </button>
          <p className="small muted form-footnote">
            No transaction or signature is needed to create a link.
          </p>
          {link ? (
            <section className="request-result" aria-live="polite">
              <h2>
                <Check size={20} /> Your request is ready.
              </h2>
              <label htmlFor="request-link">Payment request link</label>
              <input
                id="request-link"
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <div className="action-row">
                <CopyButton value={link} label="Copy request link" />
                <a className="text-link" href={link}>
                  Preview request <ArrowRight size={16} />
                </a>
              </div>
            </section>
          ) : null}
        </form>
        <aside className="payment-preview request-explainer">
          <span className="eyebrow">FROM AGREEMENT TO PAYMENT</span>
          <h2>
            A little less admin.
            <br />A little more flow.
          </h2>
          <ol>
            <li>
              <strong>Make it yours</strong>
              <p>
                Choose the amount and how long it unlocks. Currently{" "}
                {durationLabel(duration)}.
              </p>
            </li>
            <li>
              <strong>Send it to your client</strong>
              <p>
                They review the full amount, recipient, and network fee in Rill.
              </p>
            </li>
            <li>
              <strong>Withdraw as you earn</strong>
              <p>
                Once funded, QMS unlocks over time. Withdraw whenever you’re
                ready.
              </p>
            </li>
          </ol>
          <p className="small muted">
            A request is an unsigned proposal. It does not reserve funds or
            prove who sent it. The payer can cancel a funded stream; unlocked
            funds remain yours.
          </p>
        </aside>
      </div>
    </>
  );
}
