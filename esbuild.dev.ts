import { ctx } from './esbuild.common';

await ctx.watch();
await ctx.serve({ servedir: '.' });
