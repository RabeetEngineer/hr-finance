export const apiResponse = (res, statusCode, message, data = null, meta = null) =>
  res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    meta,
  });

