export const getOrCreate = <T>(cache: Map<string, Promise<T>>, key: string, create: () => Promise<T>): Promise<T> => {
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const promise = create().catch((error: unknown) => {
    cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  return promise
}
