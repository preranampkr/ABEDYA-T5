import type { InputHTMLAttributes } from 'react'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

function FormField({ label, hint, id, ...inputProps }: FormFieldProps) {
  return (
    <div className="form-field">
      <Label className="field-label" htmlFor={id}>{label}</Label>
      <Input className="text-input" id={id} {...inputProps} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export default FormField