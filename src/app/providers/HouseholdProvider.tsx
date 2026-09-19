import { createContext, useContext, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/infrastructure/db/db'
import type { Category, Household, Member } from '@/domain/entities/types'

interface HouseholdContextValue {
  household: Household | undefined
  members: Member[]
  activeMembers: Member[]
  categories: Category[]
  activeCategories: Category[]
  loading: boolean
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const household = useLiveQuery(() => db.households.orderBy('name').first(), [])
  const members = useLiveQuery(
    () => (household ? db.members.where('householdId').equals(household.householdId).toArray() : []),
    [household?.householdId]
  )
  const categories = useLiveQuery(
    () => (household ? db.categories.where('householdId').equals(household.householdId).toArray() : []),
    [household?.householdId]
  )

  const loading = household === undefined && members === undefined
  const membersList = members ?? []
  const categoriesList = categories ?? []

  const value: HouseholdContextValue = {
    household,
    members: membersList,
    activeMembers: membersList.filter((m) => m.status === 'active'),
    categories: categoriesList,
    activeCategories: categoriesList.filter((c) => c.status === 'active'),
    loading
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
