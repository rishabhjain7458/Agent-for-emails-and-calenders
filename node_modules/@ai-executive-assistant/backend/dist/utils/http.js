export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export function send(res, data, status = 200) {
    return res.status(status).json({ data });
}
