const title = 'PayRank — the price to be seen';
const description = 'Pay to rank. Outbid whoever is above you. Every dollar is public.';

export const metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: 'https://payrank.lol',
    siteName: 'PayRank',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    site: '@payranklol',
    title,
    description,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
