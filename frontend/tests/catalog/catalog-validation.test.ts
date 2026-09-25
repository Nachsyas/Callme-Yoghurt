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

  it("proves CatalogCard is simplified to presentational/navigational only (Phase 1.7C.8 Section V)", () => {
    const cardPath = path.resolve(process.cwd(), "src/components/catalog/CatalogCard.tsx");
    const content = fs.readFileSync(cardPath, "utf-8");

    // Required presentational and navigational elements
    assert.ok(content.includes("<Image"), "CatalogCard must render product image");
    assert.ok(content.includes("displayName"), "CatalogCard must render flavor/product name");
    assert.ok(content.includes("Lihat Detail"), "CatalogCard must contain 'Lihat Detail' CTA");
    assert.ok(content.includes("/product/"), "CatalogCard CTA must link to /product/<slug>");

    // Strictly forbidden card-level transactional controls
    assert.equal(content.includes("Pilihan Ukuran"), false, "CatalogCard must NOT contain 'Pilihan Ukuran'");
    assert.equal(content.includes("selectedSize"), false, "CatalogCard must NOT contain 'selectedSize' state");
    assert.equal(content.includes("PREVIEW_PRICES"), false, "CatalogCard must NOT contain 'PREVIEW_PRICES'");
    assert.equal(content.includes("Harga"), false, "CatalogCard must NOT contain 'Harga'");
    assert.equal(content.includes("16000") || content.includes("16.000"), false, "CatalogCard must NOT contain 16k price");
    assert.equal(content.includes("30000") || content.includes("30.000"), false, "CatalogCard must NOT contain 30k price");
    assert.equal(content.includes("55000") || content.includes("55.000"), false, "CatalogCard must NOT contain 55k price");
    assert.equal(content.includes("15000") || content.includes("15.000"), false, "CatalogCard must NOT contain 15k price");
    assert.equal(content.includes("+ Keranjang"), false, "CatalogCard must NOT contain '+ Keranjang'");
    assert.equal(content.includes("Pratinjau"), false, "CatalogCard must NOT contain 'Pratinjau'");
    assert.equal(content.includes("useCartStore"), false, "CatalogCard must NOT import or use useCartStore");
  });
});

