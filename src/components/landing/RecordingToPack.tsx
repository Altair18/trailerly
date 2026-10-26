import Link from "next/link";

// One recording on the left fans out into the pack tiles on the right. Pure CSS motion, staggered by --i.

const OUTPUTS: { label: string; spec: string; bg: string; ratio: string; soon?: boolean }[] = [
  { label: "App Store preview", spec: "886×1920 · real footage", bg: "linear-gradient(160deg,#FF2E88,#9D7BFF)", ratio: "9 / 16" },
  { label: "Header video", spec: "21:9 loop · iOS 27", bg: "linear-gradient(110deg,#38D9FF,#2EE6A6)", ratio: "21 / 9" },
  { label: "Search video", spec: "3:2 · works muted", bg: "linear-gradient(140deg,#FFE135,#FF7A1A)", ratio: "3 / 2" },
  { label: "Stills", spec: "header · search · universal", bg: "linear-gradient(140deg,#9D7BFF,#38D9FF)", ratio: "3 / 2" },
  { label: "A/B variants", spec: "B and C for Product Page tests", bg: "linear-gradient(180deg,#FF5A4E,#FFE135)", ratio: "3 / 2" },
  { label: "5 social ads", spec: "9:16 · coming soon", bg: "linear-gradient(180deg,#26262F,#18181F)", ratio: "9 / 16", soon: true },
];

export function RecordingToPack() {
  return (
    <section id="pack" className="wrap lp-sec">
      <div className="lp-head">
        <div>
          <h2 className="disp lp-h2">One recording in. The whole pack out.</h2>
          <p className="mu">Record 20 to 60 seconds of your app. Each video is cut from that footage and sized for its slot.</p>
        </div>
        <Link className="btn btn-ghost" href="/packs/new">Start a pack</Link>
      </div>
      <div className="lp-r2p">
        <div className="lp-rec" aria-label="Your screen recording" role="img">
          <div className="lp-rec-phone">
            <div className="kb flow" style={{ backgroundImage: "linear-gradient(170deg,#18181F,#2B1440,#0B2A2A)" }} />
            <div className="lp-rec-ui" aria-hidden="true">
              <span className="lp-rec-dot" />
              <span className="mono">REC 0:42</span>
            </div>
            <div className="lp-rec-rows" aria-hidden="true">
              {[70, 45, 85, 55, 65].map((w, k) => <i key={k} style={{ width: `${w}%`, animationDelay: `${k * 0.3}s` }} />)}
            </div>
          </div>
          <p className="mono">your-recording.mov</p>
        </div>
        <div className="lp-flowline" aria-hidden="true"><span /></div>
        <ul className="lp-outs">
          {OUTPUTS.map((o, k) => (
            <li key={o.label} className={o.soon ? "soon" : undefined} style={{ ["--i" as string]: k }}>
              <div className="lp-out-media" style={{ aspectRatio: o.ratio, backgroundImage: o.bg }}>
                {o.soon && <span className="lp-soon">Coming soon</span>}
              </div>
              <b>{o.label}</b>
              <span className="mono mu">{o.spec}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
