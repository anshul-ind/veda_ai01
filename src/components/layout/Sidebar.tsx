"use client";

import React from "react";
import Image from "next/image";
import { useAppStore } from "@/stores/app-store";
import {
  BookOpen,
  FileText,
  LayoutGrid,
  PanelLeft,
  Settings,
  Sparkles,
} from "lucide-react";

function Brand({ isExpanded }: { isExpanded: boolean }) {
  if (!isExpanded) {
    return (
      <div className="flex items-center justify-center">
        <span className="grid size-7 place-items-center rounded-md bg-foreground text-background font-bold text-sm">
          V
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-6 w-24">
        <Image
          src="/logo.png"
          alt="VedaAI Logo"
          fill
          className="object-contain object-left"
          priority
        />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isSidebarExpanded, toggleSidebarExpanded } = useAppStore();

  const items = [
    { label: "Home", icon: LayoutGrid },
    { label: "My Classroom", icon: BookOpen },
    { label: "Assignments", icon: FileText },
    { label: "Exams", icon: FileText, active: true },
    { label: "My Library", icon: BookOpen },
  ];

  return (
    <aside
      className={`fixed inset-y-3 left-3 z-20 hidden flex-col justify-between rounded-[16px] bg-background p-5 lg:flex shadow-sm border border-border/50 transition-all duration-200 ${
        isSidebarExpanded ? "w-[304px]" : "w-[76px]"
      }`}
    >
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Brand isExpanded={isSidebarExpanded} />
          <button
            onClick={toggleSidebarExpanded}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
            title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <PanelLeft className="size-4" />
          </button>
        </div>

        {/* Toolkit Button: Dark background, 2px orange/coral border, pill shape */}
        {isSidebarExpanded ? (
          <button className="flex items-center justify-center gap-2 rounded-full border-2 border-orange bg-[#1a1a1a] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity">
            <Sparkles className="size-3.5 text-orange" />
            <span>AI Teacher&apos;s Toolkit</span>
          </button>
        ) : (
          <button
            className="grid size-10 place-items-center rounded-full border-2 border-orange bg-[#1a1a1a] text-white mx-auto shadow-xs"
            title="AI Teacher's Toolkit"
          >
            <Sparkles className="size-4 text-orange" />
          </button>
        )}

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {items.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                active
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              } ${!isSidebarExpanded ? "justify-center px-0" : ""}`}
            >
              <Icon className="size-4 shrink-0" />
              {isSidebarExpanded && <span>{label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col gap-2">
        <button
          className={`flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ${
            !isSidebarExpanded ? "justify-center" : ""
          }`}
          title="Settings"
        >
          <Settings className="size-4 shrink-0" />
          {isSidebarExpanded && <span>Settings</span>}
        </button>

        {isSidebarExpanded ? (
          <div className="rounded-xl bg-muted p-3 flex items-center gap-3">
            <div className="relative size-7 shrink-0 rounded-md bg-white overflow-hidden p-0.5 border border-border">
              <Image
                src="/assets/exams/school-logo-dps.png"
                alt="School logo"
                fill
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">
                Delhi Public School
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Bokaro Steel City
              </div>
            </div>
          </div>
        ) : (
          <div
            className="size-9 rounded-xl bg-muted grid place-items-center mx-auto"
            title="Delhi Public School"
          >
            <div className="relative size-5">
              <Image
                src="/assets/exams/school-logo-dps.png"
                alt="School logo"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
