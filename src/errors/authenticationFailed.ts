class AuthenticationFailed extends Error {
    #message: string;
    constructor(message: string) {
        super(message)
        this.#message = message;
        this.name = 'AuthenticationFailed'
    }

    getCode = () => 403;

    toString = () => {
        return `{"name": "${this.name}","message":"${this.#message}", "code": ${this.getCode()}}`
    }
}

export default AuthenticationFailed;