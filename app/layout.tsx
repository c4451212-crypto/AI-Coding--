import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/toaster';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'wjglxt',
  description: '文件管理系统（骨架）',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
