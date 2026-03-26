import type { FC } from 'react'
import { createPortal } from 'react-dom'

import { Toaster } from './ui/Sonner'

const ToastContainer: FC = () => {
  // ui frameworks uses portal to render dialogs and such
  // which prevents toast elements from receiving pointer events without using portal itself
  return createPortal(
    <div id="ToastContainer">
      <Toaster
        theme="dark"
        richColors
        closeButton
        visibleToasts={5}
        offset={8}
        mobileOffset={8}
        gap={8}
      />
    </div>,
    document.body,
  )
}

export default ToastContainer
