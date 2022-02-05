## Getting started with Notes_api
Notes is a simple application that allows you to signup an account then using that account you can login then create/edit/update and delete your notes by highly secured authentication mechanism.


## Development setup

This project scaffolded using best partice in DENO. So, you have following options to run the project locally:
*   `git clone git@github.com:sajanv88/notes_api.git`
*   `export DENO_DIR=deno_dir` setup your cache directory and if you add any new library make sure you commit this.
*   To run server: `deno run --unstable --lock=lock.json --allow-net --allow-env src/mod.ts`
*   To update cached files `deno cache --reload  --unstable --lock=lock.json --lock-write src/deps.ts`
*   You can use my `postman_collection.json` file to check the api locally. 

## Production build

You must have installed docker and then you take the production by following command.
* `docker build --tag notes_api .` for creating your production image locally. 


## Demo
I have hosted this project on my own cloud server. [Live Demo UI](https://dev-notes-ui.sajankumarv.com) and [Live Demo API](https://notes-dev-api.sajankumarv.com/api/user/verify_auth)


## Contact
[Author: Sajan](connect@sajankumarv.com)
[Website](https://sajankumarv.com)
