import type { CSSProperties } from "react";

const iconFiles = {
  home: ["home-01-solid-rounded.svg", "home-01-stroke-rounded.svg"],
  orders: ["navigation-05-stroke-rounded.svg", "navigation-05-stroke-rounded.svg"],
  activity: ["bookmark-02-solid-rounded.svg", "bookmark-02-stroke-rounded.svg"],
  cart: ["shopping-cart-02-stroke-rounded.svg", "shopping-cart-02-stroke-rounded.svg"],
  support: ["bubble-chat-solid-rounded.svg", "bubble-chat-stroke-rounded.svg"],
  location: ["pin-stroke-rounded.svg", "pin-stroke-rounded.svg"],
  profile: ["user-solid-rounded.svg", "user-stroke-rounded.svg"],
  search: ["search-01-solid-rounded.svg", "search-01-stroke-rounded.svg"],
  settings: ["settings-03-stroke-rounded.svg", "settings-03-stroke-rounded.svg"],
  notification: ["notification-01-stroke-rounded.svg", "notification-01-stroke-rounded.svg"],
  close: ["cancel-01-stroke-rounded.svg", "cancel-01-stroke-rounded.svg"],
  back: ["arrow-left-02-stroke-rounded.svg", "arrow-left-02-stroke-rounded.svg"],
  arrow: ["arrow-right-02-stroke-rounded.svg", "arrow-right-02-stroke-rounded.svg"],
  arrowShort: ["arrow-right-01-stroke-rounded.svg", "arrow-right-01-stroke-rounded.svg"],
  help: ["help-circle-stroke-rounded.svg", "help-circle-stroke-rounded.svg"],
  plus: ["plus-sign-stroke-rounded.svg", "plus-sign-stroke-rounded.svg"],
  delete: ["delete-01-stroke-rounded.svg", "delete-01-stroke-rounded.svg"],
  withdraw: ["arrow-down-02-stroke-rounded.svg", "arrow-down-02-stroke-rounded.svg"],
  arrowDown: ["arrow-down-01-stroke-rounded.svg", "arrow-down-01-stroke-rounded.svg"],
  wallet: ["wallet-minimal-stroke-rounded.svg", "wallet-minimal-stroke-rounded.svg"],
  safeDelivery: ["safe-delivery-01-stroke-rounded.svg", "safe-delivery-01-stroke-rounded.svg"],
  safety: ["police-badge-stroke-rounded.svg", "police-badge-stroke-rounded.svg"],
  inbox: ["mail-01-stroke-rounded.svg", "mail-01-stroke-rounded.svg"],
  readAll: ["tick-double-01-stroke-rounded.svg", "tick-double-01-stroke-rounded.svg"],
  clock: ["clock-01-stroke-rounded.svg", "clock-01-stroke-rounded.svg"],
  calendar: ["calendar-04-stroke-rounded.svg", "calendar-04-stroke-rounded.svg"],
  appearance: ["paint-brush-04-stroke-rounded.svg", "paint-brush-04-stroke-rounded.svg"],
  accounts: ["user-solid-rounded.svg", "user-stroke-rounded.svg"],
  legal: ["book-open-01-stroke-rounded.svg", "book-open-01-stroke-rounded.svg"],
  invite: ["share-04-stroke-rounded.svg", "share-04-stroke-rounded.svg"],
  folder: ["folder-01-stroke-rounded.svg", "folder-01-stroke-rounded.svg"],
  briefcase: ["briefcase-01-stroke-rounded.svg", "briefcase-01-stroke-rounded.svg"],
  creditCard: ["credit-card-pos-stroke-rounded.svg", "credit-card-pos-stroke-rounded.svg"],
  bankTransfer: ["landmark-stroke-rounded.svg", "landmark-stroke-rounded.svg"],
  filters: ["sliders-horizontal-stroke-rounded.svg", "sliders-horizontal-stroke-rounded.svg"],
  star: ["star-stroke-rounded.svg", "star-stroke-rounded.svg"],
  language: ["language-circle-stroke-rounded.svg", "language-circle-stroke-rounded.svg"],
} as const;

export type AppIconName = keyof typeof iconFiles;

export function AppIcon({
  name,
  active = false,
  size = 22,
  className,
}: {
  name: AppIconName;
  active?: boolean;
  size?: number;
  className?: string;
}) {
  if (name === "orders" && active) {
    return <svg aria-hidden="true" className={`app-icon custom-icon ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M13.6929 7.47664L10.9605 8.60175C10.1362 8.94115 9.72411 9.11084 9.41748 9.41748C9.11084 9.72411 8.94115 10.1362 8.60175 10.9605L7.47664 13.6929C6.63274 15.7424 6.21079 16.7671 6.72185 17.2782C7.2329 17.7892 8.25764 17.3673 10.3071 16.5234L13.0395 15.3982C13.8638 15.0589 14.2759 14.8892 14.5825 14.5825C14.8892 14.2759 15.0589 13.8638 15.3982 13.0395L16.5234 10.3071C17.3673 8.25764 17.7892 7.2329 17.2782 6.72185C16.7671 6.21079 15.7424 6.63274 13.6929 7.47664Z" fill="var(--page)"/><circle cx="12" cy="12" r="1" fill="var(--page)"/></svg>;
  }
  if (name === "cart") {
    if (!active) {
      const style: CSSProperties = { width: size, height: size, WebkitMaskImage: `url("/icons/hugeroundedicons/${iconFiles.cart[1]}")`, maskImage: `url("/icons/hugeroundedicons/${iconFiles.cart[1]}")` };
      return <span aria-hidden="true" className={`app-icon ${className ?? ""}`} style={style} />;
    }
    return <svg aria-hidden="true" className={"app-icon custom-icon " + (className ?? "")} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 16L16.7201 15.2733C19.4486 15.046 20.0611 14.45 20.3635 11.7289L21 6H7L8 16Z" fill="currentColor" stroke="none"/><path d="M8 16L16.7201 15.2733C19.4486 15.046 20.0611 14.45 20.3635 11.7289L21 6"/><path d="M6 6H22"/><circle cx="6" cy="20" r="2" fill="currentColor"/><circle cx="17" cy="20" r="2" fill="currentColor"/><path d="M8 20L15 20"/><path d="M2 2H2.966C3.91068 2 4.73414 2.62459 4.96326 3.51493L7.93852 15.0765C8.08887 15.6608 7.9602 16.2797 7.58824 16.7616L6.63213 18"/></svg>;
  }
  const file = iconFiles[name][active ? 0 : 1];
  const style: CSSProperties = {
    width: size,
    height: size,
    WebkitMaskImage: `url("/icons/hugeroundedicons/${file}")`,
    maskImage: `url("/icons/hugeroundedicons/${file}")`,
  };

  return <span aria-hidden="true" className={`app-icon ${className ?? ""}`} style={style} />;
}
