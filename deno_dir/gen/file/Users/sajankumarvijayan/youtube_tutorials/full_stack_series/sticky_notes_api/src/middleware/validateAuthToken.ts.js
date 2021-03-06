import { log } from '../deps.ts';
import AuthenticationFailed from '../errors/authenticationFailed.ts';
import UserService from '../service/userService.ts';
import Token from '../utils/token.ts';
export default async (ctx, next) => {
    const token = ctx.request.headers.get('Authorization');
    log.info(`validateAuthToken: ${token}`);
    if (!token)
        throw new AuthenticationFailed('Authorization token not found. Please attached authorization token in the request headers');
    const payload = await new Token().verify(token);
    ctx.state.user = payload;
    await UserService.getInstance().getUserById(ctx.state.user._id);
    log.info(`validateAuthToken => ctx.state: ${ctx.state.user._id}`);
    await next();
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGVBdXRoVG9rZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2YWxpZGF0ZUF1dGhUb2tlbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQVcsR0FBRyxFQUFFLE1BQU0sWUFBWSxDQUFBO0FBQ3pDLE9BQU8sb0JBQW9CLE1BQU0sbUNBQW1DLENBQUE7QUFDcEUsT0FBTyxXQUFXLE1BQU0sMkJBQTJCLENBQUM7QUFDcEQsT0FBTyxLQUFLLE1BQU0sbUJBQW1CLENBQUE7QUFFckMsZUFBZSxLQUFLLEVBQUUsR0FBWSxFQUFFLElBQTRCLEVBQUUsRUFBRTtJQUNoRSxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDdkQsR0FBRyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsS0FBSyxFQUFFLENBQUMsQ0FBQTtJQUN2QyxJQUFJLENBQUMsS0FBSztRQUFFLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQywyRkFBMkYsQ0FBQyxDQUFDO0lBQ3hJLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEQsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLE1BQU0sV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUMvRCxHQUFHLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBRSxDQUFDO0lBRW5FLE1BQU0sSUFBSSxFQUFFLENBQUM7QUFDakIsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29udGV4dCwgbG9nIH0gZnJvbSAnLi4vZGVwcy50cydcbmltcG9ydCBBdXRoZW50aWNhdGlvbkZhaWxlZCBmcm9tICcuLi9lcnJvcnMvYXV0aGVudGljYXRpb25GYWlsZWQudHMnXG5pbXBvcnQgVXNlclNlcnZpY2UgZnJvbSAnLi4vc2VydmljZS91c2VyU2VydmljZS50cyc7XG5pbXBvcnQgVG9rZW4gZnJvbSAnLi4vdXRpbHMvdG9rZW4udHMnXG5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIChjdHg6IENvbnRleHQsIG5leHQ6ICgpID0+IFByb21pc2U8dW5rbm93bj4pID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IGN0eC5yZXF1ZXN0LmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyk7XG4gICAgbG9nLmluZm8oYHZhbGlkYXRlQXV0aFRva2VuOiAke3Rva2VufWApXG4gICAgaWYgKCF0b2tlbikgdGhyb3cgbmV3IEF1dGhlbnRpY2F0aW9uRmFpbGVkKCdBdXRob3JpemF0aW9uIHRva2VuIG5vdCBmb3VuZC4gUGxlYXNlIGF0dGFjaGVkIGF1dGhvcml6YXRpb24gdG9rZW4gaW4gdGhlIHJlcXVlc3QgaGVhZGVycycpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBhd2FpdCBuZXcgVG9rZW4oKS52ZXJpZnkodG9rZW4pO1xuICAgIGN0eC5zdGF0ZS51c2VyID0gcGF5bG9hZDtcbiAgICBhd2FpdCBVc2VyU2VydmljZS5nZXRJbnN0YW5jZSgpLmdldFVzZXJCeUlkKGN0eC5zdGF0ZS51c2VyLl9pZClcbiAgICBsb2cuaW5mbyhgdmFsaWRhdGVBdXRoVG9rZW4gPT4gY3R4LnN0YXRlOiAke2N0eC5zdGF0ZS51c2VyLl9pZH1gLCk7XG5cbiAgICBhd2FpdCBuZXh0KCk7XG59Il19