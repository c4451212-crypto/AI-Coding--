import type { ReactNode } from 'react';

import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh flex">
        <Sidebar />
        <div className="min-w-0 flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-4">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
