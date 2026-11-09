import { useState } from "react";
import { ArrowUpRight, Trash2, Users } from "lucide-react";
import { useRill } from "../context/RillContext";
import { useContacts } from "../hooks/useContacts";
import { CopyButton, ErrorNotice, PageHeading } from "../components/Primitives";

export function Contacts() {
  const { wallet, setWalletOpen } = useRill();
  const {
    contacts,
    upsert,
    remove,
    error: storageError,
  } = useContacts(wallet.account);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <PageHeading
        title="The people you pay."
        subtitle="Keep your contributors close. Make the next payment easier."
      />
      {!wallet.account ? (
        <div className="empty-state">
          <h2>Your address book starts here.</h2>
          <p className="muted">
            Connect your wallet to save the people you work with.
          </p>
          <button className="primary" onClick={() => setWalletOpen(true)}>
            Connect wallet
          </button>
        </div>
      ) : (
        <div className="workspace-columns">
          <section className="workspace-panel">
            <div className="section-heading">
              <h2>Contacts</h2>
              <span className="count-badge">{contacts.length}</span>
            </div>
            {!contacts.length ? (
              <div className="panel-empty">
                <Users size={28} />
                <h3>A familiar face, a saved address.</h3>
                <p>Add your first contributor using the form.</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <div className="contact-row" key={contact.address}>
                  <span className="avatar">
                    {contact.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{contact.name}</strong>
                    <CopyButton value={contact.address} />
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${contact.name}`}
                    onClick={() => remove(contact.address)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))
            )}
          </section>
          <section className="workspace-panel soft-panel">
            <h2>Add a contributor</h2>
            <form
              className="workspace-form"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                try {
                  if (upsert(address, name)) {
                    setName("");
                    setAddress("");
                  }
                } catch (issue) {
                  setError((issue as Error).message);
                }
              }}
            >
              <div className="field">
                <label htmlFor="contact-name">Contact name</label>
                <input
                  id="contact-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex · Design"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="contact-wallet">Wallet address</label>
                <input
                  id="contact-wallet"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              {error || storageError ? (
                <ErrorNotice message={error || storageError} />
              ) : null}
              <button className="primary full">
                Save contact <ArrowUpRight size={17} />
              </button>
              <p className="small muted form-footnote">
                Saved only in this browser, for your connected wallet. Adding
                the same address updates its name.
              </p>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
