import Link from 'next/link';

import { GlobalSearch } from '@/components/common/GlobalSearch';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="font-semibold md:hidden">wjglxt</div>
        <div className="hidden flex-1 md:block">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="md:hidden">
            <Link href="/">搜索</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary">
                用户菜单
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/login">退出（占位）</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="border-t px-3 py-2 md:hidden">
        <GlobalSearch />
      </div>
    </header>
  );
}
