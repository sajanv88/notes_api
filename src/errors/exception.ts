import RequestPayloadException from './requestPayload.ts';
import ConflictException from './conflict.ts';
import NotFoundException from './notfound.ts';
import AuthenticationFailed from './authenticationFailed.ts';
import AccountStatus from './accountStatus.ts';


class Exception<T> {

    #message: string = 'Internal server error';
    #code: number = 500;

    constructor(error: T) {
        if (error instanceof RequestPayloadException
            || error instanceof ConflictException
            || error instanceof NotFoundException
            || error instanceof AuthenticationFailed
            || error instanceof AccountStatus) {

            this.#message = error.toString();
            this.#code = error.getCode();
        }

    }

    getMessage = () => this.#message;
    getCode = () => this.#code;
}

export default Exception;