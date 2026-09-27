import type { FC } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { FaGithub } from 'react-icons/fa6'

import { cn } from '@/lib/utils'

interface TitleProps {
  className?: string
}
export const Title: FC<TitleProps> = ({ className }) => {
  return (
    <h2 className={cn('text-3xl', className)}>
      <span className="text-sky-200">D</span>isplay{' '}
      <span className="text-sky-200">E</span>ntity{' '}
      <span className="text-sky-200">Pl</span>atform
    </h2>
  )
}

interface TitleAreaProps {
  className?: string
}
export const TitleArea: FC<TitleAreaProps> = ({ className }) => {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <Title />
      <span>{t(($) => $.branding.desc)}</span>
    </div>
  )
}

interface DisclaimerProps {
  className?: string
}
export const Disclaimer: FC<DisclaimerProps> = ({ className }) => {
  const { t } = useTranslation()

  return (
    <div className={cn('mt-4 text-sm text-neutral-500', className)}>
      {t(($) => $.branding.disclaimer)}
    </div>
  )
}

interface SpecialThanksProps {
  className?: string
}
export const SpecialThanks: FC<SpecialThanksProps> = ({ className }) => {
  return (
    <div className={cn('mt-4 text-sm text-neutral-500', className)}>
      <Trans
        i18nKey={($) => $.branding.specialThanks}
        ns="translation"
        components={{
          user: (
            <a
              href="https://github.com/eszesbalint"
              target="_blank"
              className="underline"
              rel="noreferrer"
            >
              Eszes Bálint
            </a>
          ),
          bdstudio: (
            <a
              href="https://github.com/eszesbalint/bdstudio"
              target="_blank"
              className="underline"
              rel="noreferrer"
            >
              BDStudio
            </a>
          ),
        }}
      />
    </div>
  )
}

interface OpenSourceNoticeProps {
  className?: string
}
export const OpenSourceNotice: FC<OpenSourceNoticeProps> = ({ className }) => {
  return (
    <div className={cn('mt-4 text-sm text-neutral-500', className)}>
      <Trans
        i18nKey={($) => $.branding.openSourceNotice}
        components={{
          projectLink: (
            <a
              href="https://github.com/comjun04/display-entity-platform"
              className="flex flex-row items-center gap-1 underline"
              target="_blank"
              rel="noreferrer"
            />
          ),
          githubIcon: <FaGithub />,
        }}
      />
    </div>
  )
}
