const modelPricing: Record<string, { input: number; output: number }> = {
  '3-7-sonnet': { input: 0.003, output: 0.015 },
  '3-5-sonnet': { input: 0.003, output: 0.015 },
  '3-5-haiku': { input: 0.0008, output: 0.004 },
};

export const calculateCost = (modelId: string, inputTokens: number, outputTokens: number) => {
  const pricing = Object.entries(modelPricing).find(([key]) => modelId.includes(key))?.[1];
  if (pricing == null) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
};
