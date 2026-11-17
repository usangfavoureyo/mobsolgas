"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { useThemePreference, type ThemePreference } from "@/components/theme-provider";

type Tab = "Home" | "Orders" | "Activity" | "Cart" | "Support" | "Profile";
type Product = { kg: 6 | 12 | 22; detail: string };
type AppNotification = { id: number; title: string; body: string; time: string; read: boolean };
const initialNotifications: AppNotification[] = [
  { id: 1, title: "Welcome to Mobsol Gas", body: "Choose a cylinder size and we’ll bring a full one to your door while collecting your empty Mobsol cylinder.", time: "Today", read: false },
  { id: 2, title: "Check delivery availability", body: "Add your Abuja address to see whether Mobsol delivery is available in your area.", time: "Yesterday", read: false },
  { id: 3, title: "Your account is ready", body: "You can manage your preferences and get help from your Profile page at any time.", time: "Earlier", read: true },
];
const products: Product[] = [
  { kg: 6, detail: "For compact kitchens" },
  { kg: 12, detail: "Everyday family size" },
  { kg: 22, detail: "For busy homes" },
];
type CatalogProduct = { id: string; weight_kg: number; available: boolean };
type CustomerOrder = { id: string; order_number: number; recipient_name: string; recipient_phone: string; gas_subtotal_kobo: number; delivery_fee_kobo: number; total_kobo: number; payment_status: string; payment_method: string | null; delivery_status: string; created_at: string; delivery_address_snapshot: string; delivery_coordinates: { latitude: number; longitude: number } | null; order_items: { weight_kg_snapshot: number; quantity: number }[]; demo?: boolean };
type AccountIdentity = { email: string; name: string };
const demoOrders: CustomerOrder[] = [
  { id: "demo-active-order", order_number: 4208, recipient_name: "Favour Usang", recipient_phone: "", gas_subtotal_kobo: 2400000, delivery_fee_kobo: 200000, total_kobo: 2600000, payment_status: "paid", payment_method: "paystack", delivery_status: "on_the_way", created_at: "2026-11-16T10:20:00+01:00", delivery_address_snapshot: "15 Adetokunbo Ademola Crescent, Wuse 2, Abuja", delivery_coordinates: { latitude: 9.0765, longitude: 7.3986 }, order_items: [{ weight_kg_snapshot: 12, quantity: 1 }], demo: true },
  { id: "demo-delivered-order", order_number: 4172, recipient_name: "Favour Usang", recipient_phone: "", gas_subtotal_kobo: 1200000, delivery_fee_kobo: 200000, total_kobo: 1400000, payment_status: "paid", payment_method: "paystack", delivery_status: "delivered", created_at: "2026-11-12T13:33:00+01:00", delivery_address_snapshot: "41 Ososami Road, Wuse 2, Abuja", delivery_coordinates: { latitude: 9.0642, longitude: 7.4869 }, order_items: [{ weight_kg_snapshot: 6, quantity: 1 }], demo: true },
  { id: "demo-cancelled-order", order_number: 4119, recipient_name: "Favour Usang", recipient_phone: "", gas_subtotal_kobo: 0, delivery_fee_kobo: 0, total_kobo: 0, payment_status: "cancelled", payment_method: "paystack", delivery_status: "cancelled", created_at: "2026-10-23T10:22:00+01:00", delivery_address_snapshot: "Mobsol Demo Address, Garki, Abuja", delivery_coordinates: { latitude: 9.0321, longitude: 7.4863 }, order_items: [{ weight_kg_snapshot: 6, quantity: 1 }], demo: true },
];
const googleMapsEmbedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
function getOrderMapUrl(coordinates: CustomerOrder["delivery_coordinates"]) {
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) return null;
  const { latitude, longitude } = coordinates;
  if (googleMapsEmbedKey) return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsEmbedKey)}&q=${latitude},${longitude}&zoom=15`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.016}%2C${latitude - 0.011}%2C${longitude + 0.016}%2C${latitude + 0.011}&layer=mapnik`;
}
const navigation: { label: Tab; icon: AppIconName }[] = [
  { label: "Home", icon: "home" }, { label: "Orders", icon: "orders" }, { label: "Activity", icon: "activity" },
  { label: "Cart", icon: "cart" }, { label: "Support", icon: "support" },
];
const appTabs: Tab[] = ["Home", "Orders", "Activity", "Cart", "Support", "Profile"];
type RouteSnapshot = { tab: Tab; panel: string; order: string; step: number };
function readRouteSnapshot(): RouteSnapshot {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab") as Tab | null;
  return {
    tab: requestedTab && appTabs.includes(requestedTab) ? requestedTab : "Home",
    panel: params.get("panel") || "",
    order: params.get("order") || "",
    step: Math.min(3, Math.max(1, Number(params.get("step")) || 1)),
  };
}
function routeSnapshotKey(route: RouteSnapshot) { return `${route.tab}|${route.panel}|${route.order}|${route.step}`; }
function routeSnapshotUrl(route: RouteSnapshot) {
  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  if (route.tab === "Home") url.searchParams.delete("tab"); else url.searchParams.set("tab", route.tab);
  if (route.panel) url.searchParams.set("panel", route.panel); else url.searchParams.delete("panel");
  if (route.order) url.searchParams.set("order", route.order); else url.searchParams.delete("order");
  if (route.panel === "checkout" || route.panel.startsWith("nested-") || route.panel === "auth") url.searchParams.set("step", String(route.step)); else url.searchParams.delete("step");
  return `${url.pathname}${url.search}${url.hash}`;
}
function routeSnapshotDepth(route: RouteSnapshot) { return (route.tab === "Home" ? 0 : 1) + (route.panel ? 1 : 0) + (route.panel.startsWith("nested-") || route.panel === "settings-appearance" ? 1 : 0) + (route.order ? 1 : 0); }
function SheetDragHandle({ label, onDismiss, className = "sheet-handle" }: { label: string; onDismiss: () => void; className?: string }) {
  const drag = useRef<{ pointerId: number; startY: number; lastY: number; lastAt: number; velocity: number; sheet: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetPosition = (sheet: HTMLElement) => {
    sheet.style.transition = "transform 260ms cubic-bezier(.22,.61,.36,1)";
    sheet.style.transform = "translateY(0px)";
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sheet = event.currentTarget.closest<HTMLElement>(".bottom-sheet");
    if (!sheet) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    drag.current = { pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, lastAt: performance.now(), velocity: 0, sheet };
    sheet.style.transition = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const now = performance.now();
    state.velocity = (event.clientY - state.lastY) / Math.max(1, now - state.lastAt);
    state.lastY = event.clientY;
    state.lastAt = now;
    state.sheet.style.transform = `translateY(${Math.max(0, event.clientY - state.startY)}px)`;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.startY;
    if (event.currentTarget.hasPointerCapture(state.pointerId)) event.currentTarget.releasePointerCapture(state.pointerId);
    drag.current = null;
    if (Math.abs(delta) > 8) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 450);
    }
    if (delta > 110 || (delta > 32 && state.velocity > .72)) {
      state.sheet.style.transition = "transform 280ms cubic-bezier(.22,.61,.36,1)";
      state.sheet.style.transform = `translateY(${Math.max(state.sheet.getBoundingClientRect().height, delta + 120)}px)`;
      closeTimer.current = setTimeout(() => { state.sheet.style.transform = ""; state.sheet.style.transition = ""; closeTimer.current = null; onDismiss(); }, 280);
    } else resetPosition(state.sheet);
  };
  const onPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(state.pointerId)) event.currentTarget.releasePointerCapture(state.pointerId);
    drag.current = null;
    resetPosition(state.sheet);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  return <button type="button" className={className} aria-label={label} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onDismiss(); }}><i/></button>;
}
function Cylinder({ size }: { size: number }) {
  return <span className="cylinder-art" aria-hidden="true"><i className="cylinder-valve" /><i className="cylinder-neck" /><i className="cylinder-body"><b>{size}</b><small>KG</small></i><i className="cylinder-foot" /></span>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("Home");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [locationOpen, setLocationOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<1 | 2 | 3>(1);
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [account, setAccount] = useState<AccountIdentity | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<ThemePreference>("system");
  const [activityFiltersOpen, setActivityFiltersOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletNotice, setWalletNotice] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [safetyPreferences, setSafetyPreferences] = useState({ pin: true, audio: false, emergency: false, sharing: false });
  const [cartOpen, setCartOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [swipedNotificationId, setSwipedNotificationId] = useState<number | null>(null);
  const [notificationSwipeDirection, setNotificationSwipeDirection] = useState<"delete" | "read" | null>(null);
  const [undoNotification, setUndoNotification] = useState<{ items: AppNotification[]; index: number; message: string } | null>(null);
  const notificationTouchX = useRef<{ x: number; y: number } | null>(null);
  const notificationSwipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [contactEntryOpen, setContactEntryOpen] = useState(false);
  const [manualContactOpen, setManualContactOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [payerPickerOpen, setPayerPickerOpen] = useState(false);
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
  const [deliveryTiming, setDeliveryTiming] = useState<"soon" | "later">("soon");
  const [recipient, setRecipient] = useState<"self" | "other">("self");
  const [payer, setPayer] = useState<"customer" | "recipient">("customer");
  const [address, setAddress] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [gasRatePerKg, setGasRatePerKg] = useState(1800);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [paymentChannel, setPaymentChannel] = useState<"card" | "bank_transfer" | "cash">("card");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [closingPage, setClosingPage] = useState<string | null>(null);
  const pageCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notice, setNotice] = useState("");
  const [navHidden, setNavHidden] = useState(false);
  const routeReady = useRef(false);
  const [routeHydrated, setRouteHydrated] = useState(false);
  const ignoreRouteSync = useRef<string | null>(null);
  const activeRouteKey = useRef("");
  const { preference, setPreference } = useThemePreference();
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const syncAccount = (user: { email?: string; user_metadata?: Record<string, unknown> } | null) => {
      if (!user?.email) { setAccount(null); return; }
      const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
      setAccount({ email: user.email, name: typeof metadataName === "string" && metadataName.trim() ? metadataName : user.email.split("@")[0] });
      setAuthEmail(user.email);
    };
    void supabase.auth.getSession().then(({ data }) => syncAccount(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => syncAccount(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setPushEnabled(Boolean(subscription))).catch(() => undefined);
  }, []);
  useEffect(() => { if (appearanceSheetOpen) setAppearanceDraft(preference); }, [appearanceSheetOpen, preference]);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const entries = products.filter((product) => (cart[product.kg] || 0) > 0);
  const unreadNotificationCount = notifications.filter((item) => !item.read).length;
  const visibleOrders = customerOrders.length ? customerOrders : demoOrders;
  const closePage = (name: string, close: () => void) => {
    if (pageCloseTimer.current) clearTimeout(pageCloseTimer.current);
    setClosingPage(name);
    pageCloseTimer.current = setTimeout(() => {
      close();
      setClosingPage(null);
      pageCloseTimer.current = null;
    }, 340);
  };
  useEffect(() => () => { if (pageCloseTimer.current) clearTimeout(pageCloseTimer.current); }, []);

  const currentRouteSnapshot = (): RouteSnapshot => {
    let panel = "";
    if (signOutOpen) panel = "signout-confirm";
    else if (authOpen) panel = "auth";
    else if (activityFiltersOpen) panel = "activity-filters";
    else if (appearanceSheetOpen) panel = "settings-appearance";
    else if (settingsOpen) panel = "settings";
    else if (locationOpen && checkoutOpen) panel = "nested-location";
    else if (manualContactOpen) panel = "nested-contact-entry";
    else if (contactEntryOpen) panel = "nested-contact";
    else if (recipientPickerOpen) panel = "nested-recipient";
    else if (payerPickerOpen) panel = "nested-payer";
    else if (schedulePickerOpen) panel = "nested-schedule";
    else if (checkoutOpen) panel = "checkout";
    else if (cartOpen) panel = "cart";
    else if (notificationsOpen) panel = "notifications";
    else if (locationOpen) panel = "location";
    else if (safetyOpen) panel = "safety";
    else if (walletOpen) panel = "wallet";
    return { tab, panel, order: selectedOrderId || "", step: authOpen ? authStep : checkoutStep };
  };

  const applyRouteSnapshot = (route: RouteSnapshot) => {
    setTab(route.tab === "Cart" ? "Home" : route.tab);
    setAuthOpen(route.panel === "auth");
    if (route.panel === "auth") setAuthStep(Math.min(3, route.step) as 1 | 2 | 3);
    setSignOutOpen(route.panel === "signout-confirm");
    setActivityFiltersOpen(route.panel === "activity-filters");
    setLocationOpen(route.panel === "location" || route.panel === "nested-location");
    setSafetyOpen(route.panel === "safety");
    setSettingsOpen(route.panel === "settings" || route.panel === "settings-appearance");
    setAppearanceSheetOpen(route.panel === "settings-appearance");
    if (route.panel === "settings-appearance") setAppearanceDraft(preference);
    setWalletOpen(route.panel === "wallet");
    setCartOpen(route.panel === "cart" || route.panel === "checkout" || route.panel.startsWith("nested-"));
    setNotificationsOpen(route.panel === "notifications");
    setCheckoutOpen(route.panel === "checkout" || route.panel.startsWith("nested-"));
    setCheckoutStep(route.panel === "checkout" ? route.step : 1);
    setRecipientPickerOpen(route.panel === "nested-recipient");
    setContactEntryOpen(route.panel === "nested-contact" || route.panel === "nested-contact-entry");
    setManualContactOpen(route.panel === "nested-contact-entry");
    setPayerPickerOpen(route.panel === "nested-payer");
    setSchedulePickerOpen(route.panel === "nested-schedule");
    setSelectedOrderId(route.order || null);
    setNavHidden(false);
  };

  useEffect(() => {
    const initialRoute = readRouteSnapshot();
    activeRouteKey.current = routeSnapshotKey(initialRoute);
    applyRouteSnapshot(initialRoute);
    routeReady.current = true;
    const splashTimer = window.setTimeout(() => setRouteHydrated(true), 3000);
    const onPopState = () => {
      const route = readRouteSnapshot();
      ignoreRouteSync.current = routeSnapshotKey(route);
      activeRouteKey.current = ignoreRouteSync.current;
      applyRouteSnapshot(route);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.clearTimeout(splashTimer);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!routeReady.current || !routeHydrated) return;
    const route = currentRouteSnapshot();
    const key = routeSnapshotKey(route);
    if (ignoreRouteSync.current === key) { ignoreRouteSync.current = null; return; }
    ignoreRouteSync.current = null;
    if (key === activeRouteKey.current) return;
    const previous = activeRouteKey.current.split("|");
    const previousRoute: RouteSnapshot = { tab: (appTabs.includes(previous[0] as Tab) ? previous[0] as Tab : "Home"), panel: previous[1] || "", order: previous[2] || "", step: Number(previous[3]) || 1 };
    const method = routeSnapshotDepth(route) >= routeSnapshotDepth(previousRoute) ? "pushState" : "replaceState";
    window.history[method]({ mobsolRoute: true }, "", routeSnapshotUrl(route));
    activeRouteKey.current = key;
  }, [routeHydrated, tab, activityFiltersOpen, locationOpen, safetyOpen, settingsOpen, appearanceSheetOpen, walletOpen, cartOpen, notificationsOpen, checkoutOpen, checkoutStep, recipientPickerOpen, contactEntryOpen, manualContactOpen, payerPickerOpen, schedulePickerOpen, selectedOrderId, authOpen, authStep, signOutOpen]);

  useEffect(() => {
    const refreshPricing = () => fetch("/api/pricing", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.products)) setCatalog(data.products); if (Number.isFinite(data?.ratePerKgKobo) && data.ratePerKgKobo > 0) setGasRatePerKg(data.ratePerKgKobo / 100); }).catch(() => undefined);
    void refreshPricing();
    const timer = window.setInterval(() => void refreshPricing(), 15000);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const pricingClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
    const pricingChannel = pricingClient
      ? pricingClient.channel("gas-rate-live-updates")
        .on("postgres_changes", { event: "*", schema: "public", table: "gas_rates" }, () => { void refreshPricing(); })
        .subscribe()
      : null;
    window.addEventListener("focus", refreshPricing);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshPricing); if (pricingChannel && pricingClient) void pricingClient.removeChannel(pricingChannel); };
  }, []);

  useEffect(() => {
    if (tab !== "Orders" && tab !== "Activity" && !selectedOrderId) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    let pollTimer: number | null = null;
    let stopped = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const loadOrders = async () => {
        const response = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const result = await response.json();
        if (!stopped && response.ok && Array.isArray(result.orders)) setCustomerOrders(result.orders);
      };
      void loadOrders();
      pollTimer = window.setInterval(() => { void loadOrders(); }, 20000);
    }).catch(() => undefined);
    return () => { stopped = true; if (pollTimer) window.clearInterval(pollTimer); };
  }, [tab, selectedOrderId]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("payment");
    if (status === "success") setPaymentNotice("Payment confirmed. Your order is being prepared.");
    else if (status === "pending") setPaymentNotice("Payment isn’t confirmed yet. Check your transfer or try again.");
    else if (status === "invalid") setPaymentNotice("We couldn’t verify that payment. Contact Mobsol support before paying again.");
    if (status) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 680px)");
    const syncViewport = () => setIsCompactViewport(query.matches);
    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    let previousY = window.scrollY;
    let directionTravel = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (locationOpen || safetyOpen || settingsOpen || walletOpen || notificationsOpen || cartOpen || checkoutOpen || activityFiltersOpen) {
        setNavHidden(false);
        previousY = y;
        directionTravel = 0;
        return;
      }
      const delta = y - previousY;
      if (y <= 36) {
        setNavHidden(false);
        directionTravel = 0;
      } else {
        directionTravel += delta;
        if (directionTravel >= 30) { setNavHidden(true); directionTravel = 0; }
        else if (directionTravel <= -32) { setNavHidden(false); directionTravel = 0; }
      }
      previousY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab, locationOpen, safetyOpen, settingsOpen, walletOpen, notificationsOpen, cartOpen, checkoutOpen, activityFiltersOpen]);

  useEffect(() => {
    if (locationOpen || safetyOpen || settingsOpen || walletOpen || notificationsOpen || cartOpen || checkoutOpen || activityFiltersOpen) setNavHidden(false);
  }, [tab, locationOpen, safetyOpen, settingsOpen, walletOpen, notificationsOpen, cartOpen, checkoutOpen, activityFiltersOpen]);

  useEffect(() => {
    const hasSheet = locationOpen || appearanceSheetOpen || checkoutOpen || recipientPickerOpen || contactEntryOpen || manualContactOpen || payerPickerOpen || schedulePickerOpen || activityFiltersOpen;
    if (!hasSheet) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previous = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width, rootOverflow: root.style.overflow };
    const lockedPages = Array.from(document.querySelectorAll<HTMLElement>(".profile-page"));
    const pageStyles = lockedPages.map((page) => ({ overflow: page.style.overflow, overflowY: page.style.overflowY }));
    const allSheets = Array.from(document.querySelectorAll<HTMLElement>(".overlay .bottom-sheet"));
    const sheetStyles = allSheets.map((sheet) => ({ overflow: sheet.style.overflow, overflowY: sheet.style.overflowY }));
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    lockedPages.forEach((page) => { page.style.overflow = "hidden"; page.style.overflowY = "hidden"; });
    const activeSheet = allSheets.reduce<HTMLElement | null>((top, sheet) => {
      if (!top) return sheet;
      const zIndex = (element: HTMLElement) => Number.parseInt(window.getComputedStyle(element.closest<HTMLElement>(".overlay") || element).zIndex, 10) || 0;
      return zIndex(sheet) >= zIndex(top) ? sheet : top;
    }, null);
    allSheets.filter((sheet) => sheet !== activeSheet).forEach((sheet) => { sheet.style.overflow = "hidden"; sheet.style.overflowY = "hidden"; });
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      root.style.overflow = previous.rootOverflow;
      lockedPages.forEach((page, index) => { page.style.overflow = pageStyles[index].overflow; page.style.overflowY = pageStyles[index].overflowY; });
      allSheets.forEach((sheet, index) => { sheet.style.overflow = sheetStyles[index].overflow; sheet.style.overflowY = sheetStyles[index].overflowY; });
      window.scrollTo(0, scrollY);
    };
  }, [locationOpen, appearanceSheetOpen, checkoutOpen, recipientPickerOpen, contactEntryOpen, manualContactOpen, payerPickerOpen, schedulePickerOpen]);

  useEffect(() => {
    if (!locationOpen && !safetyOpen && !settingsOpen && !walletOpen && !notificationsOpen && !cartOpen && !checkoutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (appearanceSheetOpen) { setAppearanceSheetOpen(false); return; }
        if (settingsOpen) { setSettingsOpen(false); return; }
        setLocationOpen(false);
        setNotificationsOpen(false);
        setCartOpen(false);
        setCheckoutOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [locationOpen, safetyOpen, settingsOpen, appearanceSheetOpen, walletOpen, notificationsOpen, cartOpen, checkoutOpen]);

  const changeTab = (next: Tab) => {
    if (next === "Cart") { setCartOpen(true); return; }
    setNavHidden(false);
    if (next === tab) window.scrollTo({ top: 0, behavior: "smooth" });
    else { setTab(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  const updateQuantity = (kg: number, delta: number) => {
    setCart((current) => {
      const next = { ...current };
      const quantity = Math.max(0, Math.min(10, (next[kg] || 0) + delta));
      if (quantity) next[kg] = quantity;
      else delete next[kg];
      return next;
    });
  };
  const startCheckout = () => { setCheckoutStep(1); setCheckoutOpen(true); };
  const startPayment = async () => {
    setPaymentBusy(true);
    setNotice("");
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) throw new Error("Mobsol account sign-in is not configured yet.");
      if (!coordinates) throw new Error("Use your current location or choose a map location before continuing.");
      if (!customerEmail.includes("@") || customerName.trim().length < 2 || customerPhone.replace(/\D/g, "").length < 7) {
        throw new Error("Enter your email, full name, and phone number to continue.");
      }
      const supabase = createClient(supabaseUrl, supabaseKey);
      const sessionResult = await supabase.auth.getSession();
      let accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        if (!emailCodeSent) {
          const sent = await supabase.auth.signInWithOtp({ email: customerEmail.trim(), options: { shouldCreateUser: true } });
          if (sent.error) throw new Error(sent.error.message);
          setEmailCodeSent(true);
          setNotice("We sent a sign-in code to your email. Enter it below to continue.");
          return;
        }
        if (emailCode.trim().length < 6) throw new Error("Enter the sign-in code from your email.");
        const verified = await supabase.auth.verifyOtp({ email: customerEmail.trim(), token: emailCode.trim(), type: "email" });
        if (verified.error || !verified.data.session) throw new Error(verified.error?.message || "We couldn’t confirm that code.");
        accessToken = verified.data.session.access_token;
      }
      const items = entries.map((item) => {
        const product = catalog.find((candidate) => candidate.weight_kg === item.kg && candidate.available);
        if (!product) throw new Error("Live cylinder pricing is not available. Please refresh and try again.");
        return { productId: product.id, quantity: cart[item.kg] };
      });
      const orderResponse = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ items, addressText: address, latitude: coordinates.latitude, longitude: coordinates.longitude,
          instructions, recipientName: recipient === "other" ? recipientName : undefined,
          recipientPhone: recipient === "other" ? recipientPhone : undefined, customerName, customerPhone,
          payerParty: payer, paymentMethod: payer === "recipient" || paymentChannel === "cash" ? "cash" : "paystack" }),
      });
      const orderResult = await orderResponse.json();
      if (!orderResponse.ok || !orderResult.order?.id) throw new Error(orderResult.error || "We couldn’t create your order.");
      const historyResponse = await fetch("/api/orders", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const historyResult = await historyResponse.json();
      if (historyResponse.ok && Array.isArray(historyResult.orders)) setCustomerOrders(historyResult.orders);
      if (payer === "recipient") {
        setNotice("Order placed. The recipient can pay on delivery.");
        return;
      }
      if (paymentChannel === "cash") {
        setNotice("Order placed. Pay the dispatcher on delivery.");
        return;
      }
      const paymentResponse = await fetch("/api/payments/initialize", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orderId: orderResult.order.id, channel: paymentChannel }),
      });
      const paymentResult = await paymentResponse.json();
      if (!paymentResponse.ok || !paymentResult.authorizationUrl) throw new Error(paymentResult.error || "We couldn’t start Paystack Checkout.");
      window.location.assign(paymentResult.authorizationUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn’t start checkout. Please try again.");
    } finally { setPaymentBusy(false); }
  };
  const canReview = recipient === "self" || (recipientName.trim().length > 1 && recipientPhone.trim().length >= 7);
  const chooseDeviceContact = async () => {
    type ContactPicker = { select: (properties: string[], options?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
    const contactPicker = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
    if (!contactPicker) { setRecipientPickerOpen(false); setContactEntryOpen(true); return; }
    try {
      const [contact] = await contactPicker.select(["name", "tel"], { multiple: false });
      if (!contact) return;
      setRecipientName(contact.name?.[0] ?? "");
      setRecipientPhone(contact.tel?.[0] ?? "");
      setRecipient("other");
      setRecipientPickerOpen(false);
      setContactEntryOpen(false);
    } catch { setRecipientPickerOpen(false); setContactEntryOpen(true); }
  };
  const saveManualContact = () => {
    if (recipientName.trim().length < 2 || recipientPhone.trim().length < 7) return;
    setRecipient("other");
    setContactEntryOpen(false);
    setManualContactOpen(false);
  };

  const demoContacts = [{ name: "Abas", phone: "+2347011246860", frequent: true }, { name: "Abas", phone: "+2348143442818" }, { name: "Abas Shoe", phone: "+2347054744169" }, { name: "Abas Shoe Guy 2", phone: "+2348083139977" }];
  const matchingContacts = demoContacts.filter((contact) => `${contact.name} ${contact.phone}`.toLowerCase().includes(contactSearch.toLowerCase()));
  const selectContact = (contact: { name: string; phone: string }) => { setRecipientName(contact.name); setRecipientPhone(contact.phone); setRecipient("other"); setContactEntryOpen(false); setRecipientPickerOpen(false); };

  const authClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Mobsol account sign-in is not configured yet.");
    return createClient(url, key);
  };
  const beginSignIn = () => { setAuthEmail(account?.email || customerEmail); setAuthCode(""); setAuthNotice(""); setAuthStep(1); setAuthOpen(true); };
  const requestAuthCode = async () => {
    setAuthNotice("");
    if (!/^\S+@\S+\.\S+$/.test(authEmail.trim())) { setAuthNotice("Enter a valid email address to continue."); return; }
    setAuthBusy(true);
    try {
      const { error } = await authClient().auth.signInWithOtp({ email: authEmail.trim(), options: { shouldCreateUser: true } });
      if (error) throw error;
      setAuthEmail(authEmail.trim()); setAuthCode(""); setAuthStep(2); setAuthNotice("We sent a six-digit sign-in code to your email.");
    } catch (error) { setAuthNotice(error instanceof Error ? error.message : "We couldn’t send your sign-in code."); }
    finally { setAuthBusy(false); }
  };
  const confirmAuthCode = async () => {
    setAuthNotice("");
    if (authCode.trim().length !== 6) { setAuthNotice("Enter the six-digit code from your email."); return; }
    setAuthBusy(true);
    try {
      const { data, error } = await authClient().auth.verifyOtp({ email: authEmail.trim(), token: authCode.trim(), type: "email" });
      if (error || !data.session || !data.user) throw error || new Error("We couldn’t confirm that code.");
      const metadataName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;
      setAccount({ email: data.user.email || authEmail.trim(), name: typeof metadataName === "string" && metadataName.trim() ? metadataName : (data.user.email || authEmail).split("@")[0] });
      setCustomerEmail(data.user.email || authEmail.trim());
      setAuthStep(3); setAuthNotice("");
    } catch (error) { setAuthNotice(error instanceof Error ? error.message : "We couldn’t confirm that code."); }
    finally { setAuthBusy(false); }
  };
  const signInWithGoogle = async () => {
    setAuthNotice(""); setAuthBusy(true);
    try {
      const { error } = await authClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
      if (error) throw error;
    } catch (error) { setAuthNotice(error instanceof Error ? error.message : "Google sign-in is not available yet. Enable Google in Supabase Authentication providers."); setAuthBusy(false); }
  };
  const closeAuth = () => { setAuthOpen(false); setAuthNotice(""); if (authStep === 3) setNotice("You’re signed in. Passkey sign-in can be added when Mobsol enables passkey registration."); };
  const confirmSignOut = async () => {
    try {
      const supabase = authClient();
      if (!supabase) throw new Error("Mobsol account sign-in is not configured yet.");
      const accessToken = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
      const currentSubscription = "serviceWorker" in navigator ? await (await navigator.serviceWorker.ready).pushManager.getSubscription() : null;
      if (currentSubscription) {
        await currentSubscription.unsubscribe();
        if (accessToken) await fetch("/api/push/subscription", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ endpoint: currentSubscription.endpoint }), cache: "no-store" }).catch(() => undefined);
      }
      await supabase.auth.signOut();
      setPushEnabled(false);
      setAccount(null); setCustomerEmail(""); setCustomerName(""); setCustomerPhone(""); setEmailCode(""); setEmailCodeSent(false);
      setSignOutOpen(false); setNotice("You’re signed out.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "We couldn’t sign you out."); setSignOutOpen(false); }
  };
  const togglePushNotifications = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!account) { beginSignIn(); setAuthNotice("Sign in to your Mobsol account first to receive private order updates."); return; }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Push notifications aren’t supported by this browser.");
      if (!pushEnabled) {
        const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked in your browser settings." : "Allow notifications to receive Mobsol order updates.");
      }
      const supabase = authClient();
      if (!supabase) throw new Error("Mobsol account sign-in is not configured yet.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { beginSignIn(); throw new Error("Sign in again to manage notifications."); }
      const registration = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const response = await fetch("/api/push/subscription", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ endpoint: subscription.endpoint }), cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Couldn’t turn off order notifications.");
          await subscription.unsubscribe();
        }
        setPushEnabled(false); setNotice("Order notifications are turned off."); return;
      }
      const keyResponse = await fetch("/api/push/key", { cache: "no-store" });
      const keyResult = await keyResponse.json();
      if (!keyResponse.ok || typeof keyResult.publicKey !== "string") throw new Error(keyResult.error || "Push notifications aren’t configured yet.");
      const normalizedKey = keyResult.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const applicationKey = Uint8Array.from(atob(normalizedKey.padEnd(Math.ceil(normalizedKey.length / 4) * 4, "=")), (character) => character.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey });
      const response = await fetch("/api/push/subscription", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(subscription), cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { await subscription.unsubscribe(); throw new Error(result.error || "Couldn’t save your notification settings."); }
      setPushEnabled(true); setNotice("Order notifications are on for this device.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn’t update notification settings."); }
    finally { setPushBusy(false); }
  };

  return <>{!routeHydrated && <div className="app-loading-splash" role="status" aria-label="Loading Mobsol Gas"><img src="/splash-brand.png" alt="Mobsol Gas"/></div>}<main className={`app-frame${routeHydrated ? " is-route-ready" : " is-route-loading"}`}>
    <aside className="desktop-rail">
      <a className="brand-lockup" href="#home"><span className="brand-mark">M</span><span className="brand-word">MOBSOL<small>GAS · ABUJA</small></span></a>
      <p className="rail-caption">YOUR GAS, ON YOUR TERMS</p>
      <nav className="rail-nav" aria-label="Customer navigation">{navigation.map(({ label, icon }) => <button key={label} className={tab === label ? "rail-link active" : "rail-link"} onClick={() => changeTab(label)}><AppIcon name={icon} active={tab === label} size={21}/><span>{label}</span>{label === "Cart" && itemCount > 0 && <b className="rail-count">{itemCount}</b>}</button>)}</nav>
      <div className="rail-spacer"/><div className="zone-status"><span className="status-pulse"/><span><b>Abuja service</b><small>Check your address for availability</small></span></div>
      <button className={tab === "Profile" ? "rail-profile active" : "rail-profile"} onClick={() => changeTab("Profile")} aria-current={tab === "Profile" ? "page" : undefined}><span className="avatar-guest">G</span><span><b>Guest</b><small>Profile & preferences</small></span><AppIcon name="settings" size={18}/></button>
    </aside>
    <section className="app-content">
      {tab !== "Support" && <header className={navHidden ? "floating-controls controls-hidden" : "floating-controls"}>
        <button type="button" className="location-control" onClick={() => { setNotice(""); setLocationNotice(""); setLocationOpen(true); }} aria-label="Set delivery location"><span className="location-symbol"><AppIcon name="location" size={19}/></span><span className="location-copy"><small>DELIVER TO</small><b>{address || "Set your location"}</b></span><AppIcon name="arrowDown" size={14} className="location-chevron" /></button>
        <div className="header-actions"><button className="notification-control" onClick={() => setNotificationsOpen(true)} aria-label={`Open notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ""}`}><AppIcon name="notification" size={20}/>{unreadNotificationCount > 0 && <i className="notification-badge" aria-label={`${unreadNotificationCount} unread notifications`}/>}</button><button className="header-cart-control" onClick={() => changeTab("Cart")} aria-label={`Open cart${itemCount ? `, ${itemCount} items` : ""}`}><AppIcon name="cart" size={22}/>{itemCount > 0 && <i className="header-cart-count">{itemCount}</i>}</button></div>
      </header>}
      {paymentNotice && <button type="button" className="payment-return-notice" onClick={() => setPaymentNotice("")} role="status">{paymentNotice}</button>}
      <div className="content-wrap">
        {tab === "Home" && <HomePage cart={cart} updateQuantity={updateQuantity} onCheckout={() => changeTab("Cart")} onSetLocation={() => { setLocationNotice(""); setLocationOpen(true); }} onWalletAction={(action) => setWalletNotice(`${action} will be available when Mobsol wallet payments are connected.`)} walletNotice={walletNotice} address={address} gasRatePerKg={gasRatePerKg} balanceVisible={balanceVisible} onToggleBalance={() => setBalanceVisible((visible) => !visible)}/>}
        {tab === "Orders" && <OrdersPage onShop={() => changeTab("Home")} orders={visibleOrders.filter((order) => !isPastOrder(order))} onSelectOrder={setSelectedOrderId}/>}
        {tab === "Activity" && <ActivityPage orders={visibleOrders.filter(isPastOrder)} onSelectOrder={setSelectedOrderId} onRebook={(order) => { setCart((current) => { const next = { ...current }; for (const item of order.order_items ?? []) next[item.weight_kg_snapshot] = Math.min(10, (next[item.weight_kg_snapshot] || 0) + item.quantity); return next; }); changeTab("Home"); }} filtersOpen={activityFiltersOpen} onOpenFilters={() => setActivityFiltersOpen(true)} onCloseFilters={() => setActivityFiltersOpen(false)}/>}
        
        {tab === "Support" && <SupportPage closing={closingPage === "support"} onBack={() => closePage("support", () => { if (window.history.state?.mobsolRoute) window.history.back(); else changeTab("Profile"); })} onShop={() => changeTab("Home")} onSetLocation={() => { setNotice(""); setLocationNotice(""); setLocationOpen(true); }}/>}
        {tab === "Profile" && <ProfilePage account={account} onSignIn={beginSignIn} onHelp={() => changeTab("Support")} onWallet={() => { setWalletNotice(""); setWalletOpen(true); }} onSafety={() => setSafetyOpen(true)} onInbox={() => setNotificationsOpen(true)} onSettings={() => { setNotice(""); setSettingsOpen(true); }} notice={notice} setNotice={setNotice}/>}
      </div>
    </section>
    {settingsOpen && <div className={`overlay profile-overlay settings-overlay${closingPage === "settings" ? " page-exiting" : ""}`}><SettingsPage address={address} account={account} notice={notice} setNotice={setNotice} onBack={() => closePage("settings", () => { setSettingsOpen(false); setAppearanceSheetOpen(false); })} onAppearance={() => { setAppearanceDraft(preference); setAppearanceSheetOpen(true); }} onSignIn={beginSignIn} onSignOut={() => setSignOutOpen(true)}/></div>}
    {authOpen && <div className={`overlay profile-overlay auth-overlay${closingPage === "auth" ? " page-exiting" : ""}`}><section className="profile-page auth-page" role="main" aria-labelledby="auth-title"><div className="auth-banner-space" aria-hidden="true"><img src="/login-banner.png" alt=""/></div><header className="profile-page-header"><button type="button" className="profile-page-back" aria-label={authStep === 1 ? "Back" : "Back to previous sign-in step"} onClick={() => { if (authStep > 1) { setAuthStep((authStep - 1) as 1 | 2); setAuthNotice(""); } else closePage("auth", closeAuth); }}><AppIcon name="back" size={22}/></button><h1 id="auth-title">{authStep === 1 ? "Welcome to Mobsol" : authStep === 2 ? "Check your email" : "Sign in securely"}</h1><span/></header>{authStep === 1 ? <><p className="auth-intro">Sign in to manage your orders and delivery details.</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); void requestAuthCode(); }}><label htmlFor="auth-email">EMAIL ADDRESS</label><input id="auth-email" type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com"/><button type="submit" className="auth-primary" disabled={authBusy}>{authBusy ? "Sending code…" : "Continue"}</button></form><div className="auth-divider"><span>or</span></div><button type="button" className="auth-google" onClick={() => void signInWithGoogle()} disabled={authBusy}><img className="google-mark" src="/google-symbol.png" alt="" aria-hidden="true"/><span>Continue with Google</span></button><button type="button" className="auth-text-action" onClick={() => setAuthNotice("Enter the email address linked to your Mobsol account and we’ll send a new sign-in code.")}>Find my account</button><p className="auth-consent">By continuing, you agree to receive an account verification code by email. Message and data rates may apply.</p></> : authStep === 2 ? <><p className="auth-intro">Enter the six-digit code sent to <b>{authEmail}</b>.</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); void confirmAuthCode(); }}><label htmlFor="auth-code">VERIFICATION CODE</label><input id="auth-code" className="auth-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authCode} onChange={(event) => setAuthCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••"/><p className="auth-hint">Check your inbox and spam folder for the code.</p><button type="submit" className="auth-primary" disabled={authBusy}>{authBusy ? "Verifying…" : "Next"}<AppIcon name="arrow" size={19}/></button></form><div className="auth-inline-actions"><button type="button" onClick={() => void requestAuthCode()} disabled={authBusy}>Resend code</button><button type="button" onClick={() => { setAuthStep(1); setAuthCode(""); setAuthNotice(""); }}>More options</button></div></> : <><div className="passkey-art"><AppIcon name="safety" size={42}/></div><p className="auth-passkey-title">Sign in securely with Face ID or Touch ID</p><p className="auth-intro">Passkeys can protect your Mobsol account with your device’s built-in security.</p><p className="auth-hint">Passkey setup isn’t enabled for Mobsol yet. You’re signed in and can set this up later.</p><button type="button" className="auth-primary" onClick={closeAuth}>Continue<AppIcon name="arrow" size={19}/></button><button type="button" className="auth-text-action" onClick={closeAuth}>Skip for now</button></>}{authNotice && <p className="auth-notice" role="status">{authNotice}</p>}</section></div>}
    {signOutOpen && <div className="overlay nested-sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignOutOpen(false); }}><section className="bottom-sheet signout-sheet" role="dialog" aria-modal="true" aria-labelledby="signout-title"><SheetDragHandle label="Close sign-out confirmation" onDismiss={() => setSignOutOpen(false)}/><h2 id="signout-title">Do you want to sign out?</h2><p>Stay signed in to manage your Mobsol orders and delivery details.</p><button type="button" className="auth-primary" onClick={() => void confirmSignOut()}>Confirm sign-out</button><button type="button" className="auth-secondary" onClick={() => setSignOutOpen(false)}>Cancel</button></section></div>}
    {appearanceSheetOpen && <div className="overlay appearance-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAppearanceSheetOpen(false); }}><section className="bottom-sheet appearance-sheet" role="dialog" aria-modal="true" aria-labelledby="appearance-title"><SheetDragHandle label="Close appearance settings" className="sheet-handle appearance-sheet-handle" onDismiss={() => setAppearanceSheetOpen(false)}/><h2 id="appearance-title">Appearance</h2><div className="appearance-options">{([{value:"light",title:"Light mode"},{value:"dark",title:"Dark mode"},{value:"system",title:"Use device settings",copy:"We’ll follow your device display theme."}] as const).map((option) => <button type="button" className="appearance-option" key={option.value} onClick={() => setAppearanceDraft(option.value)}><span><b>{option.title}</b>{"copy" in option && <small>{option.copy}</small>}</span><i className={appearanceDraft === option.value ? "appearance-radio selected" : "appearance-radio"}/></button>)}</div><button type="button" className="appearance-save" disabled={appearanceDraft === preference} onClick={() => { setPreference(appearanceDraft); setAppearanceSheetOpen(false); }}>Save</button><button type="button" className="appearance-cancel" onClick={() => setAppearanceSheetOpen(false)}>Cancel</button></section></div>}
    <a className={`whatsapp-fab${tab === "Home" && itemCount > 0 ? " has-cart-bar" : ""}${navHidden ? " fab-hidden" : ""}`} href="https://wa.me/2347032462020?text=Hi%20Mobsol%2C%20I%20need%20help%20with%20an%20order." target="_blank" rel="noreferrer" aria-label="Chat with Mobsol on WhatsApp" title="Chat with Mobsol on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.92c0 2.1.55 4.15 1.6 5.96L.06 24l6.27-1.64a11.9 11.9 0 0 0 5.7 1.45h.01c6.58 0 11.93-5.35 11.93-11.92 0-3.18-1.24-6.17-3.45-8.4ZM12.04 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.22-3.72.98.99-3.63-.24-.37a9.87 9.87 0 1 1 8.38 4.62Z"/><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.34Z"/></svg></a>
    {tab !== "Support" && <nav className={navHidden ? "mobile-dock dock-hidden" : "mobile-dock"} aria-label="Main navigation">{([{ label: "Home", icon: "home" }, { label: "Orders", icon: "orders" }, { label: "Activity", icon: "activity" }] as const).map(({ label, icon }) => <button key={label} className={tab === label ? "dock-item active" : "dock-item"} onClick={() => changeTab(label)} aria-label={label} aria-current={tab === label ? "page" : undefined}><span className="dock-icon"><AppIcon name={icon} active={tab === label} size={22}/></span></button>)}<button type="button" className={tab === "Profile" ? "dock-item active" : "dock-item"} onClick={() => changeTab("Profile")} aria-label="Profile" aria-current={tab === "Profile" ? "page" : undefined}><span className="dock-icon"><AppIcon name="profile" active={tab === "Profile"} size={22}/></span></button></nav>}

    {locationOpen && <div className="overlay location-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationOpen(false); }}><section className="bottom-sheet location-sheet location-profile-style" role="dialog" aria-modal="true" aria-labelledby="location-title"><SheetDragHandle label="Close delivery location sheet" className="sheet-handle location-sheet-handle" onDismiss={() => setLocationOpen(false)}/><div className="location-sheet-content"><h2 id="location-title">Set your delivery address</h2><p className="muted-copy">We’ll check your address against active Abuja delivery zones.</p><label className="sheet-field">DELIVERY ADDRESS<div className="address-search"><AppIcon name="location" size={18}/><input autoFocus value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter an Abuja address"/></div></label><div className="map-placeholder" role="img" aria-label="Map preview for Abuja delivery"><i className="activity-map-marker location-map-marker" aria-hidden="true"/></div><p className="sheet-helper">Enter an address or use your device location. Delivery coverage will be checked before payment.</p>{locationNotice && <div className="inline-notice" role="status">{locationNotice}</div>}<div className="sheet-actions"><button type="button" className="text-button" onClick={() => setLocationOpen(false)}>Cancel</button><button type="button" className="primary-button" disabled={!address.trim()} onClick={() => { setAddress(address.trim()); setLocationOpen(false); setLocationNotice(""); }}>Use this location</button></div></div></section></div>}

    {selectedOrderId && visibleOrders.find((order) => order.id === selectedOrderId) && <OrderTrackingView order={visibleOrders.find((order) => order.id === selectedOrderId)!} onClose={() => setSelectedOrderId(null)}/>}

    {cartOpen && <div className={`overlay profile-overlay cart-page-overlay${closingPage === "cart" ? " page-exiting" : ""}`}><section className="profile-page cart-full-page" role="main" aria-labelledby="cart-page-title"><header className="profile-page-header"><button type="button" className="profile-page-back" aria-label="Back" onClick={() => closePage("cart", () => setCartOpen(false))}><AppIcon name="back" size={22}/></button><h1 id="cart-page-title">Cart</h1><span/></header><CartPage entries={entries} cart={cart} updateQuantity={updateQuantity} onCheckout={startCheckout} onShop={() => { setCartOpen(false); changeTab("Home"); }} onSetLocation={() => { setNotice(""); setLocationNotice(""); setLocationOpen(true); }} address={address} gasRatePerKg={gasRatePerKg}/></section></div>}

    {notificationsOpen && <div className={`overlay profile-overlay${closingPage === "notifications" ? " page-exiting" : ""}`}><section className="profile-page notifications-page" role="main" aria-labelledby="notifications-title"><header className="profile-page-header"><button type="button" className="profile-page-back" aria-label="Back" onClick={() => closePage("notifications", () => setNotificationsOpen(false))}><AppIcon name="back" size={22}/></button><h1 id="notifications-title">Notifications</h1><span/></header><div className="notification-toolbar"><p className="notification-summary"><span className="notification-count">{unreadNotificationCount} unread</span></p><div className="notifications-header-actions"><button type="button" className="notification-icon-action" onClick={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))} disabled={!notifications.some((item) => !item.read)} aria-label="Mark all notifications as read"><AppIcon name="readAll" size={20}/></button><button type="button" className="notification-icon-action clear-notifications-button" onClick={() => { if (!notifications.length) return; setUndoNotification({ items: notifications, index: 0, message: "Notifications cleared" }); setNotifications([]); setSwipedNotificationId(null); setNotificationSwipeDirection(null); if (undoTimer.current) clearTimeout(undoTimer.current); undoTimer.current = setTimeout(() => setUndoNotification(null), 5500); }} disabled={!notifications.length} aria-label="Clear all notifications"><AppIcon name="delete" size={20}/></button></div></div>{notifications.length ? <div className="notification-list">{notifications.map((item, index) => <article key={item.id} className="notification-swipe" onPointerDown={(event) => { notificationTouchX.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => { const start = notificationTouchX.current; const deltaX = start ? event.clientX - start.x : 0; const deltaY = start ? event.clientY - start.y : 0; notificationTouchX.current = null; if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) { if (Math.abs(deltaX) > 30) setSwipedNotificationId(null); return; } if (deltaX < 0) { setSwipedNotificationId(item.id); setNotificationSwipeDirection("delete"); } else if (!item.read) { setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification)); setSwipedNotificationId(item.id); setNotificationSwipeDirection("read"); if (notificationSwipeTimer.current) clearTimeout(notificationSwipeTimer.current); notificationSwipeTimer.current = setTimeout(() => { setSwipedNotificationId(null); setNotificationSwipeDirection(null); }, 550); } }}><button type="button" className="notification-delete" aria-label={`Delete ${item.title}`} onClick={() => { setUndoNotification({ items: [item], index, message: "Notification deleted" }); setNotifications((current) => current.filter((notification) => notification.id !== item.id)); setSwipedNotificationId(null); setNotificationSwipeDirection(null); if (undoTimer.current) clearTimeout(undoTimer.current); undoTimer.current = setTimeout(() => setUndoNotification(null), 5500); }}><AppIcon name="delete" size={20}/></button><button type="button" className="notification-mark-read" aria-label={`Mark ${item.title} as read`} onClick={() => { setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification)); setSwipedNotificationId(null); setNotificationSwipeDirection(null); }}><AppIcon name="readAll" size={20}/></button><div className={`notification-card${item.read ? " is-read" : ""}${swipedNotificationId === item.id && notificationSwipeDirection === "delete" ? " is-swiped" : ""}${swipedNotificationId === item.id && notificationSwipeDirection === "read" ? " is-mark-read" : ""}`}><span className="notification-card-icon"><AppIcon name="notification" size={20}/></span><span className="notification-copy"><span className="notification-card-top"><b>{item.title}</b><time>{item.time}</time></span><span className="notification-body">{item.body}</span></span>{!item.read && <i className="notification-unread-dot" aria-label="Unread"/>}</div></article>)}</div> : <div className="notification-empty"><span><AppIcon name="notification" size={22}/></span><b>You’re all caught up</b><p>Order confirmations and delivery updates will appear here.</p></div>}{undoNotification && <div className="notification-toast" role="status"><span>{undoNotification.message}</span><button type="button" onClick={() => { setNotifications((current) => { const next = [...current]; next.splice(Math.min(undoNotification.index, next.length), 0, ...undoNotification.items); return next; }); setUndoNotification(null); if (undoTimer.current) clearTimeout(undoTimer.current); }}>Undo</button></div>}</section></div>}

    {safetyOpen && <div className={`overlay profile-overlay${closingPage === "safety" ? " page-exiting" : ""}`}><section className="profile-page safety-hub-page" role="main" aria-labelledby="safety-hub-title"><header className="safety-hub-top"><button type="button" aria-label="Back to profile" onClick={() => closePage("safety", () => { setSafetyOpen(false); setTab("Profile"); })}><AppIcon name="back" size={25}/></button></header><h1 id="safety-hub-title">Safety hub</h1><section className="safety-hub-section"><h2>Safety preferences</h2><p>Manage safety features for your Mobsol deliveries.</p><div className="safety-preference-list">{([{key:"pin",icon:"safety",title:"Delivery PIN",copy:"Confirm the right cylinder reaches you."},{key:"audio",icon:"notification",title:"Delivery updates",copy:"Get order updates as they happen."},{key:"emergency",icon:"profile",title:"Emergency contact",copy:"Choose someone to contact if you need help."},{key:"sharing",icon:"invite",title:"Share delivery status",copy:"Let someone follow your delivery progress."}] as const).map((item) => { const isOn = item.key === "audio" ? pushEnabled : safetyPreferences[item.key]; return <button type="button" className="safety-preference-row" key={item.key} disabled={item.key === "audio" && pushBusy} onClick={() => item.key === "audio" ? void togglePushNotifications() : setSafetyPreferences((current) => ({ ...current, [item.key]: !current[item.key] }))}><AppIcon name={item.icon} size={25}/><span className="safety-row-copy"><b>{item.key === "audio" && pushBusy ? "Updating notifications…" : item.title}</b><small>{item.copy}</small></span><span className={`safety-switch${isOn ? " is-on" : ""}`} role="switch" aria-checked={isOn} aria-label={`${item.title} ${isOn ? "on" : "off"}`}><i/></span></button>; })}</div><button type="button" className="safety-preference-row safety-detail-row" onClick={() => setNotice("Delivery check-in will be available when Mobsol tracking is connected.")}><AppIcon name="location" size={25}/><span className="safety-row-copy"><b>Delivery check-in</b><small>Get a prompt if your delivery seems delayed.</small><em>Every delivery</em></span><AppIcon name="arrow" size={19}/></button></section><section className="safety-hub-section safety-support-section"><h2>More safety support</h2>{[{icon:"safety",title:"Safe cylinder handling",copy:"Learn how to handle your cylinder safely."},{icon:"help",title:"Contact Mobsol support",copy:"Get help with a delivery or safety concern."},{icon:"legal",title:"Mobsol safety standards",copy:"Learn about our delivery safety practices."}].map((item) => <button type="button" className="safety-preference-row safety-detail-row" key={item.title} onClick={() => setNotice(`${item.title} information will be available soon.`)}><AppIcon name={item.icon as "safety" | "help" | "legal"} size={25}/><span className="safety-row-copy"><b>{item.title}</b><small>{item.copy}</small></span><AppIcon name="arrow" size={19}/></button>)}</section></section></div>}
    {walletOpen && <div className={`overlay profile-overlay${closingPage === "wallet" ? " page-exiting" : ""}`}><section className="profile-page wallet-page" role="main" aria-labelledby="wallet-page-title"><header className="profile-page-header"><button type="button" className="profile-page-back" aria-label="Back to profile" onClick={() => closePage("wallet", () => { setWalletOpen(false); setTab("Profile"); })}><AppIcon name="back" size={24}/></button><h1 id="wallet-page-title">Wallet</h1><span/></header><section className="wallet-balance-card"><p>Mobsol wallet</p><strong>₦0.00</strong><span>Available balance</span><div className="wallet-page-actions"><button type="button" onClick={() => setWalletNotice("Adding funds will be available when Mobsol payments are connected.")}><AppIcon name="plus" size={20}/><span>Add funds</span></button><button type="button" onClick={() => setWalletNotice("Withdrawals will be available when Mobsol payments are connected.")}><AppIcon name="withdraw" size={20}/><span>Withdraw</span></button></div></section>{walletNotice && <p className="wallet-page-notice" role="status">{walletNotice}</p>}<section className="wallet-section"><div className="wallet-section-heading"><h2>Payment methods</h2></div><div className="wallet-empty-methods"><AppIcon name="wallet" size={24}/><p>No payment methods added yet.</p><small>Add a payment method to use it for wallet funding.</small></div><button type="button" className="wallet-add-method" onClick={() => setWalletNotice("Payment method setup will be available when Mobsol payments are connected.")}><AppIcon name="plus" size={19}/><span>Add payment method</span></button></section><section className="wallet-section promo-section"><h2>Promotions</h2><p>Have a Mobsol promo code?</p><form className="wallet-promo-form" onSubmit={(event) => { event.preventDefault(); setWalletNotice(promoCode.trim() ? "Promo code validation will be available when promotions are connected." : "Enter a promo code to continue."); }}><input value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder="Enter promo code" aria-label="Promo code"/><button type="submit">Apply</button></form></section></section></div>}

    {checkoutOpen && <div className="overlay checkout-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}><section className="bottom-sheet checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <SheetDragHandle label="Close checkout sheet" onDismiss={() => setCheckoutOpen(false)}/>
      <div className="checkout-topbar">{checkoutStep > 1 ? <button className="checkout-back" type="button" aria-label="Back" onClick={() => checkoutStep === 3 ? setCheckoutStep(1) : setCheckoutStep(checkoutStep - 1)}><AppIcon name="back" size={22}/></button> : <span className="checkout-back-spacer"/>}<div className="checkout-heading"><p className="eyebrow">ORDER CHECKOUT · STEP {checkoutStep === 3 ? "2" : "1"} OF 2</p><h2 id="checkout-title">{checkoutStep === 1 ? "Plan your order" : checkoutStep === 2 ? "Delivery details" : "Review your exchange"}</h2></div><span className="checkout-back-spacer"/></div>
      <div className="step-progress"><i className="done"/><i className={checkoutStep === 3 ? "done" : ""}/></div>
      {checkoutStep === 1 && <div className="checkout-body"><p className="muted-copy">Send a Mobsol cylinder exchange to yourself or someone in Abuja.</p><div className="checkout-pills"><button type="button" className="recipient-pill timing-pill" onClick={() => setSchedulePickerOpen(true)}><span className="time-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3.2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span>{deliveryTiming === "soon" ? "Now" : "Schedule delivery"}</span><AppIcon name="arrowShort" size={16} className="pill-chevron"/></button><button type="button" className="recipient-pill" onClick={() => setRecipientPickerOpen(true)}><AppIcon name="profile" size={19}/><span>{recipient === "other" ? recipientName || "Choose a contact" : "For me"}</span><AppIcon name="arrowShort" size={16} className="pill-chevron"/></button></div>{recipient === "other" && <div className="field-grid recipient-fields"><label>RECIPIENT FULL NAME<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Recipient’s name"/></label><label>RECIPIENT PHONE<input type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="+234"/></label><label className="full-field">WHO WILL PAY?<button type="button" className="select-button" onClick={() => setPayerPickerOpen(true)}>{payer === "customer" ? "I’ll pay for the order" : "Recipient pays on delivery"}<span>⌄</span></button></label></div>}<label className="sheet-field order-address-field">DELIVERY ADDRESS<div className="address-search"><AppIcon name="location" size={18}/><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter an Abuja address"/></div></label><p className="sheet-helper">{recipient === "other" ? "Enter the recipient’s delivery address." : "Enter your delivery address."}</p><label className="sheet-field">DELIVERY INSTRUCTIONS <small>OPTIONAL</small><textarea rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Gate, landmark, or instructions for the rider"/></label></div>}
      {checkoutStep === 2 && <div className="checkout-body"><p className="muted-copy">Choose a delivery address and add instructions for the rider.</p><label className="sheet-field">DELIVERY ADDRESS<div className="address-search"><AppIcon name="location" size={18}/><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter an Abuja address"/></div></label><p className="sheet-helper">{recipient === "other" ? "Enter the recipient’s delivery address." : "Enter your delivery address."}</p>{recipient === "other" && <div className="recipient-summary"><AppIcon name="profile" size={18}/><span>Recipient: <b>{recipientName || "Name required"}</b>{payer === "recipient" && <small>Recipient is expected to pay</small>}</span></div>}<label className="sheet-field">DELIVERY INSTRUCTIONS <small>OPTIONAL</small><textarea rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Gate, landmark, or instructions for the rider"/></label><div className="inline-notice">We’ll need to verify this address against an active delivery zone before checkout.</div></div>}
      {checkoutStep === 3 && <div className="checkout-body"><div className="review-products">{entries.map((product) => <div className="review-row" key={product.kg}><Cylinder size={product.kg}/><span><b>{product.kg} kg cylinder × {cart[product.kg]}</b><small>₦{(product.kg * gasRatePerKg * cart[product.kg]).toLocaleString("en-NG")} · gas</small></span></div>)}</div><div className="review-row review-address-row"><AppIcon name="location" size={19} className="review-address-icon"/><span><b>{address || "Delivery address needed"}</b><small>{recipient === "other" ? (recipientName || "Recipient") + " · " + (recipientPhone || "Phone number needed") : "For you"}</small></span></div><div className="review-total"><span>Gas subtotal</span><b>₦{entries.reduce((sum, product) => sum + product.kg * gasRatePerKg * cart[product.kg], 0).toLocaleString("en-NG")}</b></div><div className="inline-notice">Today’s gas rate: ₦{gasRatePerKg.toLocaleString("en-NG")}/kg. Delivery is calculated after your address is verified.</div><div className="field-grid payment-profile-fields"><label>EMAIL FOR RECEIPT<input type="email" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="you@example.com"/></label><label>FULL NAME<input autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name"/></label><label className="full-field">PHONE NUMBER<input type="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+234…"/></label>{emailCodeSent && <label className="full-field">EMAIL SIGN-IN CODE<input inputMode="numeric" autoComplete="one-time-code" value={emailCode} onChange={(event) => setEmailCode(event.target.value)} placeholder="Enter the code we emailed you"/></label>}</div>{payer === "recipient" ? <div className="inline-notice">The recipient will pay on delivery.</div> : <><p className="eyebrow payment-choice-label">PAYMENT METHOD</p><div className="payment-choice-grid"><button type="button" className="payment-choice wallet-choice" disabled aria-label="Wallet balance payment is not available yet"><AppIcon name="wallet" size={20}/><span><b>Wallet balance</b><small>Wallet payments aren’t connected yet</small></span></button><button type="button" className={paymentChannel === "card" ? "payment-choice selected" : "payment-choice"} onClick={() => setPaymentChannel("card")}><AppIcon name="creditCard" size={20}/><span><b>Card</b><small>Pay securely with Paystack</small></span></button><button type="button" className={paymentChannel === "bank_transfer" ? "payment-choice selected" : "payment-choice"} onClick={() => setPaymentChannel("bank_transfer")}><AppIcon name="bankTransfer" size={20}/><span><b>Bank transfer</b><small>Paystack creates an account to copy</small></span></button><button type="button" className={paymentChannel === "cash" ? "payment-choice selected" : "payment-choice"} onClick={() => setPaymentChannel("cash")}><AppIcon name="safeDelivery" size={20}/><span><b>Pay on delivery</b><small>Pay the dispatcher when it arrives</small></span></button></div>{paymentChannel === "cash" ? <div className="inline-notice">Pay the dispatcher after your gas is delivered.</div> : <div className="inline-notice">Paystack Checkout securely collects card details. Mobsol never receives or stores your card number or CVV. For bank transfer, Paystack displays a temporary account number to copy.</div>}</>}{notice && <div className="inline-notice" role="status">{notice}</div>}<button className="primary-button wide" disabled={paymentBusy || (payer === "customer" && !catalog.length)} onClick={startPayment}>{paymentBusy ? "Starting secure checkout…" : emailCodeSent ? "Verify email and continue" : payer === "recipient" || paymentChannel === "cash" ? "Place order" : "Continue to Paystack"}</button></div>}
      {checkoutStep < 3 && <div className="sheet-actions"><button className="text-button" onClick={() => checkoutStep > 1 ? setCheckoutStep(checkoutStep - 1) : setCheckoutOpen(false)}>{checkoutStep > 1 ? "Back" : "Keep shopping"}</button><button className="primary-button" disabled={(checkoutStep === 1 && (!canReview || !address.trim())) || (checkoutStep === 2 && !address.trim())} onClick={() => setCheckoutStep(checkoutStep === 1 ? 3 : checkoutStep + 1)}>Continue</button></div>}
      {checkoutStep === 3 && <div className="sheet-actions"><button className="text-button" onClick={() => setCheckoutStep(1)}>Edit details</button><button className="text-button" onClick={() => setCheckoutOpen(false)}>Close</button></div>}
    </section></div>}
    {recipientPickerOpen && <div className="overlay nested-sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setRecipientPickerOpen(false); }}><section className="bottom-sheet nested-sheet" role="dialog" aria-modal="true" aria-labelledby="switch-delivery-title"><SheetDragHandle label="Close switch delivery sheet" onDismiss={() => setRecipientPickerOpen(false)}/><div className="nested-sheet-title"><h2 id="switch-delivery-title">Switch delivery</h2></div>{recipient === "other" && recipientName && <button type="button" className="contact-option" aria-pressed="true" onClick={() => setRecipientPickerOpen(false)}><span className="contact-avatar">{recipientName.trim().charAt(0).toUpperCase()}</span><span className="contact-option-copy"><b>{recipientName}</b><small>{recipientPhone || "Delivery recipient"}</small></span><i className="radio selected" aria-hidden="true"/></button>}<button type="button" className="contact-option" aria-pressed={recipient === "self"} onClick={() => { setRecipient("self"); setRecipientPickerOpen(false); }}><span className="contact-avatar contact-avatar-profile"><AppIcon name="profile" size={21}/></span><span className="contact-option-copy"><b>Me</b><small>Deliver to me</small></span><i className={recipient === "self" ? "radio selected" : "radio"} aria-hidden="true"/></button><button type="button" className="contact-option add-contact-option" onClick={chooseDeviceContact}><AppIcon name="plus" size={23} className="contact-add-icon"/><span className="contact-option-copy"><b>Add new contact</b><small>Choose a person to receive this order</small></span></button></section></div>}
    {contactEntryOpen && !manualContactOpen && <div className="overlay nested-sheet-overlay" style={isCompactViewport ? { alignItems: "stretch" } : undefined} onMouseDown={(event) => { if (event.target === event.currentTarget) setContactEntryOpen(false); }}><section className="bottom-sheet nested-sheet contact-picker-sheet" style={isCompactViewport ? { width: "100%", height: "100dvh", maxHeight: "100dvh", borderRadius: 0 } : undefined} role="dialog" aria-modal="true" aria-labelledby="choose-contact-title"><SheetDragHandle label="Close contact picker" onDismiss={() => setContactEntryOpen(false)}/><div className="nested-sheet-title"><h2 id="choose-contact-title">Choose a contact</h2></div><label className="contact-search"><AppIcon name="search" size={20}/><input type="search" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search name or number"/></label><section className="contact-group"><h3>Frequent contacts</h3>{matchingContacts.filter((contact) => contact.frequent).map((contact) => <button className="device-contact-row" key={contact.phone} onClick={() => selectContact(contact)}><span className="contact-avatar">{contact.name[0]}</span><span><b>{contact.name}</b><small>{contact.phone}</small></span></button>)}</section><section className="contact-group device-group"><h3>Device contacts</h3>{matchingContacts.filter((contact) => !contact.frequent).map((contact) => <button className="device-contact-row" key={contact.phone} onClick={() => selectContact(contact)}><span className="contact-avatar">{contact.name[0]}</span><span><b>{contact.name}</b><small>{contact.phone}</small></span></button>)}{matchingContacts.length === 0 && <p className="contact-empty">No contacts match your search.</p>}</section><button type="button" className="manual-contact-link" onClick={() => setManualContactOpen(true)}>Enter details manually</button>{typeof navigator !== "undefined" && "contacts" in navigator && <button type="button" className="device-contact-button" onClick={chooseDeviceContact}><AppIcon name="profile" size={18}/> Browse phone contacts</button>}</section></div>}
    {contactEntryOpen && manualContactOpen && <div className="overlay nested-sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) { setManualContactOpen(false); setContactEntryOpen(false); } }}><section className="bottom-sheet nested-sheet contact-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="add-contact-title"><SheetDragHandle label="Back to contacts" onDismiss={() => setManualContactOpen(false)}/><div className="nested-sheet-title"><h2 id="add-contact-title">Add contact details</h2></div><label className="sheet-field">FULL NAME<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Contact’s name"/></label><label className="sheet-field">PHONE NUMBER<input type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="+234"/></label><button className="secondary-button wide" disabled={recipientName.trim().length < 2 || recipientPhone.trim().length < 7} onClick={saveManualContact}>Use this contact</button></section></div>}
    {payerPickerOpen && <div className="overlay nested-sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPayerPickerOpen(false); }}><section className="bottom-sheet nested-sheet" role="dialog" aria-modal="true" aria-labelledby="payer-title"><SheetDragHandle label="Close payer options" onDismiss={() => setPayerPickerOpen(false)}/><div className="nested-sheet-title"><h2 id="payer-title">Who will pay?</h2></div>{([{ value: "customer", title: "I’ll pay for the order" }, { value: "recipient", title: "Recipient pays on delivery" }] as const).map((option) => <button type="button" className="payer-option" key={option.value} onClick={() => { setPayer(option.value); setPayerPickerOpen(false); }}><span>{option.title}</span><i className={payer === option.value ? "radio selected" : "radio"}/></button>)}</section></div>}
    {schedulePickerOpen && <div className="overlay nested-sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSchedulePickerOpen(false); }}><section className="bottom-sheet nested-sheet" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><SheetDragHandle label="Close delivery timing" onDismiss={() => setSchedulePickerOpen(false)}/><div className="nested-sheet-title"><h2 id="schedule-title">When do you need delivery?</h2></div>{([{ value: "soon", title: "Now" }, { value: "later", title: "Schedule for later" }] as const).map((option) => <button type="button" className="payer-option" key={option.value} onClick={() => { setDeliveryTiming(option.value); setSchedulePickerOpen(false); }}><AppIcon name={option.value === "soon" ? "clock" : "calendar"} size={20}/><span className="schedule-option-copy"><b>{option.title}</b><small>{option.value === "soon" ? "Get your gas delivered as soon as possible." : "Choose this to arrange delivery for another time."}</small></span><i className={deliveryTiming === option.value ? "radio selected" : "radio"}/></button>)}</section></div>}
  </main></>;
}

function ProfilePage({ account, onSignIn, onHelp, onWallet, onSafety, onInbox, onSettings, notice, setNotice }: { account: AccountIdentity | null; onSignIn: () => void; onHelp: () => void; onWallet: () => void; onSafety: () => void; onInbox: () => void; onSettings: () => void; notice: string; setNotice: (message: string) => void }) {
  return <section className="profile-page profile-content-page" aria-label="Profile">
    <button type="button" className="profile-identity profile-identity-button" onClick={account ? onSettings : onSignIn}><div><h2>{account?.name || "Welcome"}</h2>{account ? <p>{account.email}</p> : <small>Sign in to manage your account</small>}</div><span className="profile-photo"><AppIcon name="profile" size={34}/></span></button>
    <div className="profile-shortcuts"><button onClick={onHelp}><AppIcon name="help" size={24}/><span>Help</span></button><button onClick={onWallet}><AppIcon name="wallet" size={24}/><span>Wallet</span></button><button onClick={onSafety}><AppIcon name="safety" size={24}/><span>Safety</span></button><button onClick={onInbox}><AppIcon name="inbox" size={24}/><span>Inbox</span></button></div>
    <button className="profile-feature safety-feature" onClick={onSafety}><span><b>Safety check-up</b><small>Learn how to make deliveries safer</small></span><span className="safety-progress">1/5</span></button>
    
    <button className="profile-feature invite-feature" onClick={() => setNotice("Invites will be available when referrals are enabled.")}><span className="invite-copy"><b>Invite friends to Mobsol</b><small>Share Mobsol Gas with family and friends</small></span><Image className="invite-artwork" src="/images/invite-friends.png" alt="" width={1254} height={1254} priority/></button>
    <div className="profile-links"><button onClick={onSettings}><AppIcon name="settings" size={21}/><span>Settings</span></button><button onClick={() => setNotice("Manage accounts will be available soon.")}><AppIcon name="accounts" size={21}/><span>Manage accounts</span></button><button onClick={() => setNotice("Legal information will be available soon.")}><AppIcon name="legal" size={21}/><span>Legal</span></button><p className="app-version">Version 1.0.0</p></div>
    {notice && <p className="profile-notice" role="status">{notice}</p>}
  </section>;
}

function SettingsPage({ address, account, notice, setNotice, onBack, onAppearance, onSignIn, onSignOut }: { address: string; account: AccountIdentity | null; notice: string; setNotice: (message: string) => void; onBack: () => void; onAppearance: () => void; onSignIn: () => void; onSignOut: () => void }) {
  const preference = useThemePreference().preference;
  const appearanceLabel = preference === "system" ? "Use device settings" : preference === "light" ? "Light mode" : "Dark mode";
  const appSettings: { icon: AppIconName; title: string; copy?: string; action?: () => void }[] = [
    { icon: "home", title: "Home", copy: address || "Add home", action: () => setNotice("Add a home address from delivery location settings.") },
    { icon: "briefcase", title: "Work", copy: "Add work", action: () => setNotice("Work address can be saved when address management is connected.") },
    { icon: "star", title: "Saved places", action: () => setNotice("Your saved places will appear here.") },
    { icon: "safety", title: "Privacy", copy: "Manage the data you share with Mobsol", action: () => setNotice("Privacy settings will be available soon.") },
    { icon: "appearance", title: "Appearance", copy: appearanceLabel, action: onAppearance },
    { icon: "language", title: "Accessibility", copy: "Manage your accessibility settings", action: () => setNotice("Accessibility settings will be available soon.") },
    { icon: "notification", title: "Communication", copy: "Choose contact methods and manage notifications", action: () => setNotice("Communication preferences will be available soon.") },
  ];
  return <section className="profile-page settings-page" role="main" aria-labelledby="settings-title">
    <header className="settings-page-header"><button type="button" className="settings-back" aria-label="Back to profile" onClick={onBack}><AppIcon name="back" size={25}/></button><h1 id="settings-title">Settings</h1></header>
    <button type="button" className="settings-account-row" onClick={() => account ? setNotice("Account details will be available soon.") : onSignIn()}><span className="settings-avatar"><AppIcon name="profile" size={38}/></span><span className="settings-account-copy"><b>{account?.name || "Guest"}</b><small>{account?.email || "Sign in to your Mobsol account"}</small></span><AppIcon name="arrowShort" size={20}/></button>
    <h2 className="settings-section-title">App settings</h2>
    <div className="settings-list">{appSettings.map((item) => <button type="button" className="settings-row" key={item.title} onClick={() => { setNotice(""); item.action?.(); }}><AppIcon name={item.icon} size={25}/><span className="settings-row-copy"><b>{item.title}</b>{item.copy && <small>{item.copy}</small>}</span><AppIcon name="arrowShort" size={20}/></button>)}</div>
    <div className="settings-account-actions"><button type="button" onClick={() => account ? setNotice("Account switching will be available when multiple accounts are connected.") : onSignIn()}>Switch account</button>{account ? <button type="button" className="settings-signout" onClick={onSignOut}>Sign out</button> : <button type="button" onClick={onSignIn}>Sign in</button>}</div>
    {notice && <p className="profile-notice settings-notice" role="status">{notice}</p>}
  </section>;
}

function HomePage({ cart, updateQuantity, onCheckout, onSetLocation, onWalletAction, walletNotice, address, gasRatePerKg, balanceVisible, onToggleBalance }: { cart: Record<number, number>; updateQuantity: (kg: number, delta: number) => void; onCheckout: () => void; onSetLocation: () => void; onWalletAction: (action: "Add money" | "Withdraw") => void; walletNotice: string; address: string; gasRatePerKg: number; balanceVisible: boolean; onToggleBalance: () => void }) {
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerTrack = useRef<HTMLDivElement>(null);
  const banners = [
    { src: "/images/banner-1.png", alt: "From our station to your kitchen in minutes." },
    { src: "/images/banner-2.png", alt: "Gas at your door before the pot gets cold." },
  ];
  const formatNaira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;
  return <div className="home-page">
    <section className="wallet-summary" aria-label="Mobsol wallet"><div className="wallet-balance"><div className="wallet-amount-row"><p className="wallet-amount">{balanceVisible ? "₦0.00" : "₦••••"}</p><button type="button" className="wallet-balance-toggle" aria-label={balanceVisible ? "Hide balance" : "Show balance"} aria-pressed={!balanceVisible} onClick={onToggleBalance}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{balanceVisible ? <><path d="M2.2 12s3.5-6.5 9.8-6.5 9.8 6.5 9.8 6.5-3.5 6.5-9.8 6.5S2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="2.8"/></> : <><path d="m3 3 18 18"/><path d="M10.6 5.6A10.8 10.8 0 0 1 12 5.5c6.3 0 9.8 6.5 9.8 6.5a16.8 16.8 0 0 1-3.2 3.9M6.2 6.4C3.6 8.1 2.2 12 2.2 12s3.5 6.5 9.8 6.5c1.1 0 2.1-.2 3-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>}</svg></button></div><p className="wallet-caption">Available balance</p></div><div className="wallet-actions"><button type="button" onClick={() => onWalletAction("Add money")}><span><AppIcon name="plus" size={23}/></span><b>Add money</b></button><button type="button" onClick={() => onWalletAction("Withdraw")}><span><AppIcon name="withdraw" size={23}/></span><b>Withdraw</b></button></div></section>
    {walletNotice && <p className="wallet-action-note" role="status">{walletNotice}</p>}
    <section className="order-section"><div className="gas-rate-banner"><b>Gas rates today</b><strong>1 kg of gas = {formatNaira(gasRatePerKg)}</strong></div><div className="product-list">{products.map((product) => <article className="product-card" key={product.kg}><div className="product-visual"><Cylinder size={product.kg}/></div><div className="product-info"><h3>{product.kg} kg</h3><p>{product.detail}</p><span className="product-price">{formatNaira(product.kg * gasRatePerKg)} · gas</span></div><button className={cart[product.kg] ? "add-product added" : "add-product"} onClick={() => updateQuantity(product.kg, 1)}>{cart[product.kg] ? "Added · " + cart[product.kg] : "Add to cart"} <AppIcon name="plus" size={17}/></button></article>)}</div>
    </section>
    <div className="home-lower"><section className="home-lower-section"><p className="eyebrow home-lower-heading">DELIVERY LOCATION</p><div className="location-card"><div><h3>{address || "Set your delivery address"}</h3><p>{address ? "Service area still needs to be verified." : "We’ll check your address against active Abuja zones."}</p><button onClick={onSetLocation}>{address ? "Change address" : "Choose a location"} <AppIcon name="arrow" size={16}/></button></div></div></section>
    </div>
    <section className="home-banner-section" aria-label="Mobsol promotions"><div className="home-banner-track" ref={bannerTrack} onScroll={(event) => { const track = event.currentTarget; const index = Math.round(track.scrollLeft / (track.clientWidth + 12)); setActiveBanner(Math.max(0, Math.min(banners.length - 1, index))); }}>{banners.map((banner) => <div className="home-banner-slide" key={banner.src}><Image src={banner.src} alt={banner.alt} width={1200} height={450} sizes="(max-width: 680px) calc(100vw - 30px), 100vw"/></div>)}</div><div className="home-banner-indicators" aria-label="Choose a banner">{banners.map((banner, index) => <button key={banner.src} type="button" aria-label={`Show banner ${index + 1}`} aria-current={activeBanner === index ? "true" : undefined} onClick={() => { const track = bannerTrack.current; const slide = track?.children.item(index) as HTMLElement | null; if (track && slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" }); }}/>)}</div></section>
    {Object.keys(cart).length > 0 && <div className="cart-bar"><span><b>{Object.values(cart).reduce((total, count) => total + count, 0)} cylinder{Object.values(cart).reduce((total, count) => total + count, 0) > 1 ? "s" : ""}</b><small>Prices appear after location verification</small></span><button className="primary-button" onClick={onCheckout}>Review cart</button></div>}
  </div>;
}
const pastOrderStatuses = new Set(["delivered", "cancelled", "failed_delivery"]);
function isPastOrder(order: CustomerOrder) { return pastOrderStatuses.has(order.delivery_status); }

function ActivityPage({ orders, onSelectOrder, onRebook, filtersOpen, onOpenFilters, onCloseFilters }: { orders: CustomerOrder[]; onSelectOrder: (id: string) => void; onRebook: (order: CustomerOrder) => void; filtersOpen: boolean; onOpenFilters: () => void; onCloseFilters: () => void }) {
  const [appliedFilters, setAppliedFilters] = useState({ weights: [] as number[], startDate: "", endDate: "" });
  const [draftWeights, setDraftWeights] = useState<number[]>([]);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const ordered = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const availableWeights = [...new Set(orders.flatMap((order) => (order.order_items ?? []).map((item) => item.weight_kg_snapshot)))].sort((a, b) => a - b);
  const sizeOptions = availableWeights.length ? availableWeights : products.map((product) => product.kg);
  const orderDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
  const filteredOrders = ordered.filter((order) => {
    const containsSize = appliedFilters.weights.length === 0 || (order.order_items ?? []).some((item) => appliedFilters.weights.includes(item.weight_kg_snapshot));
    const orderDate = orderDateFormatter.format(new Date(order.created_at));
    return containsSize && (!appliedFilters.startDate || orderDate >= appliedFilters.startDate) && (!appliedFilters.endDate || orderDate <= appliedFilters.endDate);
  });
  const grouped = new Map<string, CustomerOrder[]>();
  for (const order of filteredOrders) {
    const month = new Date(order.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
    grouped.set(month, [...(grouped.get(month) ?? []), order]);
  }
  const activeFilterCount = Number(appliedFilters.weights.length > 0) + Number(Boolean(appliedFilters.startDate || appliedFilters.endDate));
  const dateRangeValid = !draftStartDate || !draftEndDate || draftStartDate <= draftEndDate;
  const openFilters = () => {
    setDraftWeights(appliedFilters.weights);
    setDraftStartDate(appliedFilters.startDate);
    setDraftEndDate(appliedFilters.endDate);
    onOpenFilters();
  };
  const clearFilters = () => {
    setDraftWeights([]);
    setDraftStartDate("");
    setDraftEndDate("");
    setAppliedFilters({ weights: [], startDate: "", endDate: "" });
  };
  const applyFilters = () => {
    if (!dateRangeValid) return;
    setAppliedFilters({ weights: draftWeights, startDate: draftStartDate, endDate: draftEndDate });
    onCloseFilters();
  };
  return <>
    <div className="secondary-page activity-page">
      <div className="activity-heading-row"><h1>Activity</h1><button type="button" className="activity-filter-button" onClick={openFilters} aria-label={`Filter previous orders${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}><AppIcon name="filters" size={22}/>{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button></div>
      <p className="secondary-intro">Your previous orders.</p>
      {filteredOrders.length ? <div className="activity-groups">{[...grouped.entries()].map(([month, monthOrders]) => <section className="activity-month" key={month}><h2>{month}</h2><div className="activity-order-list">{monthOrders.map((order) => {
        const mapUrl = getOrderMapUrl(order.delivery_coordinates);
        const date = new Date(order.created_at);
        return <article className="activity-order-card" key={order.id}>
          <div className="activity-map-preview">{mapUrl ? <><iframe title={`Map near ${order.delivery_address_snapshot}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer"/><span className="activity-map-marker" aria-hidden="true"/></> : <div className="activity-map-fallback"><i className="activity-map-fallback-dot"/><span>DELIVERY AREA</span></div>}</div>
          <button type="button" className="activity-order-summary" onClick={() => onSelectOrder(order.id)} aria-label={`View order ${order.order_number} details`}><span className="activity-address">{order.delivery_address_snapshot}</span><strong>₦{(Number(order.total_kobo) / 100).toLocaleString("en-NG")}</strong><span className="activity-order-items">{order.order_items?.map((item) => `${item.weight_kg_snapshot} kg × ${item.quantity}`).join(" · ")}</span><time>{date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} · {order.delivery_status.replaceAll("_", " ")}</time></button>
          <div className="activity-order-actions"><button type="button" className="secondary-button" onClick={() => onRebook(order)}>Reorder</button><button type="button" className="activity-details-link" onClick={() => onSelectOrder(order.id)} aria-label={`View order ${order.order_number} details`} title="View order details"><AppIcon name="arrowShort" size={22}/></button></div>
        </article>;
      })}</div></section>)}</div> : (orders.length > 0 && activeFilterCount > 0 ? <section className="activity-empty"><h2>No orders match these filters</h2><p>Try another cylinder size or date range.</p></section> : <section className="activity-empty"><h2>No past orders yet</h2><p>Completed and cancelled orders will appear here.</p></section>)}
    </div>
    {filtersOpen && <div className="overlay nested-sheet-overlay activity-filter-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseFilters(); }}><section className="bottom-sheet activity-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="activity-filter-title"><SheetDragHandle label="Close activity filters" onDismiss={onCloseFilters}/><div className="activity-filter-header"><h2 id="activity-filter-title">Filters</h2></div><section className="activity-filter-section"><h3>Cylinder sizes</h3><div className="activity-filter-chips">{sizeOptions.map((weight) => <button type="button" key={weight} className={draftWeights.includes(weight) ? "activity-filter-chip selected" : "activity-filter-chip"} aria-pressed={draftWeights.includes(weight)} onClick={() => setDraftWeights((current) => current.includes(weight) ? current.filter((value) => value !== weight) : [...current, weight])}>{weight} kg</button>)}</div></section><section className="activity-filter-section activity-date-section"><h3>Custom dates</h3><div className="activity-date-fields"><label>Start date<input type="date" value={draftStartDate} max={draftEndDate || undefined} onChange={(event) => setDraftStartDate(event.target.value)}/></label><label>End date<input type="date" value={draftEndDate} min={draftStartDate || undefined} onChange={(event) => setDraftEndDate(event.target.value)}/></label></div>{!dateRangeValid && <p className="activity-filter-error" role="alert">The end date must be on or after the start date.</p>}</section><div className="activity-filter-actions"><button type="button" className="activity-filter-clear" onClick={clearFilters}>Clear all</button><button type="button" className="activity-filter-apply" onClick={applyFilters} disabled={!dateRangeValid}>Apply</button></div></section></div>}
  </>;
}

function OrdersPage({ onShop, orders, onSelectOrder }: { onShop: () => void; orders: CustomerOrder[]; onSelectOrder: (id: string) => void }) {
  return <div className="secondary-page orders-page"><h1>Orders</h1><p className="secondary-intro">Order progress and exchange details, all in one place.</p>{orders.length ? <div className="customer-order-list">{orders.map((order) => <article className="customer-order-card" key={order.id} role="button" tabIndex={0} aria-label={`View order ${order.order_number}, ${order.delivery_status.replaceAll("_", " ")}`} onClick={() => onSelectOrder(order.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectOrder(order.id); } }}><div className="customer-order-heading"><span><small>ORDER #{order.order_number}</small><b>{new Date(order.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</b></span><strong>{`₦${(Number(order.total_kobo) / 100).toLocaleString("en-NG")}`}</strong></div><div className="customer-order-items">{order.order_items?.map((item, index) => <span key={`${item.weight_kg_snapshot}-${index}`}>{item.weight_kg_snapshot} kg × {item.quantity}</span>)}</div><p>{order.delivery_address_snapshot}</p><div className="customer-order-status"><span>{order.delivery_status.replaceAll("_", " ")}</span><span className={order.payment_method === "cash" ? "pending" : order.payment_status === "paid" ? "paid" : "pending"}>{getOrderPaymentLabel(order)}</span><span className="order-view-link" aria-label="View details" title="View details"><AppIcon name="arrowShort" size={20}/></span></div></article>)}</div> : <section className="orders-empty"><div className="orders-empty-copy"><p className="eyebrow">NO ACTIVE ORDERS</p><h2>No deliveries in progress.</h2><p>New orders will appear here. Completed and cancelled orders are in Activity.</p><button className="primary-button" onClick={onShop}>Start an order <AppIcon name="arrow" size={18}/></button></div></section>}</div>;
}

const deliverySteps = [
  { status: "confirmed", title: "Order confirmed", copy: "Mobsol has received your order." },
  { status: "preparing", title: "Preparing your exchange", copy: "Your full cylinder is being prepared." },
  { status: "assigned", title: "Dispatcher assigned", copy: "We’ll let you know when your dispatcher is on the way." },
  { status: "on_the_way", title: "On the way", copy: "Your exchange is heading to the delivery address." },
  { status: "delivered", title: "Delivered", copy: "Your full cylinder has arrived and the empty one has been collected." },
] as const;

const deliveryProgress: Record<string, number> = { pending: 0, confirmed: 1, preparing: 2, awaiting_rider: 2, assigned: 3, accepted: 3, on_the_way: 4, arrived: 4, delivered: 5, cancelled: 0, failed_delivery: 0 };

function getOrderPaymentLabel(order: Pick<CustomerOrder, "payment_status" | "payment_method">) {
  if (order.payment_method === "cash") return "Pay on delivery";
  return order.payment_status === "paid" ? "Paid" : order.payment_status.replaceAll("_", " ");
}

function getOrderPaymentMethodLabel(method: string | null) {
  if (method === "paystack") return "Paystack";
  if (method === "cash") return "Cash on delivery";
  return method ? method.replaceAll("_", " ") : "Payment method";
}

function getDeliveryStatusCopy(status: string) {
  const copy: Record<string, { title: string; message: string }> = {
    pending: { title: "Order received", message: "Your order is in the system. We’ll update you as it’s confirmed." },
    confirmed: { title: "Order confirmed", message: "Your exchange is confirmed and will be prepared next." },
    preparing: { title: "Preparing your exchange", message: "Your full cylinder is being prepared for dispatch." },
    awaiting_rider: { title: "Finding a dispatcher", message: "Your order is ready and we’re arranging dispatch." },
    assigned: { title: "Dispatcher assigned", message: "Your dispatcher has been assigned. We’ll notify you when they set off." },
    accepted: { title: "Dispatcher assigned", message: "Your dispatcher has accepted the delivery." },
    on_the_way: { title: "On the way", message: "Your Mobsol exchange is on its way to the delivery address." },
    arrived: { title: "Dispatcher has arrived", message: "Your dispatcher has reached the delivery address." },
    delivered: { title: "Delivered", message: "Your full cylinder has arrived and the empty one has been collected." },
    cancelled: { title: "Order cancelled", message: "This order has been cancelled. Contact Mobsol if you need help." },
    failed_delivery: { title: "Delivery needs attention", message: "We couldn’t complete this delivery. Contact Mobsol support for help." },
  };
  return copy[status] ?? { title: status.replaceAll("_", " "), message: "We’ll keep you updated as your order progresses." };
}

function OrderTrackingView({ order, onClose }: { order: CustomerOrder; onClose: () => void }) {
  const [sheetHeight, setSheetHeight] = useState(48);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragStart = useRef<{ pointerId: number; y: number; height: number; moved: boolean; lastY: number; lastAt: number; velocity: number } | null>(null);
  const suppressHandleClick = useRef(false);
  const sheetExpanded = sheetHeight > 60;
  const clampSheetHeight = (height: number) => Math.max(48, Math.min(86, height));
  const beginSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerId: event.pointerId, y: event.clientY, height: sheetHeight, moved: false, lastY: event.clientY, lastAt: performance.now(), velocity: 0 };
    setIsDraggingSheet(true);
  };
  const moveSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const delta = start.y - event.clientY;
    start.velocity = (event.clientY - start.lastY) / Math.max(1, performance.now() - start.lastAt);
    start.lastY = event.clientY;
    start.lastAt = performance.now();
    if (Math.abs(delta) > 5) start.moved = true;
    setSheetHeight(clampSheetHeight(start.height + delta / window.innerHeight * 100));
  };
  const endSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const deltaY = event.clientY - start.y;
    const finalHeight = clampSheetHeight(start.height - deltaY / window.innerHeight * 100);
    if (event.currentTarget.hasPointerCapture(start.pointerId)) event.currentTarget.releasePointerCapture(start.pointerId);
    if (start.moved) {
      suppressHandleClick.current = true;
    }
    dragStart.current = null;
    setIsDraggingSheet(false);
    setSheetHeight(finalHeight >= 61 ? 82 : 48);
  };
  const cancelSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    if (event.currentTarget.hasPointerCapture(start.pointerId)) event.currentTarget.releasePointerCapture(start.pointerId);
    dragStart.current = null;
    setIsDraggingSheet(false);
    setSheetHeight(start.height);
  };
  const toggleSheet = () => setSheetHeight((height) => height > 60 ? 48 : 82);
  const status = getDeliveryStatusCopy(order.delivery_status);
  const progress = deliveryProgress[order.delivery_status] ?? 0;
  const coordinates = order.delivery_coordinates;
  const mapUrl = getOrderMapUrl(coordinates);
  const amount = (value: number) => `₦${(Number(value || 0) / 100).toLocaleString("en-NG")}`;
  const paymentLabel = getOrderPaymentLabel(order);
  const terminalStatus = order.delivery_status === "cancelled" || order.delivery_status === "failed_delivery";
  return <div className={`order-tracking-overlay${isClosing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tracking-order-title">
    <div className="tracking-map" aria-label="Map showing the delivery destination">
      {mapUrl ? <iframe title={`Map to ${order.delivery_address_snapshot}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer"/> : <div className="tracking-map-unavailable"><AppIcon name="location" size={25}/><b>Delivery map unavailable</b><span>We couldn’t load a map location for this order.</span></div>}
      <div className="tracking-map-shade" aria-hidden="true"/>
      <div className="tracking-topbar"><button type="button" aria-label="Back to orders" onClick={() => { if (isClosing) return; setIsClosing(true); window.setTimeout(onClose, 340); }}><AppIcon name="back" size={22}/></button><span><small>DELIVERY DESTINATION</small><b>{order.delivery_address_snapshot}</b></span></div>
      {!googleMapsEmbedKey && <a className="tracking-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}
    </div>
    <section className={`order-detail-sheet${sheetExpanded ? " is-expanded" : ""}${isDraggingSheet ? " is-dragging" : ""}${isClosing ? " is-closing" : ""}`} style={{ height: `${sheetHeight}dvh` }} aria-label={`Order ${order.order_number} details`}>
      <div className="tracking-sheet-handle" role="button" tabIndex={0} aria-label={sheetExpanded ? "Collapse order details" : "Expand order details"} onPointerDown={beginSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={endSheetDrag} onPointerCancel={cancelSheetDrag} onClick={() => { if (suppressHandleClick.current) { suppressHandleClick.current = false; return; } toggleSheet(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSheet(); } }}><i/></div>
      <div className="tracking-sheet-scroll">
        <p className="eyebrow">ORDER #{order.order_number}</p>
        <div className="tracking-status-heading"><div><h1 id="tracking-order-title">{status.title}</h1><p>{status.message}</p></div></div>
        {order.delivery_status === "on_the_way" && <div className="tracking-live-note"><span className="tracking-live-dot"/>Mobsol has marked this delivery on the way. Live dispatcher location will appear here once GPS tracking is connected.</div>}
        {order.delivery_status !== "on_the_way" && order.delivery_status !== "delivered" && !terminalStatus && <div className="tracking-map-note">The map is centered on your delivery destination. Live tracking will begin when your dispatcher is on the way.</div>}
        <div className="tracking-timeline" aria-label="Delivery progress">{deliverySteps.map((step, index) => { const active = progress > index; const current = (progress === index + 1 || (order.delivery_status === "pending" && index === 0)) && !terminalStatus; return <div key={step.status} className={`tracking-step${active ? " is-complete" : ""}${current ? " is-current" : ""}`}><span className="tracking-step-indicator">{active ? <AppIcon name="readAll" size={14}/> : <i/>}</span><span><b>{step.title}</b><small>{step.copy}</small></span></div>; })}</div>
        <section className="tracking-info-section"><h2>Order details</h2><div className="tracking-items">{order.order_items?.map((item, index) => <div key={`${item.weight_kg_snapshot}-${index}`}><span><b>{item.weight_kg_snapshot} kg cylinder</b><small>Full cylinder · empty exchange</small></span><strong>× {item.quantity}</strong></div>)}</div><div className="tracking-price-row"><span>Gas subtotal</span><b>{amount(order.gas_subtotal_kobo)}</b></div><div className="tracking-price-row"><span>Delivery</span><b>{order.delivery_fee_kobo ? amount(order.delivery_fee_kobo) : "To be confirmed"}</b></div><div className="tracking-price-row tracking-total-row"><span>Total</span><b>{amount(order.total_kobo)}</b></div></section>
        <section className="tracking-info-section tracking-recipient"><h2>Delivery details</h2><div><AppIcon name="location" size={19}/><span><b>{order.recipient_name || "Recipient"}</b><small>{order.delivery_address_snapshot}</small></span></div>{order.recipient_phone && <div><AppIcon name="profile" size={19}/><span><b>Recipient contact</b><small>{order.recipient_phone}</small></span></div>}<div><AppIcon name="wallet" size={19}/><span><b>Payment · {paymentLabel}</b><small>{getOrderPaymentMethodLabel(order.payment_method)}</small></span></div></section>
        {order.delivery_status === "assigned" || order.delivery_status === "accepted" || order.delivery_status === "on_the_way" || order.delivery_status === "arrived" ? <div className="tracking-dispatcher-note">Dispatcher contact details will appear here when they’re shared with your order.</div> : null}
      </div>
    </section>
  </div>;
}

function CartPage({ entries, cart, updateQuantity, onCheckout, onShop, onSetLocation, address, gasRatePerKg }: { entries: Product[]; cart: Record<number, number>; updateQuantity: (kg: number, delta: number) => void; onCheckout: () => void; onShop: () => void; onSetLocation: () => void; address: string; gasRatePerKg: number }) {
  const [swipedKg, setSwipedKg] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const gasSubtotal = entries.reduce((total, product) => total + product.kg * gasRatePerKg * cart[product.kg], 0);
  return <div className="secondary-page">{entries.length === 0 ? <div className="empty-panel"><h2>Your cart is empty.</h2><p>Add a Mobsol cylinder to start an exchange order.</p><button className="primary-button" onClick={onShop}>Browse cylinders</button></div> : <><div className="cart-page-grid"><div className="cart-lines"><div className="cart-list-heading"><span>{entries.length} cylinder size{entries.length === 1 ? "" : "s"} selected</span><button onClick={onShop}>Add another size <AppIcon name="plus" size={14}/></button></div>{entries.map((product) => <div key={product.kg} className="cart-line-swipe" onPointerDown={(event) => { touchStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => { const start = touchStart.current; const deltaX = start ? event.clientX - start.x : 0; const deltaY = start ? event.clientY - start.y : 0; touchStart.current = null; if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) { if (Math.abs(deltaX) > 30) setSwipedKg(null); return; } setSwipedKg(deltaX < 0 ? product.kg : null); }}><button type="button" className="cart-line-delete" aria-label={`Remove all ${product.kg} kg cylinders from cart`} onClick={() => { updateQuantity(product.kg, -cart[product.kg]); setSwipedKg(null); }}><AppIcon name="delete" size={20}/></button><article className={`cart-line${swipedKg === product.kg ? " is-swiped" : ""}`}><Cylinder size={product.kg}/><div><b>{product.kg} kg Mobsol cylinder</b><small>Full cylinder · empty exchange</small><span>₦{(product.kg * gasRatePerKg).toLocaleString("en-NG")} each · gas</span></div><div className="quantity-control"><button onClick={() => updateQuantity(product.kg, -1)} aria-label={`Remove one ${product.kg} kg cylinder`}>−</button><b>{cart[product.kg]}</b><button onClick={() => updateQuantity(product.kg, 1)} aria-label={`Add one ${product.kg} kg cylinder`}>＋</button></div></article></div>)}</div><aside className="cart-review"><h2 className="cart-review-title">Order summary</h2><div className="review-qty"><span>{entries.reduce((total, product) => total + cart[product.kg], 0)} cylinder exchange{entries.reduce((total, product) => total + cart[product.kg], 0) === 1 ? "" : "s"}</span><small>Empty Mobsol cylinder collected at delivery</small></div><div className="review-total"><span>Gas subtotal</span><b>₦{gasSubtotal.toLocaleString("en-NG")}</b></div><button className="cart-location" onClick={onSetLocation}><span className="cart-location-icon"><AppIcon name="location" size={19}/></span><span className="cart-location-copy"><small>Delivery location</small><b>{address || "Add your delivery address"}</b><em>{address ? "Tap to change delivery address" : "Choose an address to check delivery"}</em></span></button><p>Delivery is calculated after your area is checked.</p><button className="primary-button wide" onClick={onCheckout}>Continue to checkout</button></aside></div><div className="connection-note"><AppIcon name="help" size={16}/> Your selection stays here while you browse. No charge is made until an order is confirmed.</div></>}</div>;
}
function SupportPage({ onBack, onShop, onSetLocation, closing }: { onBack: () => void; onShop: () => void; onSetLocation: () => void; closing: boolean }) {
  return <div className={`secondary-page support-page${closing ? " page-exiting" : ""}`}><header className="settings-page-header support-page-header"><button type="button" className="settings-back" aria-label="Back" onClick={onBack}><AppIcon name="back" size={25}/></button><h1>How can we help?</h1></header><p className="secondary-intro">Quick answers about your cylinder exchange and delivery.</p><div className="support-action-row"><button onClick={onShop}><AppIcon name="plus" size={19}/><span className="support-action-copy"><b>Start an order</b><small>Choose a Mobsol cylinder</small></span><AppIcon name="arrowShort" size={18}/></button><button onClick={onSetLocation}><AppIcon name="location" size={19}/><span className="support-action-copy"><b>Check your location</b><small>See if delivery is available</small></span><AppIcon name="arrowShort" size={18}/></button></div><section className="faq-section"><p className="eyebrow">COMMON QUESTIONS</p><details className="faq-item"><summary>How does the cylinder exchange work?<AppIcon name="plus" size={17}/></summary><p>Choose a full Mobsol cylinder and place your order. At delivery, the rider brings the full cylinder and collects your empty Mobsol cylinder. Mobsol does not refill cylinders at home.</p></details><details className="faq-item"><summary>Can I order for someone else?<AppIcon name="plus" size={17}/></summary><p>Yes. During checkout, choose “Someone else” and enter the recipient’s name, phone number, and Abuja delivery address. You can choose who is expected to pay.</p></details><details className="faq-item"><summary>How do I know if my area is covered?<AppIcon name="plus" size={17}/></summary><p>Enter your delivery address and Mobsol will check it against active service zones. Live zone verification is not connected in this preview.</p></details><details className="faq-item"><summary>When will I see the price?<AppIcon name="plus" size={17}/></summary><p>The current gas rate and each cylinder’s gas price are shown on the home page and in your cart. Delivery is added after your service area is checked.</p></details></section><div className="support-contact"><span className="support-contact-icon"><AppIcon name="support" size={20}/></span><div><b>Need more help?</b><p>Mobsol’s phone and chat support details will appear here when the customer support channels are configured.</p></div></div></div>;
}
