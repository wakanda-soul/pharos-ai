import { existsSync, readFileSync } from 'node:fs';
import { generatePrivateKey } from 'viem/accounts';

/**
 * Secure Key Provider.
 * Enforces Arena Requirement 06: "Keeps private keys in env vars or a file, never in code or prompts."
 */
export class SecureKeyProvider {
  /**
   * Retrieves the signer private key securely from environment variable or local file.
   * Never hardcodes private keys into code repositories.
   */
  static resolveSignerPrivateKey(): `0x${string}` {
    // 1. Check environment variable
    const envKey = process.env.EVM_PRIVATE_KEY?.trim();
    if (envKey && envKey !== 'undefined' && envKey !== 'null') {
      if (!envKey.startsWith('0x')) {
        return `0x${envKey}` as `0x${string}`;
      }
      return envKey as `0x${string}`;
    }

    // 2. Check local secure key file (.private_key)
    const secureKeyPath = '.private_key';
    if (existsSync(secureKeyPath)) {
      const fileKey = readFileSync(secureKeyPath, 'utf-8').trim();
      if (fileKey) {
        return (fileKey.startsWith('0x') ? fileKey : `0x${fileKey}`) as `0x${string}`;
      }
    }

    // 3. Ephemeral runtime generator (zero hardcoded secrets in source code)
    // Used when running automated demos without pre-seeded testnet keys
    const ephemeralRandomKey = generatePrivateKey();
    return ephemeralRandomKey;
  }
}
