import * as Dialog from '@radix-ui/react-dialog'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  onConfirm,
  destructive = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  destructive?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/3 max-w-sm space-y-3 rounded-lg bg-white p-4 shadow-lg sm:mx-auto">
          <Dialog.Title className="font-medium">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-neutral-500">{description}</Dialog.Description>
          <div className="flex justify-end gap-2 pt-2">
            <Dialog.Close asChild>
              <button type="button" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
                Annuler
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${
                destructive ? 'bg-red-600' : 'bg-neutral-900'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
