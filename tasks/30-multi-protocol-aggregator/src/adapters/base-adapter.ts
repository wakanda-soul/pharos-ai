import { ProtocolId, ProtocolVenue, UserPosition, UnsignedTransaction } from '../types.js';

export interface ProtocolAdapter {
  readonly protocolId: ProtocolId;
  readonly protocolName: string;

  /**
   * Fetches all live venues / vaults with current APY, TVL, and terms.
   */
  fetchRates(): Promise<ProtocolVenue[]>;

  /**
   * Fetches current positions and accrued yield for a specific user.
   */
  fetchPositions(userAddress: `0x${string}`): Promise<UserPosition[]>;

  /**
   * Prepares an unsigned transaction for depositing/supplying assets into the vault.
   */
  prepareDeposit(
    venueId: string,
    amountUnits: string,
    userAddress: `0x${string}`
  ): Promise<UnsignedTransaction>;

  /**
   * Prepares an unsigned transaction for withdrawing assets from the vault.
   */
  prepareWithdraw(
    venueId: string,
    amountUnits: string,
    userAddress: `0x${string}`
  ): Promise<UnsignedTransaction>;
}
