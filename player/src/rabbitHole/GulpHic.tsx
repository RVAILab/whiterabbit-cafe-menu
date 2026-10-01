/** "*hic*" at the hole; goes in RabbitHoleLayout's `hic` slot. The gulp positions it at trigger time. */
export function GulpHic() {
  return (
    <div className="rh-hic" data-testid="gulp-hic" aria-hidden="true">
      *hic*
    </div>
  )
}
