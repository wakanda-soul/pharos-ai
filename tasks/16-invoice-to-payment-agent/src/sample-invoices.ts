/**
 * Realistic Sample Invoices across multiple enterprise formats for demonstration
 * and testing of Pharos Invoice-to-Payment Agent.
 */

export const SAMPLE_JSON_INVOICE_VALID = JSON.stringify(
  {
    invoiceReference: 'INV-2026-PHAROS-101',
    vendorName: 'Pharos Infrastructure DAO',
    payeeAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    currency: 'USDC',
    totalAmount: 450.0,
    issueDate: '2026-11-01',
    dueDate: '2026-11-15',
    lineItems: [
      {
        description: 'Dedicated RPC Node Cluster (Month 11)',
        quantity: 1,
        unitPrice: 350.0,
        lineTotal: 350.0,
      },
      {
        description: 'Chainlink Data Feed Indexing Overhead',
        quantity: 1,
        unitPrice: 100.0,
        lineTotal: 100.0,
      },
    ],
    memo: 'Net-14 terms. Settle via Pharos native USDC.',
  },
  null,
  2
);

export const SAMPLE_PLAINTEXT_INVOICE_VALID = `
============================================================
              COMMERCIAL BILLING STATEMENT
============================================================
Invoice Reference: INV-2026-DEV-884
Vendor: Nexus Security Audits LLC
Payee: alice.pharos (Finance Hot Wallet)
Amount Due: 1,250.00 USDC
Payment Due: 2026-11-20

Itemized Services:
- Smart Contract Formal Verification: 1 x 1000.00 = 1000.00
- Slither Static Analysis Report: 1 x 250.00 = 250.00

Total Due: 1,250.00 USDC
============================================================
`;

export const SAMPLE_DELIMITED_RECEIPT_VALID = `
# Pharos Automated DevOps Billing Hook
INVOICE_REF=INV-DEV-9921
VENDOR=HyperScale Cloud Compute
PAYEE=treasury.pharos
CURRENCY=PROS
AMOUNT=15.5
DUE_DATE=2026-11-30
`;

export const SAMPLE_INVOICE_SUM_MISMATCH = JSON.stringify(
  {
    invoiceReference: 'INV-MISMATCH-002',
    vendorName: 'Sneaky Vendor LLC',
    payeeAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    currency: 'USDC',
    totalAmount: 1000.0, // Stated total is 1000, but line items sum to 600!
    lineItems: [
      {
        description: 'Frontend Hosting',
        quantity: 1,
        unitPrice: 400.0,
        lineTotal: 400.0,
      },
      {
        description: 'Domain SSL Certificate',
        quantity: 1,
        unitPrice: 200.0,
        lineTotal: 200.0,
      },
    ],
  },
  null,
  2
);

export const SAMPLE_INVOICE_MISSING_CURRENCY = JSON.stringify(
  {
    invoiceReference: 'INV-NOCURR-003',
    vendorName: 'Ambiguous Billing Corp',
    payeeAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    totalAmount: 500.0,
    // CURRENCY INTENTIONALLY OMITTED: Agent must NOT guess!
  },
  null,
  2
);

export const SAMPLE_INVOICE_MISSING_PAYEE = `
Invoice Reference: INV-NOPAYEE-004
Vendor: Rogue Billing Service
Total Due: 250.00 USDC
`;

export const SAMPLE_INVOICE_MISSING_REFERENCE = JSON.stringify(
  {
    vendorName: 'Anonymous Agency',
    payeeAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    currency: 'USDC',
    totalAmount: 300.0,
    // Reference intentionally omitted
  },
  null,
  2
);
