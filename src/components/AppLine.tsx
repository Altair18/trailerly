export function AppLine({ app, step }: { app: { name: string; icon_url: string | null } | null; step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      {app?.icon_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={app.icon_url} alt="" width={28} height={28} style={{ borderRadius: 8 }} />
      ) : (
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(150deg,#B8F23A,#2EE6A6)" }} />
      )}
      <span style={{ fontWeight: 600 }}>{app?.name ?? "Your app"}</span>
      <span className="mu">· step {step} of 8</span>
    </div>
  );
}

export function PageHead({ app, step, title, children }: { app: { name: string; icon_url: string | null } | null; step: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="rise" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
      <div>
        <AppLine app={app} step={step} />
        <h1 className="disp h1">{title}</h1>
      </div>
      {children && <div className="mu" style={{ margin: 0, maxWidth: 440, fontSize: 16 }}>{children}</div>}
    </div>
  );
}
