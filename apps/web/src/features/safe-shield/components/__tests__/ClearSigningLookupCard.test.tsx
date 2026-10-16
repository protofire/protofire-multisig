import type { DisplayModel } from '@ethereum-sourcify/clear-signing'
import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { ClearSigningLookupProvider, useClearSigningLookupContext } from '@/features/erc7730'
import { ClearSigningLookupCard } from '../ClearSigningLookupCard'

const foundModel = { intent: 'Send' } as DisplayModel

const Registrar = ({
  keys,
  run,
}: {
  keys: string[]
  run: (key: string) => Promise<{ model?: DisplayModel }>
}): null => {
  const context = useClearSigningLookupContext()
  const registerEntry = context?.registerEntry

  useEffect(() => {
    keys.forEach((key) => registerEntry?.(key, { label: `Action ${key}`, eligible: true, run: () => run(key) }))
  }, [keys, registerEntry, run])

  return null
}

type Run = (key: string) => Promise<{ model?: DisplayModel }>

const renderCard = (
  keys: string[],
  run: jest.Mock<ReturnType<Run>, Parameters<Run>> = jest.fn<ReturnType<Run>, Parameters<Run>>(async () => ({
    model: foundModel,
  })),
) => {
  render(
    <ClearSigningLookupProvider>
      <Registrar keys={keys} run={run} />
      <ClearSigningLookupCard />
    </ClearSigningLookupProvider>,
  )
  return run
}

describe('ClearSigningLookupCard', () => {
  beforeEach(() => {
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
  })

  it('requests every action from the header for multi-action transactions', async () => {
    const run = renderCard(['1', '2', '3'])

    expect(screen.getByTestId('erc7730-lookup-run-btn')).toHaveTextContent('Look up all')
    fireEvent.click(screen.getByTestId('erc7730-lookup-run-btn'))

    await waitFor(() => expect(run.mock.calls.map(([key]) => key)).toEqual(['1', '2', '3']))
  })

  it('requests the only action from the header for single-action transactions', async () => {
    const run = renderCard(['1'])

    expect(screen.getByTestId('erc7730-lookup-run-btn')).toHaveTextContent('Look up')
    fireEvent.click(screen.getByTestId('erc7730-lookup-run-btn'))

    await waitFor(() => expect(run).toHaveBeenCalledWith('1'))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('hides the look up button once every action is looked up', async () => {
    renderCard(
      ['1', '2'],
      jest.fn(async (key: string) => (key === '1' ? { model: foundModel } : {})),
    )

    fireEvent.click(screen.getByTestId('erc7730-lookup-run-btn'))

    await waitFor(() => expect(screen.queryByTestId('erc7730-lookup-run-btn')).not.toBeInTheDocument())
    expect(screen.getByText('2/2 checked · 1 found')).toBeInTheDocument()
  })
})
