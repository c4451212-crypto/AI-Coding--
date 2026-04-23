'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';

type Suggestion = { id: number; title: string; subtitle: string };

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (query.trim().length >= 2) {
      setLoading(true);
      timeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(query.trim())}&limit=5`,
            { credentials: 'include' },
          );
          const data = (await res.json()) as {
            code: number;
            data?: { suggestions: Suggestion[] };
            message?: string;
          };
          if (res.ok && data.code === 0 && data.data) {
            setSuggestions(data.data.suggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 220);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  function goFullSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/contracts/search?q=${encodeURIComponent(q)}`);
    setShowSuggestions(false);
    setQuery('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    goFullSearch();
  }

  function handleSuggestionClick(id: number) {
    router.push(`/contracts/${id}`);
    setShowSuggestions(false);
    setQuery('');
  }

  return (
    <div className="relative w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="搜索合同（≥2字，按 / 聚焦）"
            className="pl-9 pr-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
            aria-label="全局搜索"
          />
          {loading ? (
            <div className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : null}
        </div>
      </form>

      {showSuggestions && suggestions.length > 0 ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            aria-hidden
            onClick={() => setShowSuggestions(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="block w-full border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-accent"
                onClick={() => handleSuggestionClick(s.id)}
              >
                <div className="font-medium leading-snug">{s.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.subtitle}</div>
              </button>
            ))}
            <button
              type="button"
              className="block w-full border-t px-4 py-2 text-center text-sm text-primary hover:bg-accent"
              onClick={() => {
                goFullSearch();
              }}
            >
              查看全部搜索结果 →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
