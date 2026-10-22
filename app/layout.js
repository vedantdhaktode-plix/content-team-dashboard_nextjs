import "./globals.css";

export const metadata = {
  title: "Content Team | Brand Perf Edit",
  description: "Content Team script dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
