'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';

import 'react-day-picker/style.css';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('rounded-md border bg-background p-3 shadow-sm', className)}
      {...props}
    />
  );
}
