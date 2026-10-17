#!/usr/bin/env node
import { PharosMcpClient } from "../../../src/shared/mcp-client";
import { ERC20_ABI, formatTokenAmount, formatAddress } from "../../../src/shared/chain";
import { encodeFunctionData, decodeFunctionResult } from "viem";
import { Command } from "commander";

// Default public contracts on Pharos Mainnet (Chain ID 1672)
const PRESET_CONTRACTS: Record<string, { name: string; address: `0x${string}` }> = {
  USDC: {
    name: "USDC Stablecoin",
    address: "0xc879c018db60520f4355c26ed1a6d572cdac1815",
  },
  WPROS: {
    name: "Wrapped PROS",
    address: "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0",
  },
  LINK: {
    name: "Chainlink Token",
    address: "0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29",
  },
};

const DEFAULT_HOLDER = "0xa0c048d1afb32de4e4b8756a55e22fde5c74e932";

interface ContractStateReport {
  network: string;
  chainId: number;
  blockNumber: number;
  contractAddress: string;
  contractName: string;
  symbol: string;
  decimals: number;
  rawTotalSupply: string;
  formattedTotalSupply: string;
  bytecodeSizeBytes: number;
  holderAddress?: string;
  rawHolderBalance?: string;
  formattedHolderBalance?: string;
}

export async function readContractState(
  contractAddress: `0x${string}`,
  holderAddress: `0x${string}` = DEFAULT_HOLDER as `0x${string}`
): Promise<ContractStateReport> {
  const client = new PharosMcpClient();

  // 1. Query network info and block number
  const chainInfo = await client.getChainInfo();
  const blockNumber = await client.getBlockNumber();

  // 2. Query bytecode to verify contract deployment
  const codeRes = await client.callTool("get_code", { address: contractAddress });
  const bytecode = codeRes.parsed?.code || "";
  const bytecodeSizeBytes = bytecode.startsWith("0x") ? (bytecode.length - 2) / 2 : 0;

  if (bytecodeSizeBytes === 0) {
    throw new Error(`Address ${contractAddress} is an EOA or has no contract code deployed!`);
  }

  // 3. Read contract state via eth_call on Pharos Chain MCP
  // A. name()
  const nameData = encodeFunctionData({ abi: ERC20_ABI, functionName: "name" });
  const nameHex = await client.ethCall({ to: contractAddress, data: nameData });
  const name = decodeFunctionResult({ abi: ERC20_ABI, functionName: "name", data: nameHex });

  // B. symbol()
  const symbolData = encodeFunctionData({ abi: ERC20_ABI, functionName: "symbol" });
  const symbolHex = await client.ethCall({ to: contractAddress, data: symbolData });
  const symbol = decodeFunctionResult({ abi: ERC20_ABI, functionName: "symbol", data: symbolHex });

  // C. decimals()
  const decimalsData = encodeFunctionData({ abi: ERC20_ABI, functionName: "decimals" });
  const decimalsHex = await client.ethCall({ to: contractAddress, data: decimalsData });
  const decimals = Number(decodeFunctionResult({ abi: ERC20_ABI, functionName: "decimals", data: decimalsHex }));

  // D. totalSupply()
  const supplyData = encodeFunctionData({ abi: ERC20_ABI, functionName: "totalSupply" });
  const supplyHex = await client.ethCall({ to: contractAddress, data: supplyData });
  const totalSupply = decodeFunctionResult({ abi: ERC20_ABI, functionName: "totalSupply", data: supplyHex });

  // E. balanceOf(holder)
  let rawHolderBalance: string | undefined;
  let formattedHolderBalance: string | undefined;

  try {
    const balanceData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [holderAddress],
    });
    const balanceHex = await client.ethCall({ to: contractAddress, data: balanceData });
    const balance = decodeFunctionResult({ abi: ERC20_ABI, functionName: "balanceOf", data: balanceHex });
    rawHolderBalance = balance.toString();
    formattedHolderBalance = `${formatTokenAmount(balance, decimals)} ${symbol}`;
  } catch {
    // Optional query
  }

  return {
    network: chainInfo?.name || "Pharos",
    chainId: chainInfo?.chainId || 1672,
    blockNumber,
    contractAddress,
    contractName: name,
    symbol,
    decimals,
    rawTotalSupply: totalSupply.toString(),
    formattedTotalSupply: `${formatTokenAmount(totalSupply, decimals)} ${symbol}`,
    bytecodeSizeBytes,
    holderAddress,
    rawHolderBalance,
    formattedHolderBalance,
  };
}

function printReport(report: ContractStateReport): void {
  console.log("\n========================================================");
  console.log("       🏛️  PHAROS SMART CONTRACT STATE INSPECTOR       ");
  console.log("========================================================");
  console.log(`📡 Network:             ${report.network} (Chain ID: ${report.chainId})`);
  console.log(`📦 Read at Block:       #${report.blockNumber.toLocaleString()}`);
  console.log(`📍 Contract Address:    ${report.contractAddress}`);
  console.log(`📜 Contract Bytecode:   ${report.bytecodeSizeBytes.toLocaleString()} bytes deployed`);
  console.log("--------------------------------------------------------");
  console.log("               HUMAN-READABLE STATE DATA                ");
  console.log("--------------------------------------------------------");
  console.log(`🏷️  Token Name:          ${report.contractName}`);
  console.log(`🔤 Symbol:              ${report.symbol}`);
  console.log(`🔢 Decimals:            ${report.decimals}`);
  console.log(`💰 Total Supply:        ${report.formattedTotalSupply}`);
  console.log(`   (Raw Value):         ${report.rawTotalSupply} base units`);
  if (report.holderAddress && report.formattedHolderBalance) {
    console.log(`👤 Sample Holder:       ${formatAddress(report.holderAddress)} (${report.holderAddress})`);
    console.log(`💳 Holder Balance:      ${report.formattedHolderBalance}`);
    console.log(`   (Raw Value):         ${report.rawHolderBalance} base units`);
  }
  console.log("--------------------------------------------------------");
  console.log("✅ Verified via Pharos Chain MCP (https://mcp.pharos.xyz/mcp)");
  console.log("========================================================\n");
}

async function main() {
  const program = new Command();
  program
    .name("read-contract-state")
    .description("Read live state from a Pharos smart contract via Chain MCP")
    .option("-c, --contract <address>", "Contract address (or preset: USDC, WPROS, LINK)", "USDC")
    .option("-h, --holder <address>", "Sample wallet address to check balance for", DEFAULT_HOLDER)
    .option("--json", "Output results in JSON format")
    .action(async (options) => {
      let targetAddress: `0x${string}`;

      if (PRESET_CONTRACTS[options.contract.toUpperCase()]) {
        targetAddress = PRESET_CONTRACTS[options.contract.toUpperCase()].address;
      } else if (options.contract.startsWith("0x") && options.contract.length === 42) {
        targetAddress = options.contract as `0x${string}`;
      } else {
        console.error(`❌ Error: Invalid contract address or unknown preset "${options.contract}".`);
        process.exit(1);
      }

      try {
        console.log(`🔍 Inspecting contract state via Pharos Chain MCP...`);
        const report = await readContractState(targetAddress, options.holder as `0x${string}`);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          printReport(report);
        }
      } catch (err: any) {
        console.error("❌ Execution error:", err.message || err);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
