# RegisterYourRep mobile (Expo)

Phone app for RegisterYourRep, built from the
[app design](https://claude.ai/artifact/PSW8EJaxjcvpjxRpYFtG4U). Tracked in Linear under RYR-17.

## Run it

```sh
cd mobile
npm install
npx expo start      # scan the QR code with Expo Go
```

Set `EXPO_PUBLIC_API_URL` to point at the Next.js API (defaults to `http://localhost:3000`).
On a physical phone use your computer's LAN IP, not `localhost`.

## Layout

- `src/app/` — routes (Expo Router). `(tabs)/` holds Home, Week, Progress and Plan; the rest are full-screen flows.
- `src/theme/` — colours, fonts, spacing and radii from the design. Screens use these, never raw hex values.
- `src/components/` — shared UI.
- `src/api/` — API client (sends the Privy token as a bearer token).

## Checks

```sh
npm run typecheck
```
