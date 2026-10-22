import { useContext } from 'react'
import DeleteIcon from '@/public/images/common/delete.svg'
import { TxFlowType } from '@/services/analytics'
import { TxFlow } from '../../TxFlow'
import { TxFlowContext } from '../../TxFlowProvider'
import { ReviewDissociateToken } from './ReviewDissociateToken'
import { type ReviewTransactionProps } from '@/components/tx/ReviewTransactionV2'
import type { HederaAssociatedToken } from '@/utils/hedera'

export type DissociateTokenFlowProps = {
  token: HederaAssociatedToken
}

const ReviewDissociateTokenStep = (props: ReviewTransactionProps) => {
  const { data } = useContext(TxFlowContext)
  return <ReviewDissociateToken params={data} {...props} />
}

const DissociateTokenFlow = ({ token }: DissociateTokenFlowProps) => {
  return (
    <TxFlow
      initialData={{ token }}
      icon={DeleteIcon}
      subtitle="Dissociate Token"
      eventCategory={TxFlowType.DISSOCIATE_TOKEN}
      ReviewTransactionComponent={ReviewDissociateTokenStep}
    />
  )
}

export default DissociateTokenFlow
