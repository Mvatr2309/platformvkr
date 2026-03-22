"use client";

import { useState, useEffect } from "react";

const cache: Record<string, string[]> = {};

export function useDictionary(type: string): string[] {
  const [values, setValues] = useState<string[]>(cache[type] || []);

  useEffect(() => {
    if (cache[type]) {
      setValues(cache[type]);
      return;
    }
    fetch(`/api/dictionaries?type=${type}`)
      .then((r) => r.json())
      .then((data: string[]) => {
        cache[type] = data;
        setValues(data);
      })
      .catch(() => {});
  }, [type]);

  return values;
}

export function useDictionaries(...types: string[]): Record<string, string[]> {
  const [all, setAll] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Check if all cached
    const allCached = types.every((t) => cache[t]);
    if (allCached) {
      const result: Record<string, string[]> = {};
      types.forEach((t) => { result[t] = cache[t]; });
      setAll(result);
      return;
    }

    fetch("/api/dictionaries")
      .then((r) => r.json())
      .then((data: Record<string, string[]>) => {
        Object.assign(cache, data);
        setAll(data);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join(",")]);

  return all;
}
