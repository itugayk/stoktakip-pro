This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Phone / LAN Access

From the repository root, start the app with:

```bash
pnpm dev:lan
```

The command prints a `Network:` URL such as `http://192.168.1.25:3000`. Open that URL from a phone on the same Wi-Fi network.

Phone camera access requires a secure origin. To use barcode scanning from a phone during development, start the LAN server with HTTPS:

```bash
pnpm dev:lan:https
```

Open the printed `https://192.168.x.x:3000` address on the phone. If the browser shows a certificate warning, accept it once for this local development server.

The easiest phone-camera path is a secure tunnel. This avoids local certificate warnings:

```bash
pnpm build
pnpm start:lan
pnpm tunnel
```

Open the printed `https://*.trycloudflare.com` address on the phone. The tunnel stays online only while the `pnpm tunnel` process is running.

Localtunnel is also available as a fallback, but it may show an extra browser verification screen:

```bash
pnpm tunnel:local
```

For a production build:

```bash
pnpm build
pnpm start:lan
```

If the phone cannot open the printed address, allow Node.js through Windows Defender Firewall on Private networks.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
