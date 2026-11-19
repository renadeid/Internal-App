export function guardPreviewMutation<Args extends unknown[], Result>(allowed: boolean, action: (...args: Args) => Result): (...args: Args) => Result {
 return (...args) => {
  if (!allowed) throw new Error("Admin can view and edit existing work only.")
  return action(...args)
 }
}
