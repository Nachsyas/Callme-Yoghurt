import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Catalog Product & Flavor Invariants (Phase 1.6)", () => {
  const OFFICIAL_FLAVORS = [
    "plain",
    "stroberi",
    "mangga",
    "melon",
    "anggur",
    "leci",
    "vanila",
  ];

  const INVALID_FLAVORS = [
    "pisang",
    "pisang-ambon",
    "pisang ambon",
    "banana",
    "ambon",
  ];

  it("proves exactly 7 official flavors exist in product detail page mapping", () => {
    const productPagePath = path.resolve(process.cwd(), "src/app/product/[id]/page.tsx");
    const content = fs.readFileSync(productPagePath, "utf-8");

    // All official flavors must be present
    for (const flavor of OFFICIAL_FLAVORS) {
      assert.ok(
        content.includes(`${flavor}: {`),
        `Official flavor '${flavor}' must be defined in FLAVORS mapping`
      );
      assert.ok(
        content.includes(`${flavor}: '/images/${flavor}.png'`),
        `Official image '/images/${flavor}.png' must be defined in FLAVOR_IMAGES`
      );
    }

    // Invalid flavors must NOT be present
    for (const invalid of INVALID_FLAVORS) {
      assert.equal(
        content.toLowerCase().includes(`'${invalid}'`) || content.toLowerCase().includes(`"${invalid}"`) || content.includes(`${invalid}:`),
        false,
        `Invalid flavor '${invalid}' must NOT exist in product page mapping`
      );
    }
  });

  it("proves Pisang Ambon has been completely removed from frontend codebase", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    function searchFiles(dir: string): string[] {
      const results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...searchFiles(fullPath));
        } else if (/\.(tsx|ts|jsx|js|json|css)$/.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allSrcFiles = searchFiles(srcDir);
    for (const filePath of allSrcFiles) {
      const content = fs.readFileSync(filePath, "utf-8").toLowerCase();
      assert.equal(
        content.includes("pisang ambon"),
        false,
        `File ${path.relative(process.cwd(), filePath)} contains 'pisang ambon'`
      );
      assert.equal(
        content.includes("pisang"),
        false,
        `File ${path.relative(process.cwd(), filePath)} contains 'pisang'`
      );
    }
  });

  it("proves official image assets exist in public/images/ and no pisang asset exists", () => {
    const imagesDir = path.resolve(process.cwd(), "public/images");
    for (const flavor of OFFICIAL_FLAVORS) {
      const imagePath = path.join(imagesDir, `${flavor}.png`);
      assert.ok(
        fs.existsSync(imagePath),
        `Asset public/images/${flavor}.png must exist`
      );
    }

    assert.ok(
      fs.existsSync(path.join(imagesDir, "all-variants.png")),
      "Asset public/images/all-variants.png must exist"
    );

    assert.equal(
      fs.existsSync(path.join(imagesDir, "pisang.png")),
      false,
      "Asset pisang.png must NEVER exist"
    );
  });
});
