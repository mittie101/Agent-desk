const crypto = require('node:crypto');
const { errorResult, okResult } = require('./result');

function normalizeToken(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createTokenAuthenticator({ token } = {}) {
  const expectedToken = normalizeToken(token);
  if (!expectedToken) {
    throw new Error('token is required');
  }

  return {
    verify(candidate) {
      const candidateToken = normalizeToken(candidate);
      if (!candidateToken) {
        return errorResult('TOKEN_MISSING', 'Authentication token is required');
      }
      if (!timingSafeEqualText(candidateToken, expectedToken)) {
        return errorResult('TOKEN_INVALID', 'Authentication token is invalid');
      }
      return okResult();
    }
  };
}

module.exports = {
  createTokenAuthenticator
};
