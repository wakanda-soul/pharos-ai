import { getAddress, isAddress } from 'viem';

export interface ResolvedAddressResult {
  raw: string;
  isDomain: boolean;
  address?: `0x${string}`;
  isValid: boolean;
  error?: string;
}

/**
 * Built-in directory of canonical Pharos Name Service (PNS) and ecosystem aliases.
 */
const KNOWN_PHAROS_NAMES: Record<string, `0x${string}`> = {
  'alice.pharos': '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
  'alice.eth': '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
  'alice': '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
  'bob.pharos': '0x5346452296d910a373b5ee0e6df27863cb6ad689',
  'bob.eth': '0x5346452296d910a373b5ee0e6df27863cb6ad689',
  'bob': '0x5346452296d910a373b5ee0e6df27863cb6ad689',
  'treasury.pharos': '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  'treasury': '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  'dead.pharos': '0x000000000000000000000000000000000000dEaD',
  'burn': '0x000000000000000000000000000000000000dEaD',
  'multicall3': '0xcA11bde05977b3631167028862bE2a173976CA11',
};

export class PharosNameResolver {
  private customDirectory: Map<string, `0x${string}`> = new Map();

  constructor(customEntries?: Record<string, `0x${string}`>) {
    if (customEntries) {
      for (const [k, v] of Object.entries(customEntries)) {
        this.customDirectory.set(k.toLowerCase(), getAddress(v));
      }
    }
  }

  /**
   * Resolves a recipient string (0x address, .pharos, .eth, or registered alias).
   */
  resolve(input: string): ResolvedAddressResult {
    const trimmed = input.trim();

    if (!trimmed) {
      return {
        raw: input,
        isDomain: false,
        isValid: false,
        error: 'Recipient cannot be empty',
      };
    }

    // Direct 0x hex address
    if (trimmed.startsWith('0x')) {
      if (!isAddress(trimmed, { strict: false })) {
        return {
          raw: input,
          isDomain: false,
          isValid: false,
          error: `Invalid Ethereum/Pharos hexadecimal address format: "${trimmed}"`,
        };
      }

      try {
        const checksummed = getAddress(trimmed);
        return {
          raw: input,
          isDomain: false,
          address: checksummed,
          isValid: true,
        };
      } catch {
        return {
          raw: input,
          isDomain: false,
          isValid: false,
          error: `Address checksum verification failed for: "${trimmed}"`,
        };
      }
    }

    // Domain name / alias resolution
    const lower = trimmed.toLowerCase();
    const isDomain = lower.endsWith('.pharos') || lower.endsWith('.eth');

    // Check custom directory
    if (this.customDirectory.has(lower)) {
      return {
        raw: input,
        isDomain,
        address: this.customDirectory.get(lower),
        isValid: true,
      };
    }

    // Check known Pharos names
    if (KNOWN_PHAROS_NAMES[lower]) {
      return {
        raw: input,
        isDomain,
        address: KNOWN_PHAROS_NAMES[lower],
        isValid: true,
      };
    }

    return {
      raw: input,
      isDomain,
      isValid: false,
      error: `Could not resolve domain name or alias: "${trimmed}". Please provide a full 0x address or registered .pharos domain.`,
    };
  }

  registerAlias(alias: string, address: `0x${string}`): void {
    this.customDirectory.set(alias.toLowerCase(), getAddress(address));
  }
}
