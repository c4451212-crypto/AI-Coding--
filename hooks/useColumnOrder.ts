'use client';

import { useCallback, useState } from 'react';

// 骨架：列顺序持久化（后续对接 `/api/users/me/preferences`）
export function useColumnOrder(initial: string[]) {
  const [columns, setColumns] = useState<string[]>(initial);

  const setOrder = useCallback((next: string[]) => {
    setColumns(next);
  }, []);

  return { columns, setOrder };
}
