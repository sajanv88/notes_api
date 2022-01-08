import { bcrypt } from '../deps.ts';

class Hash {
    text = async (text: string, log_rounds?: number | undefined) => {
        const salt = bcrypt.genSaltSync(log_rounds);
        const hashPassword = bcrypt.hashSync(text, salt);
        return hashPassword;
    }

    verify = async (text: string, hash: string) => {
        return bcrypt.compareSync(text, hash);
    }
}

export default Hash;