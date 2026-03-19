class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, data, message });
  }

  static created(res, data, message = 'Created') {
    return res.status(201).json({ success: true, data, message });
  }

  static paginated(res, items, total, page, limit) {
    return res.status(200).json({
      success: true,
      data: { items, total, page, limit, hasMore: page * limit < total },
    });
  }

  static error(res, statusCode, code, message, details = null) {
    const body = { success: false, error: { code, message } };
    if (details) body.error.details = details;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
