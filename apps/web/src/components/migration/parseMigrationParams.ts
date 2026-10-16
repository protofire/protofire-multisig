export interface MigrationParams {
  chainIds: string[]
}

const parseChainIds = (chainIdParam: string | string[] | undefined): string[] => {
  if (!chainIdParam) return []

  const rawValue = Array.isArray(chainIdParam) ? chainIdParam.join(',') : chainIdParam

  return rawValue
    .split(',')
    .map((chainId) => chainId.trim())
    .filter(Boolean)
}

export const parseMigrationParams = (query: Record<string, string | string[] | undefined>): MigrationParams => ({
  chainIds: parseChainIds(query.chainId),
})
