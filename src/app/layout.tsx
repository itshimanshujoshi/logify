import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Logify — Slack to .xlsx Timesheet',
  description: 'Paste your Slack work messages and instantly generate a formatted Excel timesheet. Edit every cell before downloading. Free, no sign-up, no data stored.',
  keywords: ['timesheet', 'slack', 'excel', 'xlsx', 'work log', 'logify', 'generator'],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
