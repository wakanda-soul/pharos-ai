export interface PaymentBenchmarkScenario {
  id: string;
  name: string;
  instruction: string;
  expectedStatus: 'READY_FOR_SIGNATURE' | 'AMBIGUOUS_INPUT' | 'VALIDATION_FAILED';
  description: string;
  mockBalances?: { nativePros?: number; tokenAmount?: number };
}

export const SCENARIO_VALID_NATIVE_TRANSFER: PaymentBenchmarkScenario = {
  id: 'SCENARIO_VALID_NATIVE_TRANSFER',
  name: 'Valid Native PROS Transfer (Full Intent Resolution)',
  instruction: 'please send 0.05 PROS to alice.pharos',
  expectedStatus: 'READY_FOR_SIGNATURE',
  description:
    'Complete instruction specifying amount (0.05), asset (PROS), and domain name recipient (alice.pharos). Resolves domain to 0xa0c0...e932, validates balance, and yields unsigned tx.',
};

export const SCENARIO_VALID_TOKEN_TRANSFER: PaymentBenchmarkScenario = {
  id: 'SCENARIO_VALID_TOKEN_TRANSFER',
  name: 'Valid ERC-20 USDC Transfer (Hex Address & Solvency)',
  instruction: 'wire 50 USDC to 0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
  expectedStatus: 'READY_FOR_SIGNATURE',
  description:
    'Complete instruction transferring 50 USDC to direct hexadecimal recipient address. Encodes ERC-20 transfer calldata and returns signing request.',
  mockBalances: { nativePros: 5.0, tokenAmount: 250.0 },
};

export const SCENARIO_AMBIGUOUS_MISSING_RECIPIENT: PaymentBenchmarkScenario = {
  id: 'SCENARIO_AMBIGUOUS_MISSING_RECIPIENT',
  name: 'Ambiguous Instruction: Missing Recipient Address',
  instruction: 'send 100 USDC',
  expectedStatus: 'AMBIGUOUS_INPUT',
  description:
    'Incomplete command containing amount and token, but missing destination. The agent generates a targeted follow-up question asking for the recipient.',
};

export const SCENARIO_AMBIGUOUS_MISSING_AMOUNT: PaymentBenchmarkScenario = {
  id: 'SCENARIO_AMBIGUOUS_MISSING_AMOUNT',
  name: 'Ambiguous Instruction: Missing Numerical Amount',
  instruction: 'transfer some PROS to bob.pharos',
  expectedStatus: 'AMBIGUOUS_INPUT',
  description:
    'Incomplete command specifying recipient and token, but omitting transfer amount. The agent generates a clarification prompt for the numerical quantity.',
};

export const SCENARIO_INSUFFICIENT_BALANCE: PaymentBenchmarkScenario = {
  id: 'SCENARIO_INSUFFICIENT_BALANCE',
  name: 'Validation Error: Insufficient Sender Balance',
  instruction: 'send 5000 USDC to alice.pharos',
  expectedStatus: 'VALIDATION_FAILED',
  description:
    'Valid syntax, but requested 5,000 USDC exceeds sender balance (holds 100 USDC). Validation safely blocks transaction preparation before signature.',
  mockBalances: { nativePros: 1.0, tokenAmount: 100.0 },
};

export const SCENARIO_INVALID_RECIPIENT: PaymentBenchmarkScenario = {
  id: 'SCENARIO_INVALID_RECIPIENT',
  name: 'Validation Error: Malformed Recipient Hex Address',
  instruction: 'send 10 PROS to 0xinvalid1234hex',
  expectedStatus: 'VALIDATION_FAILED',
  description:
    'Malformed hexadecimal address. Validator intercepts request and explains invalid address format.',
};

export const BENCHMARK_SCENARIOS: PaymentBenchmarkScenario[] = [
  SCENARIO_VALID_NATIVE_TRANSFER,
  SCENARIO_VALID_TOKEN_TRANSFER,
  SCENARIO_AMBIGUOUS_MISSING_RECIPIENT,
  SCENARIO_AMBIGUOUS_MISSING_AMOUNT,
  SCENARIO_INSUFFICIENT_BALANCE,
  SCENARIO_INVALID_RECIPIENT,
];
