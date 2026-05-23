function okResult(fields = {}) {
  return {
    ok: true,
    ...fields
  };
}

function errorResult(code, message, fields = {}) {
  return {
    ok: false,
    code,
    message,
    ...fields
  };
}

module.exports = {
  errorResult,
  okResult
};
