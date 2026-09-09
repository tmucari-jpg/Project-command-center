import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Project Command Center",
    template: "%s · Project Command Center",
  },
  description: "Centro de execução de projectos com foco em resultados, evidência e próxima acção.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
