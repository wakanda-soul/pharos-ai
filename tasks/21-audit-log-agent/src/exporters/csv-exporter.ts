/**
 * CSV Audit Report Exporter for Pharos Network.
 * Fulfills Requirement 04: Exports ledger activity in RFC-4180 compliant CSV format.
 */

import { type WalletAuditReport } from '../types.js';

function escapeCsvField(field: string | number | boolean): string {
  const str = String(field ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportAuditReportToCsv(report: WalletAuditReport): string {
  const headers = [
    'EntryId',
    'TxHash',
    'BlockNumber',
    'TimestampIso',
    'Category',
    'CounterpartyAddress',
    'CounterpartyLabel',
    'AssetSymbol',
    'NominalAmount',
    'UsdValuation',
    'GasFeePaidPros',
    'IsNotable',
    'NotableReason',
    'PlainLanguageDescription',
    'ExplorerUrl',
  ];

  const rows: string[] = [headers.join(',')];

  for (const entry of report.allLedgerEntries) {
    const row = [
      escapeCsvField(entry.entryId),
      escapeCsvField(entry.txHash),
      escapeCsvField(entry.blockNumber.toString()),
      escapeCsvField(entry.timestampIso),
      escapeCsvField(entry.category),
      escapeCsvField(entry.counterpartyAddress),
      escapeCsvField(entry.counterpartyLabel),
      escapeCsvField(entry.assetSymbol),
      escapeCsvField(entry.nominalAmountFormatted),
      escapeCsvField(entry.estimatedUsdValuation),
      escapeCsvField(entry.gasFeePaidPros),
      escapeCsvField(entry.isNotable),
      escapeCsvField(entry.notableReason ?? ''),
      escapeCsvField(entry.plainLanguageDescription),
      escapeCsvField(entry.explorerUrl),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}
