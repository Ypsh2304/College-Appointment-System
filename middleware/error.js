
export const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

export const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.code || (res.statusCode !== 200 ? res.statusCode : 500);

    res.status(statusCode).json({
        message: err.message || "Server Error"
    });
};
