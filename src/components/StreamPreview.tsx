import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { RillMark } from "./RillMark";

const initialTime = 45_000;
const duration = 60_000;
const ticks = Array.from({ length: 60 }, (_, index) => index);

/** An illustrative payment, isolated from wallet state and confirmed balances. */
export function StreamPreview() {
  const region = useRef<HTMLElement>(null);
  const [elapsed, setElapsed] = useState(initialTime);
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const complete = elapsed >= duration;
  const running = playing && !complete && inView && pageVisible;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(region.current!);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { if (motion.matches) setPlaying(false); };
    const visibilityChanged = () => setPageVisible(!document.hidden);
    motion.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      setElapsed((time) => Math.min(duration, time + delta));
    }, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  const available = elapsed / duration - 0.25;
  const scheduled = 1 - elapsed / duration;
  const seconds = Math.floor(elapsed / 1000);
  const controlLabel = complete ? "Replay preview" : playing ? "Pause preview" : "Resume preview";
  const ControlIcon = complete ? RotateCcw : playing ? Pause : Play;

  return (
    <section className="stream-preview" ref={region} data-playing={running} aria-label="Illustrative stream preview">
      <div className="preview-image">
        <img src={`${import.meta.env.BASE_URL}stream-water.jpg`} alt="" width="1400" height="933" fetchPriority="high" />
        <div className="preview-image-signature"><RillMark /><span>Always in flow.</span></div>
      </div>
      <div className="preview-content">
        <div className="row-between preview-heading">
          <span>Your first minute</span>
          <span className="preview-tag">Preview <i /></span>
        </div>
        <p className="sr-only">Illustrative values only. This preview does not create a transaction.</p>
        <div className="preview-available">
          <p>Available to withdraw</p>
          <p className="hero-amount"><span data-testid="preview-amount">{available.toFixed(5)}</span><span className="amount-unit">QMS</span></p>
        </div>
        <div className="preview-ticks" aria-hidden="true">
          {ticks.map((index) => <i key={index} className={index < 15 ? "withdrawn" : (index + 1) * 1000 <= elapsed ? "available" : "scheduled"} />)}
        </div>
        <div className="preview-scale">
          <span>0:00</span>
          <span><span aria-label="Preview elapsed time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span><span className="muted"> / 1:00</span></span>
        </div>
        <dl className="preview-legend">
          <div><dt><i className="withdrawn" />Withdrawn</dt><dd>0.25000</dd></div>
          <div><dt><i className="available" />Available</dt><dd>{available.toFixed(5)}</dd></div>
          <div><dt><i className="scheduled" />Still scheduled</dt><dd>{scheduled.toFixed(5)}</dd></div>
        </dl>
        <div className="preview-bottom">
          <span>Same wallet in. Same wallet out.</span>
          <button className="icon-button preview-control" type="button" aria-label={controlLabel} title={controlLabel} onClick={() => {
            if (complete) { setElapsed(initialTime); setPlaying(true); }
            else setPlaying((value) => !value);
          }}><span><ControlIcon size={13} /></span></button>
        </div>
      </div>
    </section>
  );
}
