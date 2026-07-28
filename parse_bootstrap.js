const fs = require("fs");
const html = fs.readFileSync("/Users/abinalias/.openclaw/workspace/scraped/maket12/index_abin.html", "utf8");

const bootstrapMatch = html.match(/window\['bootstrap'\] = JSON\.parse\('(.*?)'\);/);
if (bootstrapMatch) {
    const raw = bootstrapMatch[1];
    const data = JSON.parse(raw);
    console.log("Bootstrap JSON parsed successfully!");
    const pages = data.page.A;
    console.log("Total sections/pages:", pages.length);
    pages.forEach((p, idx) => {
        console.log("=== SECTION " + (idx+1) + " ===");
        const jsonStr = JSON.stringify(p);
        const textMatches = [...jsonStr.matchAll(/"A":"([^"]*)"/g)];
        textMatches.forEach(tm => {
            if (tm[1].length > 1 && !tm[1].startsWith("http") && !tm[1].includes("wss:") && !tm[1].includes("export_website")) {
                console.log("  Text:", tm[1].replace(/\\n/g, " "));
            }
        });
    });
}
