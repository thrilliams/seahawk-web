(async () => {
    const ctx = await require('./esbuild.common.cjs');

    await ctx.watch();
    await ctx.serve({ servedir: 'dist' });
})();
