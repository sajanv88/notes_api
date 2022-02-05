export DENO_DIR=deno_dir
deno run --unstable --lock=lock.json --allow-net --allow-env src/mod.ts
deno cache --reload  --unstable --lock=lock.json --lock-write src/deps.ts