const { errorResult, okResult } = require('./result');

const SEVERITY_ORDER = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
});

function evaluatePermission({ severity, approved } = {}) {
  const normalizedSeverity = SEVERITY_ORDER[severity] ? severity : 'critical';
  if (SEVERITY_ORDER[normalizedSeverity] >= SEVERITY_ORDER.critical && approved !== true) {
    return errorResult('APPROVAL_REQUIRED', 'Critical action requires explicit approval', {
      severity: normalizedSeverity
    });
  }
  return okResult({ severity: normalizedSeverity });
}

module.exports = {
  evaluatePermission
};
