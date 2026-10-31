interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
}

function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="page-description">{description}</p>}
    </div>
  )
}

export default PageHeader