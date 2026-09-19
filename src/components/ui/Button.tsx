import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  fullWidth?: boolean
}

export function Button({ variant = 'primary', fullWidth, className = '', ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, fullWidth ? 'btn--full' : '', className]
    .filter(Boolean)
    .join(' ')
  return <button className={classes} {...rest} />
}
