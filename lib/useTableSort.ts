"use client";

import { useState } from "react";

export type SortValue = string | number | null | undefined;

// Сортировка таблицы кликом по заголовку колонки.
// defaultField = null — до первого клика сохраняется исходный порядок строк.
export function useTableSort<F extends string>(defaultField: F | null = null, defaultAsc = true) {
  const [sortField, setSortField] = useState<F | null>(defaultField);
  const [sortAsc, setSortAsc] = useState(defaultAsc);

  function toggleSort(field: F) {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  // Стрелка только у активной колонки
  function arrow(field: F) {
    if (sortField !== field) return "";
    return sortAsc ? " ↑" : " ↓";
  }

  return { sortField, sortAsc, setSortField, setSortAsc, toggleSort, arrow };
}

// Пустые значения (null/undefined/"") всегда в конце, независимо от направления
export function compareValues(a: SortValue, b: SortValue, asc: boolean): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "ru");
  return asc ? cmp : -cmp;
}
