import css from './styles.module.css'

// Keyed by chainId for chain-sponsored networks ("Sponsored by <Chain>"); everything else falls back to default.
export const RELAY_SPONSORS: Record<string, { name: string; logo: string }> = {
  default: {
    name: 'Protofire',
    logo: '/images/protofire.svg',
  },
}

const SponsoredBy = ({ chainId }: { chainId: string }) => {
  const sponsor = RELAY_SPONSORS[chainId] || RELAY_SPONSORS.default

  return (
    <>
      <img src={sponsor.logo} alt={sponsor.name} className={css.logo} /> {sponsor.name}
    </>
  )
}

export default SponsoredBy
