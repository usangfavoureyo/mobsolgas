"use client";

import { useState } from "react";
import styles from "./admin.module.css";

const navigation = [
  { label: "Overview", icon: "▦" },
  { label: "Orders", icon: "↗", badge: "—" },
  { label: "Dispatch", icon: "⌁" },
  { label: "Products", icon: "▤" },
  { label: "Service zones", icon: "◎" },
  { label: "Inventory", icon: "▥" },
  { label: "Customers", icon: "♙" },
];

export default function AdminPage() {
  const [section, setSection] = useState("Overview");

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <a href="/" className={styles.brand} aria-label="Mobsol Gas home">
          <span className={styles.brandMark}>M</span>
          <span>Mobsol <small>OPERATIONS</small></span>
        </a>
        <p className={styles.navLabel}>WORKSPACE</p>
        <nav className={styles.nav} aria-label="Operations navigation">
          {navigation.map((item) => (
            <button key={item.label} onClick={() => setSection(item.label)} className={`${styles.navItem} ${section === item.label ? styles.active : ""}`} aria-current={section === item.label ? "page" : undefined}>
              <span className={styles.navIcon}>{item.icon}</span><span>{item.label}</span>{item.badge && <small>{item.badge}</small>}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.connection}><span className={styles.connectionDot} /><span><b>Backend not connected</b><small>Waiting for data source</small></span></div>
          <a href="/" className={styles.backLink}>← <span>Customer app</span></a>
          <div className={styles.user}><span className={styles.avatar}>M</span><span><b>Mobsol team</b><small>Operations workspace</small></span><span className={styles.more}>···</span></div>
        </div>
      </aside>

      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>Mobsol Gas <span>/</span> Operations</div>
          <div className={styles.topActions}><span className={styles.environment}><i /> Preview workspace</span><button className={styles.helpButton} aria-label="Help">?</button></div>
        </header>

        <div className={styles.content}>
          <div className={styles.headingRow}>
            <div><p className={styles.eyebrow}>OPERATIONS</p><h1>{section}</h1><p className={styles.subtitle}>A clear view of your gas delivery operation.</p></div>
            <button className={styles.dateButton} disabled><span>◷</span> Today <span className={styles.chevron}>⌄</span></button>
          </div>

          <div className={styles.notice} role="status">
            <span className={styles.noticeIcon}>i</span>
            <div><b>Connect your backend to see live operations</b><p>This workspace is ready for real orders, delivery activity, and business metrics. No sample data is shown.</p></div>
            <span className={styles.previewTag}>SETUP</span>
          </div>

          <div className={styles.metrics}>
            {["Orders today", "In progress", "Completed", "Revenue today"].map((label) => <article key={label} className={styles.metric}><div><span>{label}</span><span className={styles.metricMark}>↗</span></div><strong>—</strong><small>Available when connected</small></article>)}
          </div>

          <div className={styles.panelGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>{section === "Overview" ? "Recent orders" : `${section} activity`}</h2><p>Monitor requests as they come in.</p></div><button className={styles.textButton} onClick={() => setSection("Orders")}>View orders <span>→</span></button></div>
              <div className={styles.emptyState}><span className={styles.emptyIcon}>▤</span><b>No live orders yet</b><p>New customer orders will appear here once the backend is connected.</p></div>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Delivery activity</h2><p>Dispatch status across your service area.</p></div><span className={styles.liveLabel}><i /> LIVE</span></div>
              <div className={styles.mapPlaceholder}><div className={styles.mapGrid} /><span className={styles.mapPin}>⌖</span><span className={styles.mapCaption}>Activity will appear when dispatch is connected</span></div>
              <div className={styles.panelFoot}><span>Service area</span><b>Abuja <span>⌄</span></b></div>
            </section>
          </div>

          <div className={styles.bottomGrid}>
            <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Setup checklist</h2><p>Get your operations workspace ready.</p></div><span className={styles.progress}>0 / 3</span></div><div className={styles.checkRow}><span className={styles.check}>1</span><span><b>Connect order data</b><small>Sync customer orders into the dashboard</small></span><span className={styles.pending}>PENDING</span></div><div className={styles.checkRow}><span className={styles.check}>2</span><span><b>Configure service zones</b><small>Set delivery coverage and fees</small></span><span className={styles.pending}>PENDING</span></div><div className={styles.checkRow}><span className={styles.check}>3</span><span><b>Add your team</b><small>Give staff the access they need</small></span><span className={styles.pending}>PENDING</span></div></section>
            <section className={`${styles.panel} ${styles.shortcutPanel}`}><div><p className={styles.eyebrow}>QUICK ACCESS</p><h2>Keep the operation moving</h2><p>Manage the catalog and delivery setup from one place.</p></div><button onClick={() => setSection("Products")}>Product catalog <span>→</span></button><button onClick={() => setSection("Service zones")}>Service zones <span>→</span></button><button onClick={() => setSection("Inventory")}>Inventory <span>→</span></button></section>
          </div>
          <footer className={styles.footer}>Mobsol Gas Operations <span>•</span> Preview workspace</footer>
        </div>
      </section>
    </main>
  );
}
