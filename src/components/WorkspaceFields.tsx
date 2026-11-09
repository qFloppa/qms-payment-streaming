import { useId, useState } from "react";
import { useRill } from "../context/RillContext";
import { useContacts } from "../hooks/useContacts";
import { durationLabel } from "../lib/domain";

export function DurationSelect({
  value,
  onChange,
  label = "Payout duration",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const id = useId();
  const options = [60, 3600, 86400, 604800, 2592000, 7776000];
  const [custom, setCustom] = useState(!options.includes(value));
  return (
    <div className="field duration-select">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={custom ? "custom" : value}
        onChange={(event) => {
          const selected = event.target.value;
          setCustom(selected === "custom");
          if (selected !== "custom") onChange(Number(selected));
        }}
      >
        {options.map((seconds) => (
          <option key={seconds} value={seconds}>
            {durationLabel(seconds)}
          </option>
        ))}
        <option value="custom">Custom duration</option>
      </select>
      {custom ? (
        <label className="custom-duration">
          Duration in seconds
          <input
            type="number"
            min="60"
            max="31536000"
            value={value || ""}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </label>
      ) : null}
    </div>
  );
}

export function ContactPicker({
  onSelect,
}: {
  onSelect: (address: string) => void;
}) {
  const { wallet } = useRill();
  const { contacts } = useContacts(wallet.account);
  const id = useId();
  if (!contacts.length) return null;
  return (
    <div className="contact-picker">
      <label htmlFor={id}>Saved recipient</label>
      <select
        id={id}
        value=""
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">Choose a contact…</option>
        {contacts.map((contact) => (
          <option key={contact.address} value={contact.address}>
            {contact.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function V2Notice() {
  return (
    <div className="notice">
      <span>
        This deployment supports individual streams. Deploy Rill V2 to add names
        and batch payouts.
      </span>
      <a className="text-link" href="#/setup">
        Set up V2 →
      </a>
    </div>
  );
}
