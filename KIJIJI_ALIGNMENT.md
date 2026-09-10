# Kijiji-inspired browsing pass

The direct homepage request returned HTTP 429, so this review used indexed Kijiji listing pages and official Kijiji Community Connect guides. This is a workflow alignment, not a pixel-for-pixel reproduction of an inspected live homepage.

Sources:
- https://www.kijiji.ca/b-calgary/post-ad/k0l1700199 — category/location/price filters and listing results.
- https://community.kijiji.ca/t/radial-search-how-search-works-on-kijiji/163 — location, sorting, condition and price-range filters; promoted ads separate from organic sorting.
- https://community.kijiji.ca/t/favorite-kijiji-listings/164 — favourite hearts and access from the header.

Implemented:
- Horizontal navigation, prominent global search, real search-scope and broad-zone selectors, persistent Post ad and favourites buttons.
- Compact homepage introduction, recognizable category tiles and more local listing cards above the community guide.
- Search across listings, services, businesses and offers, with category/condition/price controls, mobile filter disclosure and list/grid modes.
- Clickable listing titles opening a detail preview; local-browser favourites persist across reloads.
- Correct price ordering with unknown prices last, corrected local-fixture recency sorting and no sponsored priority in organic ordering.
- Arabic remains default with RTL; English remains available throughout.

Retained Madinaty branding and limited local taxonomy. No Kijiji logos, listing content or proprietary assets were copied. No location-radius control was added because the app uses broad zones and has no verified coordinates. The rejected personal photograph is no longer displayed; its existing source file remains recoverable in public/images.

Still a prototype: listings created during a visit are transient; favourites persist locally but are not account-synced. Detail previews do not enable real transactions, notifications or contact. Backend authentication, moderation, uploads and SEO routes remain separate work.
