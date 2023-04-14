const minify = require("html-minifier").minify;
const fs = require("fs-extra");
const path = require("path");


const projectRoot = path.join(__dirname, "..")
const resources = path.join(projectRoot, "resources");
const dist = path.join(projectRoot, "dist");
const src = path.join(projectRoot, "src");

const assets = {}
assets[dist] = [
    "beaver.html",
    "locales"
]
assets[resources] = [
    "style.css",
    "beaver_ui.js"
]

async function copyStaticAssets(destination, assets) {
    console.log(destination)
    console.log(assets)

    await fs.mkdir(destination, { recursive: true });
    for (let i = 0; i < assets.length; i++) {
        if (/\.html/.test(assets[i])) {
            const content = await fs.readFile(path.join(src, assets[i]), "utf-8")
            await fs.writeFile(path.join(destination, assets[i]), minify(content, { minifyCSS: false, minifyJS: false }))
        } else if (/\.js/.test(assets[i])) {
            // there is no js file now
            // await fs.copy(path.join(src, assets[i]), path.join(distination, assets[i]))
            // 
            await fs.copy(path.join(dist, assets[i]), path.join(destination, assets[i]))

        } else if (/\.css/.test(assets[i])) {
            const rawCSS = await fs.readFile(path.join(src, assets[i]), "utf-8");
            const minifiedCSS = minify("<style>" + rawCSS + "</style>", { minifyCSS: false });
            const finalCSS = minifiedCSS.substring(7, minifiedCSS.length - 8)
            await fs.writeFile(path.join(destination, assets[i]), finalCSS)
        } else {
            await fs.mkdir(path.join(destination, assets[i]), { recursive: true });
            await fs.copy(path.join(src, assets[i]), path.join(destination, assets[i]))
        }
    }
}



(async function () {
    const destinations = Object.keys(assets);
    for (let i = 0, l = destinations.length; i < l; i++) {
        await copyStaticAssets(destinations[i], assets[destinations[i]]);
    }
})().catch(err => {
    console.error(err);
    process.exit(1);
});
