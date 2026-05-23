import type { FC } from 'react'

import {
  Disclaimer,
  OpenSourceNotice,
  SpecialThanks,
  Title,
} from '@/components/brandings'

const AboutPage: FC = () => {
  return (
    <>
      <Title />
      <div className="mt-4 flex flex-row items-center gap-2">
        <span className="text-2xl text-sky-200">v{__VERSION__}</span>
        <span className="font-mono">{__COMMIT_HASH__}</span>
        {__IS_DEV__ && <span>(Development Build)</span>}
      </div>

      <Disclaimer />
      <SpecialThanks />
      <OpenSourceNotice />
    </>
  )
}

export default AboutPage
