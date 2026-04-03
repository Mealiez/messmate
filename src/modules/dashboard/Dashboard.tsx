import React, { useState } from 'react';
import { supabase } from '../../supabase/client';
import { useTenantContext } from '../../core/context/TenantContext';
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';

// Import all feature modules
import { StudentManagementModule } from '../students/StudentManagementModule';
import { BillingModule } from '../billing/BillingModule';
import { MenuModule } from '../menu/MenuModule';
import { AttendanceModule } from '../attendance/AttendanceModule';
import { MealRequestsModule } from '../meal_requests/MealRequestsModule';
import { HRDashboardModule } from '../hr/HRDashboardModule';

import {
  Users,
  CreditCard,
  Utensils,
  QrCode,
  CalendarClock,
  LogOut,
  LayoutDashboard,
  ChevronRight,
  Menu as MenuIcon,
  X,
  Settings,
} from 'lucide-react';

type ActiveModule =
  | 'overview'
  | 'students'
  | 'billing'
  | 'menu'
  | 'attendance'
  | 'meal_requests'
  | 'hr_admin';

interface NavItem {
  id: ActiveModule;
  label: string;
  icon: React.ReactNode;
  featureId?: string; // if undefined → always visible
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

export const Dashboard: React.FC = () => {
  const { tenantId, role, isLoading, customConfig } = useTenantContext();
  const { hasFeature } = useFeatureFlags();
  const [activeModule, setActiveModule] = useState<ActiveModule>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = role === 'admin' || role === 'owner';
  const isSuperAdmin = role === 'super_admin' || role === 'hr';

  /* ------------------------------------------------------------------ */
  /* Navigation definition — feature-gated items                         */
  /* ------------------------------------------------------------------ */
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'hr_admin',
      label: 'Tenant Config',
      icon: <Settings className="w-4 h-4" />,
      superAdminOnly: true,
    },
    {
      id: 'students',
      label: 'Students',
      icon: <Users className="w-4 h-4" />,
      featureId: 'student_management',
      adminOnly: true,
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: <CreditCard className="w-4 h-4" />,
      featureId: 'billing',
      adminOnly: true,
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: <Utensils className="w-4 h-4" />,
      featureId: 'menu_management',
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <QrCode className="w-4 h-4" />,
      featureId: 'qr_attendance',
    },
    {
      id: 'meal_requests',
      label: 'Meal Requests',
      icon: <CalendarClock className="w-4 h-4" />,
      featureId: 'meal_requests',
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.adminOnly && !isAdmin && !isSuperAdmin) return false;
    if (item.featureId && !hasFeature(item.featureId) && !isSuperAdmin) return false;
    return true;
  });

  /* ------------------------------------------------------------------ */
  /* Sign-out                                                             */
  /* ------------------------------------------------------------------ */
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  /* ------------------------------------------------------------------ */
  /* Loading state                                                        */
  /* ------------------------------------------------------------------ */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white shadow rounded-xl">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Not Configured</h2>
          <p className="text-gray-500 text-sm">
            Your account is not linked to any mess. Please contact your administrator.
          </p>
          <button
            onClick={handleSignOut}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Overview: show stat cards for each available feature                 */
  /* ------------------------------------------------------------------ */
  const renderOverview = () => (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {customConfig?.mess_name || 'Mess Dashboard'}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back, {role} — here's what's available for your account.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleNavItems
          .filter((i) => i.id !== 'overview')
          .map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className="bg-white rounded-xl shadow border border-gray-100 p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                <h3 className="font-bold text-gray-800">{item.label}</h3>
              </div>
              <div className="flex items-center text-xs text-blue-600 font-semibold">
                Open module <ChevronRight className="w-3 h-3 ml-1" />
              </div>
            </button>
          ))}
      </div>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /* Module renderer                                                      */
  /* ------------------------------------------------------------------ */
  const renderModule = () => {
    switch (activeModule) {
      case 'overview':
        return renderOverview();
      case 'students':
        return <StudentManagementModule />;
      case 'billing':
        return <BillingModule />;
      case 'menu':
        return <MenuModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'meal_requests':
        return <MealRequestsModule />;
      case 'hr_admin':
        return <HRDashboardModule />;
      default:
        return renderOverview();
    }
  };

  /* ------------------------------------------------------------------ */
  /* Layout                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-30 flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:z-auto lg:shadow-none lg:border-r border-gray-200`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800 text-lg">
              {customConfig?.mess_name || 'Mealiez'}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plan badge */}
        <div className="px-5 py-3 border-b">
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            {role}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveModule(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${
                  activeModule === item.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition px-3 py-2 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-800"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span
              className="cursor-pointer hover:text-blue-600"
              onClick={() => setActiveModule('overview')}
            >
              Dashboard
            </span>
            {activeModule !== 'overview' && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-gray-700 font-medium capitalize">
                  {visibleNavItems.find((i) => i.id === activeModule)?.label}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderModule()}
        </main>
      </div>
    </div>
  );
};
