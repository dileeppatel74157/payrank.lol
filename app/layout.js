const title = 'PayRank — Buy Your Way to #1';
const description = 'PayRank is a public leaderboard where websites, products and creators compete for attention. Bid higher to claim a higher rank.';

export const metadata = {
  title,
  description,
  metadataBase: new URL('https://www.payrank.lol'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/logo/payrank-icon.png',
    shortcut: '/logo/payrank-icon.png',
    apple: '/logo/payrank-icon.png',
  },
  openGraph: {
    title,
    description,
    url: 'https://www.payrank.lol/',
    siteName: 'PayRank',
    type: 'website',
    images: [
      {
        url: '/logo/payrank-horizontal.png',
        width: 800,
        height: 400,
        alt: 'PayRank.LOL Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@payranklol',
    title,
    description,
    images: ['/logo/payrank-horizontal.png'],
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
