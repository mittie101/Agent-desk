const { errorResult, okResult } = require('../core/result');

const CRITICAL_CONFIRMATION = 'I understand this critical action';

function createApprovalManager(state, emitEvent) {
  function createWriteFileApproval({ runId, agentName }) {
    const approval = {
      id: `approval-${state.nextApprovalNumber++}`,
      runId,
      agentName,
      status: 'pending',
      severity: 'critical',
      actionType: 'write_file',
      title: 'Mock write_file approval',
      path: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };
    state.approvals.push(approval);
    emitEvent('warn', 'approval-manager', 'Mock write_file approval requested.', {
      approvalId: approval.id,
      phase: 5
    });
    return approval;
  }

  function findPendingApproval(approvalId) {
    const approval = state.approvals.find((candidate) => candidate.id === approvalId);
    if (!approval) {
      return errorResult('APPROVAL_NOT_FOUND', 'Approval was not found');
    }
    if (approval.status === 'expired') {
      return errorResult('APPROVAL_EXPIRED', 'Approval has expired', { approval });
    }
    if (approval.status !== 'pending') {
      return errorResult('APPROVAL_ALREADY_RESOLVED', 'Approval is already resolved', { approval });
    }
    return okResult({ approval });
  }

  function approve(approvalId, { typedConfirmation } = {}) {
    const found = findPendingApproval(approvalId);
    if (!found.ok) {
      return found;
    }
    if (typedConfirmation !== CRITICAL_CONFIRMATION) {
      return errorResult('CONFIRMATION_MISMATCH', 'Critical typed confirmation did not match');
    }
    found.approval.status = 'approved';
    found.approval.resolvedAt = new Date().toISOString();
    return okResult({ approval: found.approval });
  }

  function deny(approvalId, { reason } = {}) {
    const found = findPendingApproval(approvalId);
    if (!found.ok) {
      return found;
    }
    found.approval.status = 'denied';
    found.approval.reason = typeof reason === 'string' ? reason.slice(0, 300) : '';
    found.approval.resolvedAt = new Date().toISOString();
    emitEvent('warn', 'approval-manager', 'Approval denied by operator.', {
      approvalId,
      reason: found.approval.reason,
      phase: 5
    });
    return okResult({ approval: found.approval });
  }

  return {
    approve,
    createWriteFileApproval,
    deny
  };
}

module.exports = {
  CRITICAL_CONFIRMATION,
  createApprovalManager
};
