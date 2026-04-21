import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SDO Koronadal — Leave Management System',
  description: 'Employee Records & HR Management System — SDO City of Koronadal, DepEd Region XII',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
