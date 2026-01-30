export const metadata = {
  title: "Weinfreunde Tasting App",
  description: "Blindverkostung – digital bewerten & auswerten",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
