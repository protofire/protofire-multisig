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

export const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
