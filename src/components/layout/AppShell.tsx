"use client";

import React from "react";
import { useAppStore } from "@/stores/app-store";
import { Sidebar } from "./Sidebar";
import { MobileHeader, Topbar } from "./Topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSidebarExpanded } = useAppStore();

  return (
    <main className="h-screen w-screen overflow-hidden bg-gradient-to-b from-[#F5F5F5] to-[#E9E5E5] p-3 sm:p-5 flex flex-col font-sans">
      <div className="flex h-full w-full gap-4 min-h-0 min-w-0 overflow-hidden relative">
        <Sidebar />

        <section
          className={`flex min-w-0 flex-1 flex-col h-full min-h-0 overflow-hidden transition-all duration-200 ${
            isSidebarExpanded ? "lg:ml-[316px]" : "lg:ml-[88px]"
          }`}
        >
          <Topbar />
          <MobileHeader />

          {/* View Content Region: Fixed height flex container */}
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative mt-2">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
