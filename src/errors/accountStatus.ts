import AuthenticationFailed from './authenticationFailed.ts';
class AccountStatus extends AuthenticationFailed {
    constructor(message: string) {
        super(message)
        this.name = 'AccountStatus'
    }
}

export default AccountStatus;