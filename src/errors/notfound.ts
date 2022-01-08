class NotFoundException extends Error {
    #message: string;
    constructor(message: string) {
        super(message)
        this.#message = message;
        this.name = 'NotFoundException'
    }

    getCode = () => 404;

    toString = () => {
        return `{"name: ${this.name}", "message":"${this.#message}", "code": ${this.getCode()}}`
    }
}

export default NotFoundException;