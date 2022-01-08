class ConflictException extends Error {

    #message: string;
    constructor(message: string) {
        super(message)
        this.#message = message;
        this.name = 'ConflictException'
    }

    getCode = () => 409;

    toString = () => {
        return `{"name": "${this.name}", "message": ${this.#message}, "code": ${this.getCode()}}`
    }
}

export default ConflictException;