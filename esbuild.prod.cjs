(async () => {
    const ctx = await require('./esbuild.common.cjs');
    await ctx.rebuild();
    ctx.dispose();
})();
