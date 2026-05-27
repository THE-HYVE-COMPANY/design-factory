import { describe, expect, it } from "vitest";
import { wrapHtmlForViewportFit } from "./viewport-fit";

describe("wrapHtmlForViewportFit", () => {
  it("injects the shim before </head> when present", () => {
    const html = `<!doctype html><html><head><title>x</title></head><body>hi</body></html>`;
    const out = wrapHtmlForViewportFit(html);
    expect(out).toContain('id="df-viewport-fit"');
    expect(out.indexOf("df-viewport-fit")).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain("<title>x</title>");
    expect(out).toContain("hi");
  });

  it("wraps a fragment without head into a full document", () => {
    const html = `<div>hello</div>`;
    const out = wrapHtmlForViewportFit(html);
    expect(out).toContain("<!doctype html>");
    expect(out).toContain('id="df-viewport-fit"');
    expect(out).toContain("<div>hello</div>");
  });

  it("is idempotent — re-wrapping doesn't add a second shim", () => {
    const html = `<html><head></head><body></body></html>`;
    const once = wrapHtmlForViewportFit(html);
    const twice = wrapHtmlForViewportFit(once);
    expect(twice).toBe(once);
    expect((twice.match(/id="df-viewport-fit"/g) ?? []).length).toBe(1);
  });

  it("returns empty input unchanged", () => {
    expect(wrapHtmlForViewportFit("")).toBe("");
  });

  it("forces html/body to fill 100% with !important", () => {
    const out = wrapHtmlForViewportFit("<html><head></head><body></body></html>");
    expect(out).toContain("width: 100% !important");
    expect(out).toContain("height: 100% !important");
    expect(out).toContain("max-width: none !important");
  });
});
