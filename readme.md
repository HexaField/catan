# ir-static-build-template

Build the Ethereal Engine client by itself from scratch.

## Live Example
https://ir-engine.github.io/ir-static-build-template/

## Getting started

- Create your new repository by clicking the "Use this template" button
- Clone your new repository with `npm run clone-project -- --url https://github.com/<org>/<project>`
- Inside the cloned repository `cd packages/projects/projects<org>/<project>` run `npm run dev`
- The page will launch at `localhost:3000` and you can begin editing the code found in the `/src` folder

## Deploy to github pages

- Enable github pages for the repo
- Set STATIC_BUILD_ENABLED to `true` in repo secrets
- Set STATIC_BUILD_HOST to your github pages url in repo secrets without https:// (example: `username.github.io/repo-name`)
