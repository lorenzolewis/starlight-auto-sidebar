export function stripLeadingAndTrailingSlash(path: string) {
  return stripLeadingSlash(stripTrailingSlash(path))
}

export function stripLeadingSlash(path: string) {
  if (!path.startsWith('/')) return path
  return path.slice(1)
}

function stripTrailingSlash(path: string) {
  if (!path.endsWith('/')) return path
  return path.slice(0, -1)
}
