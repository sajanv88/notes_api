FROM denoland/deno

WORKDIR /app

COPY . .

ARG MONGODB_URI

ENV MONGODB_URI=$MONGODB_URI


USER deno

RUN export DENO_DIR=deno_dir

RUN deno cache --unstable --lock=lock.json src/deps.ts

RUN deno cache --unstable src/mod.ts

EXPOSE 8080

CMD [ "run", "--unstable", "--lock=lock.json", "--allow-net", "--allow-env", "src/mod.ts" ]
