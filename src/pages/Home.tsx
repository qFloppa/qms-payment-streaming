import { ArrowRight, ArrowUpRight, Users, Link } from "lucide-react";
import { StreamPreview } from "../components/StreamPreview";

export function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            A payment.
            <br />A little<br /> at a time.
          </h1>
          <p className="hero-description">
            Fund your contributors. Let payments unlock
            <br className="desktop-break" /> as time passes. Everyone withdraws
            <br className="desktop-break" /> when they’re ready.
          </p>
          <a className="primary trial-button" href="#/create?trial=1">
            Try a 1-minute stream <ArrowUpRight size={17} />
          </a>
          <p className="small trial-caption">
            1 test QMS. Your own wallet. One minute.
          </p>
          <a className="text-link create-link" href="#/create">
            Create a stream for someone <ArrowRight size={17} />
          </a>
        </div>
        <StreamPreview />
      </section>
      <div className="workspace-actions home-actions">
        <a href="#/batch">
          <span className="action-symbol"><Users size={20} /></span>
          <div>
            <strong>Pay your team</strong>
            <span>Up to 25 contributors. One transaction.</span>
          </div>
          <ArrowUpRight size={18} />
        </a>
        <a href="#/request">
          <span className="action-symbol"><Link size={20} /></span>
          <div>
            <strong>Get paid with a link</strong>
            <span>Share a payment request with your client.</span>
          </div>
          <ArrowUpRight size={18} />
        </a>
      </div>
      <section className="onboarding">
        <div className="onboarding-heading"><h2>Three small steps. A real onchain payment.</h2><span>Your first stream</span></div>
        <div className="steps">
          {[
            ["01", "Connect your wallet", "Get free test QMS from the faucet."],
            ["02", "Start the minute", "Your QMS unlocks over 60 seconds."],
            ["03", "Withdraw it back", "See every transaction on QMSScan."],
          ].map(([number, title, description]) => (
            <div key={number}>
              <span className="step-number">{number}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
