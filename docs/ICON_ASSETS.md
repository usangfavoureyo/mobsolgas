# Icon assets

The supplied `hugeroundedicons` folder contains 79 SVG files. Copies are stored in both client asset folders:

- Web: `apps/web/public/icons/hugeroundedicons/`
- iOS / Android: `apps/mobile/assets/icons/hugeroundedicons/`

The set includes useful home, profile, support/chat, help, saved/bookmark, search, location pin, settings, theme, notification, arrow, and status-adjacent icons. It includes paired solid and stroke variants for home, profile, bookmark, chat, mail, search, play, and share.

The copied `archive-04-stroke-rounded.svg` contains an SVG parser error instead of an icon and must not be used.

## Initial customer navigation mapping

| Destination | Available asset |
| --- | --- |
| Home | `home-01-solid-rounded.svg` / `home-01-stroke-rounded.svg` |
| Orders | `bookmark-02-solid-rounded.svg` / `bookmark-02-stroke-rounded.svg` (temporary; receipt/order-specific pair is preferable) |
| Cart | `shopping-cart-02-stroke-rounded.svg`; active state fills the basket using matching path geometry |
| Support | `bubble-chat-solid-rounded.svg` / `bubble-chat-stroke-rounded.svg` |

The project brief requires an authentic solid active icon and a stroke inactive icon. Keep supplied SVG geometry and use the Mobsol accent color for the selected state.

## Useful additions

For the customer navigation and key delivery flows, the most useful additions are:

- Shopping cart/basket is now available in stroke form; a matching supplied solid variant would allow a fully filled active glyph.
- Receipt/order history, solid and stroke (bookmark pair is a temporary semantic fit).
- Map marker/location pin, solid and stroke, plus current-location/GPS.
- Delivery vehicle/rider, route, and ETA/clock.
- Cash, POS terminal, and payment card.
- Cylinder illustration/product imagery for the 6 kg, 12 kg, and 22 kg products (photography/illustration rather than a generic nav icon).

Profile, home, help/chat, search, notification, settings, theme sun/moon, and basic arrows are already present. The web app renders SVGs through a current-color mask. The native app uses an SVG transformer and `react-native-svg`; copied black strokes are normalized to current color. A raw SVG path alone does not render as a native image.
