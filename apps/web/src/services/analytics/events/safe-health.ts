const SAFE_HEALTH_CATEGORY = 'safe-health'

export const SAFE_HEALTH_EVENTS = {
  OPEN_OWNERS: { action: 'Open owners and threshold', category: SAFE_HEALTH_CATEGORY },
  OPEN_CONTRACT_VERSION: { action: 'Open contract version', category: SAFE_HEALTH_CATEGORY },
  OPEN_MODULES: { action: 'Open Safe modules', category: SAFE_HEALTH_CATEGORY },
  OPEN_GUARD: { action: 'Open transaction guard', category: SAFE_HEALTH_CATEGORY },
  OPEN_FALLBACK_HANDLER: { action: 'Open fallback handler', category: SAFE_HEALTH_CATEGORY },
  OPEN_RECOVERY: { action: 'Open account recovery', category: SAFE_HEALTH_CATEGORY },
  VIEW_ALL: { action: 'View all safe setup checks', category: SAFE_HEALTH_CATEGORY },
}
