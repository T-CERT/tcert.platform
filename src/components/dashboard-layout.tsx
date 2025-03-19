"use client";

import React from "react";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { MenuItem } from "@/lib/types";
import { UserRowType } from "@/modules/auth/table";

import {
  Home,
  BookOpen,
  FileText,
  CreditCard,
  ShoppingBag,
  BarChart,
  Users,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Home,
  BookOpen,
  FileText,
  CreditCard,
  ShoppingBag,
  BarChart,
  Users,
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  userProfile: (UserRowType & { roles?: { name: string } | null }) | null;
  menuItems: MenuItem[];
  currentModuleName: string;
}

export function DashboardLayout({
  children,
  userProfile,
  menuItems,
  currentModuleName,
}: DashboardLayoutProps) {
  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader
          currentModuleName={currentModuleName}
          platformTitle="Plataforma T-Cert"
        />
        <div className="flex flex-1">
          <AppSidebar
            userProfile={userProfile}
            menuItems={menuItems.map((item) => ({
              ...item,
              icon:
                iconMap[item.iconName] &&
                typeof iconMap[item.iconName] === "function"
                  ? React.createElement(iconMap[item.iconName])
                  : null,
            }))}
          />
          <SidebarInset>
            <div className="w-[87%] mx-auto py-10 2xl:w-[90%]">
              <div className="mb-8">
                {currentModuleName && (
                  <h1 className="text-3xl font-bold mb-2">
                    {currentModuleName}
                  </h1>
                )}
              </div>
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
