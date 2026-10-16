export const getInstanceFromChainName = (chainName: string): string => {
  const firstWord = chainName.trim().split(/\s+/)[0] ?? chainName
  const formattedName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()

  return `${formattedName} Safe`
}
