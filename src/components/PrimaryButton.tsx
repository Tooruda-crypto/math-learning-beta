import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  fullWidth?: boolean
}

export function PrimaryButton({ children, className = '', fullWidth = false, ...props }: PrimaryButtonProps) {
  const classes = ['button', 'button--primary', fullWidth ? 'button--full' : '', className].filter(Boolean).join(' ')
  return <button className={classes} {...props}>{children}</button>
}
