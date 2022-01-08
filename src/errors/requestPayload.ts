class RequestPayloadException extends Error {
    #message: string;
    constructor(message: string) {
        super(message);
        this.name = 'RequestPayloadException';
        this.#message = message;
    }

    getCode = () => 400;

    toString = () => {
        return `{"name": "${this.name}", "message":"${this.#message}", "code": ${this.getCode()}}`
    }
}

export default RequestPayloadException;