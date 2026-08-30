"use client";

import React from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  CircleHelp,
  FileText,
  Menu,
  Sparkles,
  UserRound,
} from "lucide-react";

function Brand() {
  return (
    <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <span className="grid size-6 place-items-center rounded-md bg-foreground text-background">
        <Check className="size-4" strokeWidth={3} />
      </span>
      VedaAI
    </div>
  );
}

export function Topbar() {
  return (
    <header className="hidden h-14 w-full shrink-0 items-center justify-between gap-2 rounded-2xl bg-background pl-6 pr-4 shadow-sm border border-border/50 lg:flex">
      <div className="flex items-center gap-3">
        <ArrowLeft className="size-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <FileText className="size-3.5" />
          Exams
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircleHelp className="size-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
        <div className="relative">
          <Bell className="size-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-orange" />
        </div>
        <Sparkles className="size-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
        <div className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <span className="grid size-6 place-items-center rounded-full bg-muted">
            <UserRound className="size-4 text-foreground" />
          </span>
          Madhur Rastogi
          <span className="text-muted-foreground text-[10px]">⌄</span>
        </div>
      </div>
    </header>
  );
}

export function MobileHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between rounded-2xl border border-border bg-background px-4 lg:hidden mb-2">
      <div className="flex items-center gap-3">
        <ArrowLeft className="size-5 text-muted-foreground" />
        <Brand />
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="size-5 text-muted-foreground" />
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-orange" />
        </div>
        <span className="grid size-7 place-items-center rounded-full bg-muted">
          <UserRound className="size-5 text-foreground" />
        </span>
        <Menu className="size-5 text-muted-foreground" />
      </div>
    </header>
  );
}
