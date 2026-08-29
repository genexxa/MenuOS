import * as Tabs from '@radix-ui/react-tabs'
import { useCurrentMember } from '../../lib/household'
import { GroceryListTab } from './components/GroceryListTab'
import { PantryTab } from './components/PantryTab'

export function EpiceriePage() {
  const { data: member } = useCurrentMember()

  return (
    <div className="px-4 py-4">
      <h1 className="mb-3 text-lg font-semibold">Épicerie</h1>

      <Tabs.Root defaultValue="liste">
        <Tabs.List className="mb-4 flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
          <Tabs.Trigger
            value="liste"
            className="flex-1 rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Liste d'épicerie
          </Tabs.Trigger>
          <Tabs.Trigger
            value="inventaire"
            className="flex-1 rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Garde-manger
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="liste">
          <GroceryListTab householdId={member?.household_id} />
        </Tabs.Content>
        <Tabs.Content value="inventaire">
          <PantryTab householdId={member?.household_id} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
