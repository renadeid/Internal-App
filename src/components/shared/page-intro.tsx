export function PageIntro({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="roaya-page-title text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  )
}
