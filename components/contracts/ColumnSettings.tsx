'use client';

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const AVAILABLE_COLUMNS = [
  { key: 'sign_date', title: '签订日期', default: true },
  { key: 'company_id', title: '公司', default: true },
  { key: 'contract_no', title: '合同编号', default: true },
  { key: 'title', title: '标题', default: true },
  { key: 'contract_type', title: '类型', default: true },
  { key: 'total_amount', title: '金额', default: true },
  { key: 'end_date', title: '到期日', default: true },
  { key: 'status', title: '状态', default: true },
  { key: 'primary_handler', title: '第一接收人', default: false },
  { key: 'current_holder', title: '当前负责人', default: false },
  { key: 'party_company', title: '签订方', default: false },
  { key: 'storage_location', title: '存放位置', default: false },
  { key: 'return_status', title: '纸质件状态', default: false },
  { key: 'scan_file_path', title: '扫描件', default: false },
  { key: 'created_at', title: '创建时间', default: false },
] as const;

function SortableItem({
  id,
  title,
  onRemove,
}: {
  id: string;
  title: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex cursor-move items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-sm hover:border-primary"
      {...attributes}
      {...listeners}
    >
      <span className="text-muted-foreground">≡</span>
      <span className="whitespace-nowrap">{title}</span>
      <button
        type="button"
        className="ml-1 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="移除列"
      >
        ×
      </button>
    </div>
  );
}

export function ColumnSettings({
  currentOrder,
  currentPageSize,
  onSave,
}: {
  currentOrder: string[];
  currentPageSize: number;
  onSave: (nextOrder: string[], pageSize: number) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>(currentOrder);
  const [pageSize, setPageSize] = useState(currentPageSize);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(currentOrder);
      setPageSize(currentPageSize);
    }
  }, [open, currentOrder, currentPageSize]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleRemove(key: string) {
    setItems((prev) => prev.filter((k) => k !== key));
  }

  function handleAdd(key: string) {
    if (!items.includes(key)) setItems((prev) => [...prev, key]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(items, pageSize);
      setOpen(false);
    } catch (e) {
      window.alert((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setItems(AVAILABLE_COLUMNS.filter((c) => c.default).map((c) => c.key));
    setPageSize(30);
  }

  const unselected = AVAILABLE_COLUMNS.filter((c) => !items.includes(c.key));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          列设置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>自定义列表显示</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="mb-2 block text-sm font-medium">已显示字段（拖拽排序）</div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items} strategy={horizontalListSortingStrategy}>
                <div className="flex min-h-[52px] flex-wrap gap-2 rounded-lg border bg-muted/40 p-3">
                  {items.map((key) => {
                    const col = AVAILABLE_COLUMNS.find((c) => c.key === key);
                    return (
                      <SortableItem
                        key={key}
                        id={key}
                        title={col?.title || key}
                        onRemove={() => handleRemove(key)}
                      />
                    );
                  })}
                  {items.length === 0 ? (
                    <span className="py-2 text-sm text-muted-foreground">请从下方添加字段</span>
                  ) : null}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <div className="mb-2 block text-sm font-medium">可选字段（点击添加）</div>
            <div className="flex flex-wrap gap-2">
              {unselected.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  className="rounded-md border border-dashed px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
                  onClick={() => handleAdd(col.key)}
                >
                  + {col.title}
                </button>
              ))}
              {unselected.length === 0 ? (
                <span className="text-sm text-muted-foreground">已全部添加</span>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-2 block text-sm font-medium">每页显示</div>
            <div className="flex flex-wrap gap-2">
              {[10, 30, 50, 100].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`rounded-md px-4 py-2 text-sm transition-colors ${
                    pageSize === size
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                  onClick={() => setPageSize(size)}
                >
                  {size} 条
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={handleReset}>
              恢复默认
            </Button>
            <Button type="button" disabled={saving || items.length === 0} onClick={handleSave}>
              {saving ? '保存中…' : '保存设置'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
