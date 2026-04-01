import { ctx } from './esbuild.common';

await ctx.rebuild();
ctx.dispose();
