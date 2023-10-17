This would have been just a `ReturnType<typeof myFunction>`, but I needed to
declaration merge the inferred result with `process.env` which was used inside of the function, resulting in `any`.

```js
// env.mjs
const env = required({
  SOME_ENV_VAR: process.env.SOME_ENV_VAR,
});
```

```ts
// types.d.ts
import { env } from "./env.mjs";

interface Env {
  SOME_ENV_VAR: string;
}
declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}
```
