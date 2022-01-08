import { JWT } from '../deps.ts';
import AuthenticationFailed from '../errors/authenticationFailed.ts'

import generateCryptoKey from './generateCryptoKey.ts';
const secretKey = await generateCryptoKey();

class Token {

    create = async <T extends Record<string, any>>(payload: T) => {
        const token = await JWT.create(
            {
                alg: 'HS512',
                typ: "JWT"
            }, {
            ...payload,
            exp: new Date(Date.now() + 86400 * 1000).getTime()
        }, secretKey)
        return token;
    }

    verify = async (token: string) => {
        try {
            return await JWT.verify(token, secretKey);
        } catch (e) {
            throw new AuthenticationFailed('Provided token is invalid');
        }
    }
}

export default Token;