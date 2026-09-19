import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HouseholdProvider, useHousehold } from '@/app/providers/HouseholdProvider'
import { ToastProvider } from '@/app/providers/ToastProvider'
import { AppLayout } from '@/app/layout/AppLayout'
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen'
import { DashboardScreen } from '@/features/dashboard/DashboardScreen'
import { TransactionsScreen } from '@/features/expenses/TransactionsScreen'
import { AddExpenseScreen } from '@/features/expenses/AddExpenseScreen'
import { EditExpenseScreen } from '@/features/expenses/EditExpenseScreen'
import { SettlementScreen } from '@/features/settlements/SettlementScreen'
import { SettingsHomeScreen } from '@/features/settings/SettingsHomeScreen'
import { HouseholdSettingsScreen } from '@/features/settings/HouseholdSettingsScreen'
import { MembersSettingsScreen } from '@/features/settings/MembersSettingsScreen'
import { CategoriesSettingsScreen } from '@/features/settings/CategoriesSettingsScreen'
import { BackupSettingsScreen } from '@/features/settings/BackupSettingsScreen'
import { StorageSettingsScreen } from '@/features/settings/StorageSettingsScreen'
import { SettingsSubScreen } from '@/app/layout/SettingsSubScreen'
import { LoadingState } from '@/components/ui/LoadingState'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { UpdatePrompt } from '@/app/UpdatePrompt'

function Gate() {
  const { household, loading } = useHousehold()
  if (loading) return <LoadingState label="กำลังเตรียมข้อมูล..." />
  if (!household) return <OnboardingScreen />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/transactions" element={<TransactionsScreen />} />
        <Route path="/transactions/:expenseId/edit" element={<EditExpenseScreen />} />
        <Route path="/add" element={<AddExpenseScreen />} />
        <Route path="/settlement" element={<SettlementScreen />} />
        <Route path="/settings" element={<SettingsHomeScreen />} />
        <Route
          path="/settings/household"
          element={
            <SettingsSubScreen title="ครอบครัว">
              <HouseholdSettingsScreen />
            </SettingsSubScreen>
          }
        />
        <Route
          path="/settings/members"
          element={
            <SettingsSubScreen title="สมาชิก">
              <MembersSettingsScreen />
            </SettingsSubScreen>
          }
        />
        <Route
          path="/settings/categories"
          element={
            <SettingsSubScreen title="หมวดหมู่">
              <CategoriesSettingsScreen />
            </SettingsSubScreen>
          }
        />
        <Route
          path="/settings/backup"
          element={
            <SettingsSubScreen title="สำรองและกู้คืนข้อมูล">
              <BackupSettingsScreen />
            </SettingsSubScreen>
          }
        />
        <Route
          path="/settings/storage"
          element={
            <SettingsSubScreen title="พื้นที่จัดเก็บ">
              <StorageSettingsScreen />
            </SettingsSubScreen>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        {/* Mounted unconditionally so the service worker registers, and offline status is
            visible, from the very first paint — including the onboarding screen, before any
            household exists (spec NFR-001/NFR-002: app shell must be install/offline-ready
            immediately, not only after first-run setup). */}
        <OfflineBanner />
        <UpdatePrompt />
        <HouseholdProvider>
          <Gate />
        </HouseholdProvider>
      </ToastProvider>
    </HashRouter>
  )
}
