import RequestPayloadException from './requestPayload.ts';
import ConflictException from './conflict.ts';
import NotFoundException from './notfound.ts';
import AuthenticationFailed from './authenticationFailed.ts';
import AccountStatus from './accountStatus.ts';
class Exception {
    #message = 'Internal server error';
    #code = 500;
    constructor(error) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhjZXB0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXhjZXB0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sdUJBQXVCLE1BQU0scUJBQXFCLENBQUM7QUFDMUQsT0FBTyxpQkFBaUIsTUFBTSxlQUFlLENBQUM7QUFDOUMsT0FBTyxpQkFBaUIsTUFBTSxlQUFlLENBQUM7QUFDOUMsT0FBTyxvQkFBb0IsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLGFBQWEsTUFBTSxvQkFBb0IsQ0FBQztBQUcvQyxNQUFNLFNBQVM7SUFFWCxRQUFRLEdBQVcsdUJBQXVCLENBQUM7SUFDM0MsS0FBSyxHQUFXLEdBQUcsQ0FBQztJQUVwQixZQUFZLEtBQVE7UUFDaEIsSUFBSSxLQUFLLFlBQVksdUJBQXVCO2VBQ3JDLEtBQUssWUFBWSxpQkFBaUI7ZUFDbEMsS0FBSyxZQUFZLGlCQUFpQjtlQUNsQyxLQUFLLFlBQVksb0JBQW9CO2VBQ3JDLEtBQUssWUFBWSxhQUFhLEVBQUU7WUFFbkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDakMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDaEM7SUFFTCxDQUFDO0lBRUQsVUFBVSxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDakMsT0FBTyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7Q0FDOUI7QUFFRCxlQUFlLFNBQVMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZXF1ZXN0UGF5bG9hZEV4Y2VwdGlvbiBmcm9tICcuL3JlcXVlc3RQYXlsb2FkLnRzJztcbmltcG9ydCBDb25mbGljdEV4Y2VwdGlvbiBmcm9tICcuL2NvbmZsaWN0LnRzJztcbmltcG9ydCBOb3RGb3VuZEV4Y2VwdGlvbiBmcm9tICcuL25vdGZvdW5kLnRzJztcbmltcG9ydCBBdXRoZW50aWNhdGlvbkZhaWxlZCBmcm9tICcuL2F1dGhlbnRpY2F0aW9uRmFpbGVkLnRzJztcbmltcG9ydCBBY2NvdW50U3RhdHVzIGZyb20gJy4vYWNjb3VudFN0YXR1cy50cyc7XG5cblxuY2xhc3MgRXhjZXB0aW9uPFQ+IHtcblxuICAgICNtZXNzYWdlOiBzdHJpbmcgPSAnSW50ZXJuYWwgc2VydmVyIGVycm9yJztcbiAgICAjY29kZTogbnVtYmVyID0gNTAwO1xuXG4gICAgY29uc3RydWN0b3IoZXJyb3I6IFQpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgUmVxdWVzdFBheWxvYWRFeGNlcHRpb25cbiAgICAgICAgICAgIHx8IGVycm9yIGluc3RhbmNlb2YgQ29uZmxpY3RFeGNlcHRpb25cbiAgICAgICAgICAgIHx8IGVycm9yIGluc3RhbmNlb2YgTm90Rm91bmRFeGNlcHRpb25cbiAgICAgICAgICAgIHx8IGVycm9yIGluc3RhbmNlb2YgQXV0aGVudGljYXRpb25GYWlsZWRcbiAgICAgICAgICAgIHx8IGVycm9yIGluc3RhbmNlb2YgQWNjb3VudFN0YXR1cykge1xuXG4gICAgICAgICAgICB0aGlzLiNtZXNzYWdlID0gZXJyb3IudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHRoaXMuI2NvZGUgPSBlcnJvci5nZXRDb2RlKCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGdldE1lc3NhZ2UgPSAoKSA9PiB0aGlzLiNtZXNzYWdlO1xuICAgIGdldENvZGUgPSAoKSA9PiB0aGlzLiNjb2RlO1xufVxuXG5leHBvcnQgZGVmYXVsdCBFeGNlcHRpb247Il19