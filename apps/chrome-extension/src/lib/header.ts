export function buildIdleSubtitle({
  inputSummary,
  modelLabel,
  model,
}: {
  inputSummary?: string | null
  modelLabel?: string | null
  model?: string | null
}): string {
  const input = typeof inputSummary === 'string' ? inputSummary.trim() : ''
  const label = typeof modelLabel === 'string' ? modelLabel.trim() : ''
  const rawModel = typeof model === 'string' ? model.trim() : ''
  const modelPart = label || rawModel

  const parts = [input, modelPart].filter(Boolean)
  return parts.join(' · ')
}
