import LinkIcon from '@/public/images/common/link.svg'
import { TxFlowType } from '@/services/analytics'
import { TxFlow } from '../../TxFlow'
import { TxFlowStep } from '../../TxFlowStep'
import CreateAssociateToken from './CreateAssociateToken'
import ReviewAssociateToken from './ReviewAssociateToken'
import type { HederaTokenMetadata } from '@/utils/hedera'

export type AssociateTokenParams = {
  token?: HederaTokenMetadata
}

const AssociateTokenFlow = () => {
  return (
    <TxFlow
      initialData={{} as AssociateTokenParams}
      icon={LinkIcon}
      subtitle="Associate Token"
      eventCategory={TxFlowType.ASSOCIATE_TOKEN}
      ReviewTransactionComponent={ReviewAssociateToken}
    >
      <TxFlowStep title="New transaction">
        <CreateAssociateToken />
      </TxFlowStep>
    </TxFlow>
  )
}

export default AssociateTokenFlow
