"use client";

import React, { useState, useEffect } from "react";
import { CommandItem, fuzzySearchCommands } from "../lib/search/fuzzySearch";

export interface CommandPaletteProps {
  commands: CommandItem[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = fuzzySearchCommands(commands, query);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 p-4" data-testid="command-palette">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-slate-800 px-4 py-3">
          <svg className="h-5 w-5 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tasks, contracts... (Cmd+K)"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <kbd className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">ESC</kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching commands found.</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  item.action();
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer ${
                  idx === selectedIndex ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div>
                  <div className="font-medium">{item.title}</div>
                  {item.subtitle && <div className="text-[10px] opacity-75">{item.subtitle}</div>}
                </div>
                <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
