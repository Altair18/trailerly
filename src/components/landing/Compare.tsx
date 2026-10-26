import { CHECKOUT_LIVE, fromPrice } from "./pricing";

// Compared by category, not by name. Figures are typical public prices checked in October 2026.

const ROWS = [
  { k: "How you work", agency: "Brief, calls and revision rounds", dfy: "Send a brief, a designer makes it", us: "Self-serve: paste a link, upload a recording" },
  { k: "Turnaround", agency: "2 to 10 business days", dfy: "About 24 hours", us: "Minutes" },
  { k: "Price for header + search", agency: "€249 to €1,200", dfy: "$149", us: fromPrice() },
  { k: "Footage", agency: "Your recordings, custom motion design", dfy: "Your materials", us: "Your recording, with dead time trimmed and private data blurred" },
  { k: "Apple rules", agency: "Checked by hand", dfy: "Checked by hand", us: "Checked on every video, per slot" },
];

export function Compare() {
  return (
    <section id="compare" className="wrap lp-sec">
      <div className="lp-head">
        <div>
          <h2 className="disp lp-h2">Agency results without the agency wait</h2>
          <p className="mu">How Trailerly compares with the usual ways to get iOS 27 store videos made.</p>
        </div>
      </div>
      <div className="lp-cmp" role="table" aria-label="Comparison of agency, done-for-you service and Trailerly">
        <div className="lp-cmp-row lp-cmp-head" role="row">
          <span role="columnheader" className="lp-cmp-k" />
          <span role="columnheader"><i style={{ background: "var(--purple)" }} />Agency</span>
          <span role="columnheader"><i style={{ background: "var(--yel)" }} />Done-for-you service</span>
          <span role="columnheader" className="us"><i style={{ background: "var(--pink)" }} />Trailerly</span>
        </div>
        {ROWS.map((r) => (
          <div key={r.k} className="lp-cmp-row" role="row">
            <span role="rowheader" className="lp-cmp-k">{r.k}</span>
            <span role="cell" data-label="Agency">{r.agency}</span>
            <span role="cell" data-label="Done-for-you">{r.dfy}</span>
            <span role="cell" data-label="Trailerly" className="us">{r.us}</span>
          </div>
        ))}
      </div>
      <p className="mu" style={{ margin: "12px 0 0", fontSize: 13 }}>
        Agency and service figures are typical public prices from October 2026.
        {!CHECKOUT_LIVE && " Trailerly drafts are free to make today; paid full-size downloads are coming soon."}
      </p>
    </section>
  );
}
