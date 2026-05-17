"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SortState } from "./columns";

export interface TableState {
  query: string;
  page: number;
  pageSize: number;
  sort: SortState | null;
  /** Arbitrary filters (e.g. status="low"). */
  filters: Record<string, string>;
  hiddenCols: Set<string>;
}

interface UseTableStateOptions {
  /** Stable key used as the localStorage namespace (e.g. "products-table"). */
  storageKey: string;
  defaultPageSize?: number;
  defaultSort?: SortState;
  defaultHiddenCols?: string[];
  /** Filter keys allowed in the URL (?filter[<key>]=...). */
  filterKeys?: readonly string[];
}

interface PrefsShape {
  pageSize: number;
  hiddenCols: string[];
}

function readPrefs(key: string): Partial<PrefsShape> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`dt:${key}`);
    return raw ? (JSON.parse(raw) as PrefsShape) : {};
  } catch {
    return {};
  }
}

function writePrefs(key: string, prefs: PrefsShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`dt:${key}`, JSON.stringify(prefs));
  } catch {
    /* localStorage may be full or blocked */
  }
}

function parseSort(input: string | null): SortState | null {
  if (!input) return null;
  const [id, dir] = input.split(":");
  if (!id || (dir !== "asc" && dir !== "desc")) return null;
  return { id, dir };
}

/**
 * Hook that mirrors the table's state into the URL (query + sort + page +
 * single-value filters) and persists column visibility + page size into
 * localStorage. The URL is the source of truth for the parts you'd share.
 */
export function useTableState({
  storageKey,
  defaultPageSize = 25,
  defaultSort = undefined,
  defaultHiddenCols = [],
  filterKeys = [],
}: UseTableStateOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const prefs = useMemo(() => readPrefs(storageKey), [storageKey]);

  const initialState: TableState = useMemo(() => {
    const filters: Record<string, string> = {};
    for (const k of filterKeys) {
      const v = searchParams.get(`filter[${k}]`);
      if (v) filters[k] = v;
    }
    return {
      query: searchParams.get("q") ?? "",
      page: Number(searchParams.get("page")) || 1,
      pageSize: prefs.pageSize ?? defaultPageSize,
      sort: parseSort(searchParams.get("sort")) ?? defaultSort ?? null,
      filters,
      hiddenCols: new Set(prefs.hiddenCols ?? defaultHiddenCols),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<TableState>(initialState);

  // Persist column visibility + page size whenever they change.
  useEffect(() => {
    writePrefs(storageKey, {
      pageSize: state.pageSize,
      hiddenCols: Array.from(state.hiddenCols),
    });
  }, [storageKey, state.pageSize, state.hiddenCols]);

  // Push URL when query/page/sort/filters change.
  useEffect(() => {
    const next = new URLSearchParams();
    if (state.query) next.set("q", state.query);
    if (state.page > 1) next.set("page", String(state.page));
    if (state.sort) next.set("sort", `${state.sort.id}:${state.sort.dir}`);
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) next.set(`filter[${k}]`, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.query, state.page, state.sort, JSON.stringify(state.filters)]);

  const setQuery = useCallback(
    (q: string) => setState((s) => ({ ...s, query: q, page: 1 })),
    []
  );
  const setPage = useCallback(
    (p: number) => setState((s) => ({ ...s, page: Math.max(1, p) })),
    []
  );
  const setPageSize = useCallback(
    (n: number) => setState((s) => ({ ...s, pageSize: n, page: 1 })),
    []
  );
  const toggleSort = useCallback((id: string) => {
    setState((s) => {
      if (!s.sort || s.sort.id !== id) return { ...s, sort: { id, dir: "asc" }, page: 1 };
      if (s.sort.dir === "asc") return { ...s, sort: { id, dir: "desc" } };
      return { ...s, sort: null };
    });
  }, []);
  const setFilter = useCallback(
    (key: string, value: string) =>
      setState((s) => ({
        ...s,
        filters: value ? { ...s.filters, [key]: value } : omit(s.filters, key),
        page: 1,
      })),
    []
  );
  const toggleColumn = useCallback((id: string) => {
    setState((s) => {
      const next = new Set(s.hiddenCols);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, hiddenCols: next };
    });
  }, []);

  return {
    state,
    setQuery,
    setPage,
    setPageSize,
    toggleSort,
    setFilter,
    toggleColumn,
  };
}

function omit<T extends Record<string, string>>(obj: T, key: string): T {
  const { [key]: _, ...rest } = obj;
  void _;
  return rest as T;
}
