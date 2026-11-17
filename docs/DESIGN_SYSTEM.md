# Mobsol Gas design system

## Product direction

Build a premium, minimal mobility and delivery application. The supplied Uber screenshots are references for app-like composition and interaction: map and location first, clear search and destination selection, practical account screens, and a floating navigation pill on mobile. Use Mobsol language, colors, and LPG exchange flows; do not copy Uber branding, labels, or blue accent.

## Brand and theme

- Primary orange: `#EC5E12`; amber accent: `#E5910B`; deep red: `#C83120`.
- Light mode uses white or very light neutral backgrounds, near-black text, soft borders, subtle shadows, and orange actions.
- Dark mode uses charcoal backgrounds and elevated dark surfaces, readable light text, visible soft borders, and restrained orange accents.
- Reserve deep red for destructive, warning, or critical states.
- Default to the operating-system theme. Offer Light / Dark / System in settings and persist the preference.
- Define semantic tokens for primary, surfaces, text, borders, success, warning, error, and disabled states. Every component must work in both themes.

## Type and icons

- Use SF Pro / SF Display where available, with system fallbacks and Inter where needed.
- Use tabular numerals for prices, order numbers, and key measures.
- Use Hugeicons with consistent rounded weight. Use real solid variants for selected navigation and stroke variants for inactive navigation. Do not use emoji or opacity to fake icon states.
- Use the supplied rounded Hugeicons SVG set as the current asset source; see [ICON_ASSETS.md](ICON_ASSETS.md).

## Customer app structure

- App opens directly to the customer experience, not a marketing landing page.
- Floating top-left delivery-location selector and top-right circular profile control. No centered logo in the home top bar.
- Four mobile destinations: Home, Orders, Cart, Support, in a floating bottom navigation pill. Selected states use filled icons; inactive states use stroke icons.
- Home prioritizes selected location, a clear gas ordering action, 6 kg / 12 kg / 22 kg products with backend prices and availability, delivery fee context, active order status, and relevant recent orders or announcements.
- Checkout preserves cart and recipient state. It supports self or another recipient, address selection or creation, delivery instructions, order review, available payment method, and confirmation.
- Location selection supports GPS, search, map pin adjustment, saved addresses, labels, and server-validated service-zone coverage.
- Tracking shows real rider location, destination, route, ETA, rider contact, and order status. Simulated movement is permitted only in clearly labeled demo mode.

## Profile wallet

- Wallet opens as a full page from Profile, with a clear back action and the available NGN balance.
- Provide separate Add funds and Withdraw actions, followed by saved payment methods and an Add payment method action.
- Include a Promotions area with Add promo code. Do not add trip profiles, business-travel profiles, or a received-vouchers section.
- Show transaction history, loading/empty/error states, and withdrawal/payment status when wallet services are connected. Never imply that a transfer completed before the server confirms it.

## Interaction and responsive behavior

- Mobile-first for customer and rider; desktop-efficient admin that still works on tablet and phone. Do not stretch phone layouts to desktop.
- Use bottom sheets on mobile when they improve a flow; respect safe areas, preserve unsaved work, and support clear dismiss/expand behavior. Use contextual anchored panels on desktop.
- Mobile top controls and bottom navigation hide on downward scroll and return on upward scroll with thresholds and hysteresis. Keep them visible during checkout and while a modal or sheet is open; respect reduced motion.
- Tapping the active bottom-navigation tab scrolls that page to the top.
- Touch targets, keyboard navigation, focus states, accessible labels, contrast, and screen-reader status messages are required. Never use color alone to communicate status.
- No horizontal overflow, clipped controls, or content hidden under navigation. Responsive tables become usable mobile lists/cards.

## Shared product across clients

Web, PWA, iOS, and Android share the same visual language, customer account, backend data, and order lifecycle. Platform-specific layout and native behavior are allowed where they improve usability.

- The web app remains usable by URL and installable as a PWA through a manifest and appropriate caching.
- Cache only safe public data; never put private customer data in a shared cache.
- Native iOS and Android are first-class clients, not website wrappers.
- Rider and admin retain role-specific workflows and navigation while sharing design tokens and components where appropriate.

## Quality bar

Use clear hierarchy, generous but purposeful spacing, restrained shadows, subtle borders, well-designed product cards, helpful empty/loading/error states, and meaningful micro-interactions. Avoid generic dashboards, oversized hero areas, random rounded cards, fake metrics, excessive gradients, glass effects, and ornamental illustration.
