/**
 * Persistent State Log & Transition Journal for Pharos Saga Executor (Requirement 04).
 * Maintains an append-only timeline of workflow transitions, tracking exactly which step
 * the saga is executing, receipt verification checkpoints, retry attempts, and compensation rollbacks.
 */

import type {
  SagaExecutionPhase,
  SagaStateTransitionEvent,
} from './types.js';

export class SagaStateJournal {
  private transitionEvents: SagaStateTransitionEvent[] = [];
  private currentPhase: SagaExecutionPhase = 'INITIALIZED';
  private currentStepIndex: number = 0;
  private currentStepName: string = 'None';

  /**
   * Appends an immutable state transition event to the journal log.
   */
  public logTransition(eventParams: {
    sagaPhase: SagaExecutionPhase;
    stepIdentifier?: string;
    stepName?: string;
    orderIndex?: number;
    attemptNumber?: number;
    transactionHash?: `0x${string}`;
    blockNumber?: number;
    stateDeltaDescription: string;
    errorMessage?: string;
  }): SagaStateTransitionEvent {
    this.currentPhase = eventParams.sagaPhase;
    if (eventParams.orderIndex !== undefined) {
      this.currentStepIndex = eventParams.orderIndex;
    }
    if (eventParams.stepName) {
      this.currentStepName = eventParams.stepName;
    }

    const event: SagaStateTransitionEvent = {
      eventId: `event-${this.transitionEvents.length + 1}-${Date.now().toString(36)}`,
      timestampIso: new Date().toISOString(),
      sagaPhase: eventParams.sagaPhase,
      stepIdentifier: eventParams.stepIdentifier,
      stepName: eventParams.stepName,
      orderIndex: eventParams.orderIndex,
      attemptNumber: eventParams.attemptNumber ?? 1,
      transactionHash: eventParams.transactionHash,
      blockNumber: eventParams.blockNumber,
      stateDeltaDescription: eventParams.stateDeltaDescription,
      errorMessage: eventParams.errorMessage,
    };

    this.transitionEvents.push(event);
    return event;
  }

  /**
   * Returns current active saga phase.
   */
  public getCurrentPhase(): SagaExecutionPhase {
    return this.currentPhase;
  }

  /**
   * Returns current active step metadata.
   */
  public getCurrentStep(): { index: number; name: string } {
    return { index: this.currentStepIndex, name: this.currentStepName };
  }

  /**
   * Returns copy of all recorded transition events.
   */
  public getTransitionEvents(): SagaStateTransitionEvent[] {
    return [...this.transitionEvents];
  }

  /**
   * Renders a human-readable ASCII execution timeline of the saga state machine.
   */
  public renderAsciiExecutionTimeline(): string {
    const lines: string[] = [];
    lines.push('┌─────────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ 📜 SAGA STATE TRANSITION JOURNAL & REAL-TIME AUDIT LOG (Req 04)             │');
    lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

    for (const ev of this.transitionEvents) {
      const timeStr = ev.timestampIso.slice(11, 19); // HH:mm:ss
      const statusIcon = this.getPhaseIcon(ev.sagaPhase);
      const stepTag = ev.orderIndex !== undefined ? `[Step ${ev.orderIndex}: ${ev.stepName || ''}] (${ev.sagaPhase})` : `[${ev.sagaPhase}]`;
      const attemptTag = ev.attemptNumber > 1 ? `(Attempt ${ev.attemptNumber})` : '';

      lines.push(`│ ${timeStr} ${statusIcon} ${stepTag.padEnd(30)} ${attemptTag.padEnd(14)} │`);
      lines.push(`│   ↳ ${ev.stateDeltaDescription.slice(0, 71).padEnd(71)} │`);

      if (ev.transactionHash) {
        lines.push(`│     Tx: ${ev.transactionHash.slice(0, 36)}... (Block #${ev.blockNumber || 'pending'})`.padEnd(78) + '│');
      }
      if (ev.errorMessage) {
        lines.push(`│     ⚠️  Error: ${ev.errorMessage.slice(0, 63).padEnd(63)} │`);
      }
      lines.push('│                                                                             │');
    }

    lines.push('└─────────────────────────────────────────────────────────────────────────────┘');
    return lines.join('\n');
  }

  private getPhaseIcon(phase: SagaExecutionPhase): string {
    switch (phase) {
      case 'INITIALIZED':
        return '⚪';
      case 'IN_PROGRESS':
        return '🔵';
      case 'RETRYING':
        return '🟡';
      case 'STEP_CONFIRMED':
        return '🟢';
      case 'COMPENSATING':
        return '🟠';
      case 'COMPENSATED_CLEANLY':
        return '🛡️';
      case 'COMPLETED_SUCCESS':
        return '✅';
      case 'FAILED_FATAL':
        return '🔴';
    }
  }
}
