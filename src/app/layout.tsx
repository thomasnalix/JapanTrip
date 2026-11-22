import type { Metadata } from 'next';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import './globals.css';

config.autoAddCss = false;

export const metadata: Metadata = {
  title: 'Japon',
  description:
    'Carte interactive, activités, étapes et couverture météo pour le voyage au Japon.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased selection:bg-[#C83228]/15 selection:text-[#09090B]">
        {children}
      </body>
    </html>
  );
}
