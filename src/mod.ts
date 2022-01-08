import { Application, log } from './deps.ts';
import UserApiRoutes from './api/user.ts';
import NotesApiRoutes from './api/notes.ts';
import Exception from './errors/exception.ts';
import { mongoClient, MONGODB_URI } from './utils/mongo.ts';


const PORT = Number(Deno.env.get('PORT')) || 8080;
const app = new Application();

await log.setup({
    handlers: {
        console: new log.handlers.ConsoleHandler("INFO"),
    },
    loggers: {
        default: {
            level: "INFO",
            handlers: ["console"]
        }
    }
});


app.use(async (ctx, next) => {
    log.info(`Requested url: ${ctx.request.url} and Requested method: ${ctx.request.method}`);

    try {
        await next();
    } catch (e) {
        log.info(e)
        const err = new Exception<typeof e>(e);
        ctx.response.body = err.getMessage();
        ctx.response.status = err.getCode();
    }
});


// user api routes
const userRoutes = UserApiRoutes();
app.use(userRoutes.routes());
app.use(userRoutes.allowedMethods());

// notes api routes protected by authorization token
const notesRoutes = NotesApiRoutes();
app.use(notesRoutes.routes());
app.use(notesRoutes.allowedMethods());

if (import.meta.main) {
    log.info(`Server is up and running on ${PORT}`);

    await mongoClient.connect(MONGODB_URI)
        .catch(e => console.error(e))

    await app.listen({ port: PORT });
}

