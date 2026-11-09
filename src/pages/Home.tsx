import { ArrowRight, ArrowUpRight, Users, Link2 } from "lucide-react";

export function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            A payment.
            <br />A little at a time.
          </h1>
          <p className="hero-description">
            Fund your contributors. Let payments unlock
            <br className="desktop-break" /> as time passes. Everyone withdraws
            when they’re ready.
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
        <div className="first-minute">
          <div className="row-between">
            <span>Your first minute</span>
            <span className="small muted">Preview</span>
          </div>
          <div className="preview-available">
            <p className="small muted">Available to withdraw</p>
            <p className="hero-amount">
              0.50000 <span>QMS</span>
            </p>
          </div>
          <div className="preview-scale">
            <span>0:00</span>
            <span>0:45 / 1:00</span>
          </div>
          <div
            className="preview-bar"
            aria-label="Example: one quarter withdrawn, one half available, one quarter scheduled"
          >
            <i />
            <i />
            <i />
          </div>
          <div className="preview-legend">
            <div>
              <span>● Withdrawn</span>
              <strong>0.25000</strong>
            </div>
            <div>
              <span>● Available</span>
              <strong>0.50000</strong>
            </div>
            <div>
              <span>● Still scheduled</span>
              <strong>0.25000</strong>
            </div>
          </div>
          <p className="small muted same-wallet">
            Same wallet in. Same wallet out.
          </p>
        </div>
      </section>
      <div className="workspace-actions home-actions">
        <a href="#/batch">
          <Users size={22} />
          <div>
            <strong>Pay your team</strong>
            <span>Fund up to 25 contributors in one transaction.</span>
          </div>
          <ArrowUpRight size={18} />
        </a>
        <a href="#/request">
          <Link2 size={22} />
          <div>
            <strong>Get paid with a link</strong>
            <span>Share a payment request with your client.</span>
          </div>
          <ArrowUpRight size={18} />
        </a>
      </div>
      <section className="onboarding">
        <h2>Three small steps. A real onchain payment.</h2>
        <div className="steps">
          {[
            ["01", "Connect your wallet", "Get free test QMS from the faucet."],
            ["02", "Start the minute", "Your QMS unlocks over 60 seconds."],
            ["03", "Withdraw it back", "See every transaction on QMSScan."],
          ].map(([number, title, description]) => (
            <div key={number}>
              <p>
                <span>{number}</span>
                {title}
              </p>
              <p className="small muted">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
