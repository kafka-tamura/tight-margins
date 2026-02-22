import { useState, useRef, useCallback, useEffect } from "react";
import { jsPDF } from "jspdf";

// ═══════════════════════════════════════════════════════
// DESIGN SYSTEM CONSTANTS
// ═══════════════════════════════════════════════════════
const C = {
  paper: "#F0EDEA",
  ink: "#2A2A2A",
  red: "#C83232",
  dark: "#333333",
  grey: "#D0CCC8",
  callout: "#555555",
  slide: 1080,
  marginLine: 144,
  contentStart: 176,
  outerMargin: 64,
  contentEnd: 1016,
  coverBandL: 280,
  coverBandR: 800,
  coverChannelW: 520,
  ruledInterval: 32,
  ruledStart: 64,
};

// ═══════════════════════════════════════════════════════
// FONT LOADING — register FontFace objects for canvas reliability
// ═══════════════════════════════════════════════════════
// CSS @font-face from Google Fonts loads lazily and may not be available
// when canvas draws. We register FontFace objects directly so canvas can
// always resolve our font families, regardless of CSS load timing.

let fontsLoadedPromise = null;
function ensureFontsLoaded() {
  if (!fontsLoadedPromise) {
    fontsLoadedPromise = (async () => {
      // Build a single Google Fonts CSS URL for all families we need
      const cssUrl =
        "https://fonts.googleapis.com/css2?" +
        "family=Inter+Tight:wght@400;600;700;800;900" +
        "&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500" +
        "&family=JetBrains+Mono:wght@400;500;700" +
        "&display=swap";

      try {
        // Fetch the CSS to get the actual @font-face declarations with woff2 URLs
        const resp = await fetch(cssUrl);
        const cssText = await resp.text();

        // Parse @font-face blocks and register each as a FontFace
        const faceRegex = /@font-face\s*\{([^}]+)\}/g;
        let match;
        const promises = [];

        while ((match = faceRegex.exec(cssText)) !== null) {
          const block = match[1];
          const familyMatch = block.match(/font-family:\s*'([^']+)'/);
          const styleMatch = block.match(/font-style:\s*(\w+)/);
          const weightMatch = block.match(/font-weight:\s*(\d+)/);
          const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);

          if (familyMatch && srcMatch) {
            const face = new FontFace(familyMatch[1], `url(${srcMatch[1]})`, {
              style: styleMatch ? styleMatch[1] : "normal",
              weight: weightMatch ? weightMatch[1] : "400",
            });
            promises.push(
              face
                .load()
                .then((loaded) => {
                  document.fonts.add(loaded);
                })
                .catch((e) => {
                  console.warn("Font face load failed:", familyMatch[1], e);
                }),
            );
          }
        }

        await Promise.all(promises);
      } catch (e) {
        console.warn(
          "Font CSS fetch failed, falling back to document.fonts.ready:",
          e,
        );
      }

      await document.fonts.ready;
    })();
  }
  return fontsLoadedPromise;
}

// ═══════════════════════════════════════════════════════
// TEMPLATE DEFINITIONS
// ═══════════════════════════════════════════════════════
const TEMPLATES = {
  cover: {
    name: "Cover (Corridor)",
    fields: [
      {
        key: "title",
        label: "Title",
        max: 50,
        placeholder: "Why Most Frameworks Fail",
      },
      {
        key: "subtitle",
        label: "Subtitle",
        max: 80,
        placeholder:
          "The difference between a model and a framework that sticks.",
      },
    ],
  },
  single: {
    name: "Single Concept",
    fields: [
      {
        key: "headline",
        label: "Headline",
        max: 50,
        placeholder: "Constraints Are Creative Fuel",
      },
      {
        key: "body",
        label: "Body",
        max: 200,
        placeholder:
          "When you remove options, you force clarity. The best work happens inside tight margins, not open fields.",
        multiline: true,
      },
      {
        key: "emphasis",
        label: "Emphasis words (bold+underline)",
        max: 30,
        placeholder: "tight margins",
      },
    ],
  },
  comparison: {
    name: "Comparison",
    fields: [
      {
        key: "left_header",
        label: "Left header",
        max: 25,
        placeholder: "Storytelling",
      },
      {
        key: "left_body",
        label: "Left body",
        max: 150,
        placeholder: "Linear narrative. One arc. Emotion-driven.",
        multiline: true,
      },
      {
        key: "right_header",
        label: "Right header",
        max: 25,
        placeholder: "Worldbuilding",
      },
      {
        key: "right_body",
        label: "Right body",
        max: 150,
        placeholder: "Systemic context. Many layers. Intuition-driven.",
        multiline: true,
      },
      {
        key: "vs_label",
        label: "VS label (optional)",
        max: 10,
        placeholder: "VS",
      },
    ],
  },
  framework: {
    name: "Framework / Diagram",
    fields: [
      {
        key: "title",
        label: "Title",
        max: 40,
        placeholder: "4 Communication Styles",
      },
      {
        key: "labels",
        label: "Labels (comma-separated, max 8)",
        max: 200,
        placeholder: "Messenger, Filter, Diffuser, Prism",
      },
      {
        key: "caption",
        label: "Caption (optional)",
        max: 100,
        placeholder: "Be a Prism when engaging with different teams",
      },
    ],
  },
  punchline: {
    name: "Punchline",
    fields: [
      {
        key: "text",
        label: "Punchline text",
        max: 80,
        placeholder: "The emptiness IS the emphasis.",
      },
      {
        key: "emphasis",
        label: "Emphasis word (in red)",
        max: 15,
        placeholder: "emphasis",
      },
    ],
  },
  data: {
    name: "Data / Evidence",
    fields: [
      { key: "data_point", label: "Data point", max: 20, placeholder: "73%" },
      {
        key: "context",
        label: "Context",
        max: 120,
        placeholder:
          "of enterprise decisions are made with incomplete data, despite having more tools than ever.",
        multiline: true,
      },
      {
        key: "source",
        label: "Source",
        max: 60,
        placeholder: "Gartner Research, 2024",
      },
    ],
  },
  cta: {
    name: "Closing CTA",
    fields: [
      {
        key: "cta_text",
        label: "CTA text",
        max: 40,
        placeholder: "Subscribe for more.",
      },
      { key: "url", label: "URL", max: 60, placeholder: "tightmargins.com" },
      {
        key: "handle",
        label: "Handle (optional)",
        max: 30,
        placeholder: "@tightmargins",
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════
// SEQUENCE PATTERNS
// ═══════════════════════════════════════════════════════
const SEQUENCES = {
  argument: {
    name: "The Argument",
    desc: "8–10 slides. Frameworks, mental models, structured insights.",
    slides: [
      { template: "cover", locked: true, note: "Hook — provocative title" },
      { template: "single", note: "Setup — establish context" },
      { template: "single", note: "Complication — introduce problem" },
      { template: "framework", note: "Model — present the framework" },
      { template: "single", note: "Unpack — component 1" },
      { template: "single", note: "Unpack — component 2" },
      { template: "single", note: "Unpack — component 3" },
      { template: "punchline", note: "Payoff — the key insight" },
      { template: "data", note: "Proof — validating data" },
      { template: "cta", locked: true, note: "Exit — subscribe" },
    ],
  },
  hottake: {
    name: "The Hot Take",
    desc: "6–8 slides. Provocative claim, sharp observation.",
    slides: [
      { template: "cover", locked: true, note: "Hook — bold claim" },
      { template: "data", note: "Shock — the credible number" },
      { template: "single", note: "Context — why it matters" },
      { template: "comparison", note: "Contrast — wisdom vs reality" },
      { template: "punchline", note: "Resolution — the real insight" },
      { template: "cta", locked: true, note: "Exit — subscribe" },
    ],
  },
  casestudy: {
    name: "The Case Study",
    desc: "8–12 slides. Real-world decision analysis.",
    slides: [
      { template: "cover", locked: true, note: "Hook — the decision" },
      { template: "single", note: "Situation — what was at stake" },
      { template: "data", note: "Scale — tangible stakes" },
      { template: "single", note: "Constraint — the tight margin" },
      { template: "comparison", note: "Options — choices & tradeoffs" },
      { template: "single", note: "Decision — what was chosen" },
      { template: "punchline", note: "Outcome — what happened" },
      { template: "single", note: "Lesson — generalizable insight" },
      { template: "cta", locked: true, note: "Exit — subscribe" },
    ],
  },
};

// ═══════════════════════════════════════════════════════
// CANVAS DRAWING HELPERS
// ═══════════════════════════════════════════════════════
function drawRuledLines(ctx) {
  ctx.save();
  ctx.strokeStyle = C.grey;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.35;
  for (let y = C.ruledStart; y <= C.slide; y += C.ruledInterval) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(C.slide, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarginLine(ctx, x = C.marginLine, opacity = 0.7) {
  ctx.save();
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 2;
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, C.slide);
  ctx.stroke();
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return 0;
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = test;
    }
  }
  lines.push(line.trim());
  lines.forEach((l, i) => {
    ctx.fillText(l, x, y + i * lineHeight);
  });
  return lines.length;
}

function drawTextWithEmphasis(
  ctx,
  text,
  emphasisWord,
  x,
  y,
  maxWidth,
  lineHeight,
  emphColor = C.red,
) {
  if (!text) return 0;
  if (
    !emphasisWord ||
    !text.toLowerCase().includes(emphasisWord.toLowerCase())
  ) {
    return wrapText(ctx, text, x, y, maxWidth, lineHeight);
  }
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = test;
    }
  }
  lines.push(line.trim());

  const origFont = ctx.font;
  const origFill = ctx.fillStyle;
  const emphWords = emphasisWord.toLowerCase().split(" ");

  lines.forEach((l, i) => {
    const ly = y + i * lineHeight;
    const lineWords = l.split(" ");
    const spW = ctx.measureText(" ").width;
    let cx = x;
    lineWords.forEach((w, wi) => {
      const clean = w.toLowerCase().replace(/[.,!?;:'"]/g, "");
      const isEmph = emphWords.includes(clean);
      if (isEmph) {
        const boldFont = origFont.replace(/\d00/, "700");
        ctx.font = boldFont.includes("700") ? boldFont : "bold " + origFont;
        ctx.fillStyle = C.ink;
        ctx.fillText(w, cx, ly);
        const ww = ctx.measureText(w).width;
        ctx.save();
        ctx.strokeStyle = emphColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, ly + 4);
        ctx.lineTo(cx + ww, ly + 4);
        ctx.stroke();
        ctx.restore();
        cx += ww;
        ctx.font = origFont;
        ctx.fillStyle = origFill;
      } else {
        ctx.fillText(w, cx, ly);
        cx += ctx.measureText(w).width;
      }
      if (wi < lineWords.length - 1) cx += spW;
    });
  });
  return lines.length;
}

// ═══════════════════════════════════════════════════════
// SLIDE RENDERERS
// ═══════════════════════════════════════════════════════
const renderers = {
  cover: (ctx, data) => {
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, 0, C.coverBandL, C.slide);
    ctx.fillStyle = C.paper;
    ctx.fillRect(C.coverBandL, 0, C.coverChannelW, C.slide);
    ctx.fillStyle = C.dark;
    ctx.fillRect(C.coverBandR, 0, C.slide - C.coverBandR, C.slide);
    drawMarginLine(ctx, C.coverBandL, 1.0);

    const tx = C.coverBandL + 24;
    const maxW = C.coverChannelW - 48;
    ctx.fillStyle = C.ink;
    ctx.font = "700 72px 'Inter Tight', sans-serif";
    const titleLines = wrapText(
      ctx,
      data.title || "Your Title Here",
      tx,
      420,
      maxW,
      80,
    );

    const ruleY = 420 + titleLines * 80 + 16;
    ctx.fillStyle = C.red;
    ctx.fillRect(tx, ruleY, 80, 4);

    ctx.fillStyle = C.red;
    ctx.font = "500 32px 'Newsreader', Georgia, serif";
    wrapText(ctx, data.subtitle || "", tx, ruleY + 44, maxW, 42);

    ctx.fillStyle = C.grey;
    ctx.font = "400 18px 'JetBrains Mono', monospace";
    ctx.fillText("TIGHT MARGINS", tx, C.slide - 48);
  },

  single: (ctx, data, slideNum) => {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, C.slide, C.slide);
    drawRuledLines(ctx);
    drawMarginLine(ctx);
    if (slideNum) {
      ctx.fillStyle = C.grey;
      ctx.font = "400 20px 'JetBrains Mono', monospace";
      ctx.fillText(String(slideNum).padStart(2, "0"), 64, 80);
    }
    ctx.fillStyle = C.ink;
    ctx.font = "700 68px 'Inter Tight', sans-serif";
    const hLines = wrapText(
      ctx,
      data.headline || "Headline",
      C.contentStart,
      180,
      C.contentEnd - C.contentStart,
      76,
    );

    const bodyY = 180 + hLines * 76 + 48;
    ctx.fillStyle = C.ink;
    ctx.font = "500 34px 'Newsreader', Georgia, serif";
    drawTextWithEmphasis(
      ctx,
      data.body || "",
      data.emphasis || "",
      C.contentStart,
      bodyY,
      C.contentEnd - C.contentStart,
      46,
    );
  },

  comparison: (ctx, data, slideNum) => {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, C.slide, C.slide);
    drawRuledLines(ctx);
    drawMarginLine(ctx);
    if (slideNum) {
      ctx.fillStyle = C.grey;
      ctx.font = "400 20px 'JetBrains Mono', monospace";
      ctx.fillText(String(slideNum).padStart(2, "0"), 64, 80);
    }
    const colL = C.contentStart;
    const colMid = C.contentStart + (C.contentEnd - C.contentStart) / 2;
    const colR = C.contentEnd;
    const colW = (colR - colL - 24) / 2;

    ctx.save();
    ctx.strokeStyle = C.grey;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(colMid, 120);
    ctx.lineTo(colMid, C.slide - 64);
    ctx.stroke();
    ctx.restore();

    if (data.vs_label) {
      ctx.fillStyle = C.grey;
      ctx.font = "700 22px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(data.vs_label, colMid, 310);
      ctx.textAlign = "start";
    }

    ctx.fillStyle = C.ink;
    ctx.font = "600 44px 'Inter Tight', sans-serif";
    ctx.fillText(data.left_header || "Left", colL, 180);
    ctx.font = "500 30px 'Newsreader', Georgia, serif";
    wrapText(ctx, data.left_body || "", colL, 236, colW, 42);

    ctx.fillStyle = C.ink;
    ctx.font = "600 44px 'Inter Tight', sans-serif";
    ctx.fillText(data.right_header || "Right", colMid + 12, 180);
    ctx.font = "500 30px 'Newsreader', Georgia, serif";
    wrapText(ctx, data.right_body || "", colMid + 12, 236, colW, 42);
  },

  framework: (ctx, data, slideNum) => {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, C.slide, C.slide);
    drawRuledLines(ctx);
    drawMarginLine(ctx);
    if (slideNum) {
      ctx.fillStyle = C.grey;
      ctx.font = "400 20px 'JetBrains Mono', monospace";
      ctx.fillText(String(slideNum).padStart(2, "0"), 64, 80);
    }
    ctx.fillStyle = C.ink;
    ctx.font = "700 52px 'Inter Tight', sans-serif";
    ctx.fillText(data.title || "Framework", C.contentStart, 172);

    const labels = (data.labels || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (labels.length > 0) {
      const area = { x: C.contentStart + 20, y: 240, w: 720, h: 540 };
      const cols = Math.min(labels.length, 4);
      const rows = Math.ceil(labels.length / cols);
      const boxW = (area.w - (cols - 1) * 24) / cols;
      const boxH = Math.min((area.h - (rows - 1) * 24) / rows, 160);
      labels.forEach((label, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = area.x + col * (boxW + 24);
        const by = area.y + row * (boxH + 24);
        ctx.save();
        ctx.strokeStyle = i === 0 ? C.red : C.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, boxW, boxH);
        ctx.fillStyle = i === 0 ? C.red : C.callout;
        ctx.font = "400 26px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, bx + boxW / 2, by + boxH / 2 + 9);
        ctx.textAlign = "start";
        ctx.restore();
      });
    }
    if (data.caption) {
      ctx.fillStyle = C.callout;
      ctx.font = "500 24px 'Newsreader', Georgia, serif";
      ctx.fillText(data.caption, C.contentStart, C.slide - 80);
    }
  },

  punchline: (ctx, data) => {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, C.slide, C.slide);
    drawRuledLines(ctx);
    drawMarginLine(ctx);

    const text = data.text || "Your punchline here.";
    const emphasis = data.emphasis || "";
    ctx.fillStyle = C.ink;
    ctx.font = "700 76px 'Inter Tight', sans-serif";
    const fullW = C.contentEnd - C.contentStart;

    // Measure lines for vertical centering
    const words = text.split(" ");
    let testLine = "";
    const testLines = [];
    for (const word of words) {
      const t = testLine + word + " ";
      if (ctx.measureText(t).width > fullW && testLine) {
        testLines.push(testLine.trim());
        testLine = word + " ";
      } else {
        testLine = t;
      }
    }
    testLines.push(testLine.trim());
    const totalH = testLines.length * 84;
    const startY = (C.slide - totalH) / 2 + 76;
    const emphWords = emphasis ? emphasis.toLowerCase().split(" ") : [];

    const spaceW = ctx.measureText(" ").width;
    testLines.forEach((line, i) => {
      const ly = startY + i * 84;
      if (emphWords.length > 0) {
        const lineWords = line.split(" ");
        let cx = C.contentStart;
        lineWords.forEach((w, wi) => {
          const clean = w.toLowerCase().replace(/[.,!?;:'"]/g, "");
          const isEmph = emphWords.includes(clean);
          ctx.fillStyle = isEmph ? C.red : C.ink;
          ctx.fillText(w, cx, ly);
          cx += ctx.measureText(w).width;
          if (wi < lineWords.length - 1) cx += spaceW;
        });
      } else {
        ctx.fillText(line, C.contentStart, ly);
      }
    });
  },

  data: (ctx, data, slideNum) => {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, C.slide, C.slide);
    drawRuledLines(ctx);
    drawMarginLine(ctx);
    if (slideNum) {
      ctx.fillStyle = C.grey;
      ctx.font = "400 20px 'JetBrains Mono', monospace";
      ctx.fillText(String(slideNum).padStart(2, "0"), 64, 80);
    }
    ctx.fillStyle = C.red;
    ctx.font = "700 108px 'JetBrains Mono', monospace";
    ctx.fillText(data.data_point || "0%", C.contentStart, 480);
    ctx.fillStyle = C.ink;
    ctx.font = "500 32px 'Newsreader', Georgia, serif";
    wrapText(
      ctx,
      data.context || "",
      C.contentStart,
      548,
      C.contentEnd - C.contentStart,
      44,
    );
    if (data.source) {
      ctx.fillStyle = C.grey;
      ctx.font = "italic 500 20px 'Newsreader', Georgia, serif";
      ctx.fillText(data.source, C.contentStart, C.slide - 80);
    }
  },

  cta: (ctx, data) => {
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, 0, C.slide, C.slide);
    drawMarginLine(ctx, C.marginLine, 0.6);

    ctx.fillStyle = C.paper;
    ctx.font = "900 72px 'Inter Tight', sans-serif";
    ctx.fillText("TIGHT MARGINS", C.contentStart, 440);

    ctx.fillStyle = C.red;
    ctx.fillRect(C.contentStart, 468, 80, 4);

    ctx.fillStyle = C.paper;
    ctx.font = "600 40px 'Inter Tight', sans-serif";
    ctx.fillText(data.cta_text || "Subscribe for more.", C.contentStart, 540);

    ctx.fillStyle = C.red;
    ctx.font = "400 26px 'JetBrains Mono', monospace";
    ctx.fillText(data.url || "tightmargins.com", C.contentStart, 592);

    if (data.handle) {
      ctx.fillStyle = C.grey;
      ctx.font = "400 22px 'JetBrains Mono', monospace";
      ctx.fillText(data.handle, C.contentStart, 628);
    }
  },
};

// ═══════════════════════════════════════════════════════
// SLIDE CANVAS COMPONENT
// ═══════════════════════════════════════════════════════
function SlideCanvas({ template, data, slideNum, size = 540 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    ensureFontsLoaded().then(() => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = C.slide;
      canvas.height = C.slide;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, C.slide, C.slide);
      if (renderers[template]) {
        renderers[template](ctx, data || {}, slideNum);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [template, data, slideNum]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════
// FIELD EDITOR
// ═══════════════════════════════════════════════════════
function FieldEditor({ field, value, onChange }) {
  const len = (value || "").length;
  const over = len > field.max;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <label
          style={{
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 600,
            fontSize: 12,
            color: C.ink,
          }}
        >
          {field.label}
        </label>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: over ? C.red : C.grey,
          }}
        >
          {len}/{field.max}
        </span>
      </div>
      {field.multiline ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          maxLength={field.max}
          style={{
            width: "100%",
            padding: "8px 10px",
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: C.ink,
            background: "#fff",
            border: `1px solid ${over ? C.red : C.grey}`,
            borderRadius: 3,
            resize: "vertical",
            outline: "none",
            lineHeight: 1.5,
          }}
        />
      ) : (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.max}
          style={{
            width: "100%",
            padding: "8px 10px",
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 14,
            color: C.ink,
            background: "#fff",
            border: `1px solid ${over ? C.red : C.grey}`,
            borderRadius: 3,
            outline: "none",
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PDF EXPORT (using jsPDF from npm)
// ═══════════════════════════════════════════════════════
async function exportPDF(slides) {
  await ensureFontsLoaded();

  const scale = 2;
  const canvasSize = C.slide * scale;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");

  // PDF page in pt: use half the pixel size so effective DPI = 2160/7.5in ≈ 288
  const pageSize = C.slide / 2;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [pageSize, pageSize],
  });

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage([pageSize, pageSize], "landscape");
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.save();
    ctx.scale(scale, scale);
    const s = slides[i];
    const showNum = !["cover", "cta", "punchline"].includes(s.template);
    if (renderers[s.template]) {
      renderers[s.template](ctx, s.data || {}, showNum ? i + 1 : null);
    }
    ctx.restore();
    const imgData = canvas.toDataURL("image/png", 1.0);
    pdf.addImage(imgData, "PNG", 0, 0, pageSize, pageSize);
  }

  pdf.save("tight-margins-carousel.pdf");
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [slides, setSlides] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canvasSize, setCanvasSize] = useState(540);

  // Responsive canvas
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w < 768) setCanvasSize(w - 48);
      else if (w < 1200) setCanvasSize(Math.min(480, w - 580));
      else setCanvasSize(540);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function initFromSequence(seqKey) {
    const seq = SEQUENCES[seqKey];
    setSlides(
      seq.slides.map((s) => ({
        template: s.template,
        locked: s.locked || false,
        note: s.note,
        data: {},
      })),
    );
    setSelectedIdx(0);
    setPreviewMode(false);
  }

  function initCustom() {
    setSlides([
      {
        template: "cover",
        locked: true,
        note: "Cover (always first)",
        data: {},
      },
      { template: "single", note: "Your content", data: {} },
      { template: "cta", locked: true, note: "CTA (always last)", data: {} },
    ]);
    setSelectedIdx(0);
    setPreviewMode(false);
  }

  function updateSlideData(idx, key, value) {
    setSlides((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], data: { ...next[idx].data, [key]: value } };
      return next;
    });
  }

  function changeTemplate(idx, newTemplate) {
    setSlides((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], template: newTemplate, data: {} };
      return next;
    });
  }

  function addSlide(afterIdx) {
    if (slides.length >= 12) return;
    setSlides((prev) => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, { template: "single", note: "", data: {} });
      return next;
    });
    setSelectedIdx(afterIdx + 1);
  }

  function removeSlide(idx) {
    if (slides.length <= 6) return;
    if (slides[idx].locked) return;
    setSlides((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    if (selectedIdx >= idx && selectedIdx > 0) setSelectedIdx(selectedIdx - 1);
  }

  function moveSlide(idx, dir) {
    const targetIdx = idx + dir;
    if (targetIdx <= 0 || targetIdx >= slides.length - 1) return;
    if (slides[idx].locked) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
    setSelectedIdx(targetIdx);
  }

  function handleExport() {
    setExporting(true);
    // Small delay to let fonts render in offscreen canvas
    setTimeout(() => {
      try {
        exportPDF(slides);
      } catch (e) {
        console.error("Export failed:", e);
        alert("PDF export failed. Check console for details.");
      }
      setExporting(false);
    }, 100);
  }

  // Save/load from localStorage
  useEffect(() => {
    if (slides) {
      localStorage.setItem("tm-carousel", JSON.stringify(slides));
    }
  }, [slides]);

  useEffect(() => {
    const saved = localStorage.getItem("tm-carousel");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          // Don't auto-restore — let user choose sequence
        }
      } catch {}
    }
  }, []);

  // ─── SEQUENCE PICKER ───
  if (!slides) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter Tight', sans-serif",
        }}
      >
        <div style={{ maxWidth: 640, padding: "48px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: C.ink,
                letterSpacing: "-0.04em",
                margin: 0,
              }}
            >
              TIGHT MARGINS
            </h1>
            <div
              style={{
                width: 64,
                height: 3,
                background: C.red,
                marginTop: 8,
                marginBottom: 12,
              }}
            />
            <p
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: 16,
                color: C.callout,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              LinkedIn carousel builder. Choose a sequence pattern to get
              started, or build a custom carousel.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(SEQUENCES).map(([key, seq]) => (
              <button
                key={key}
                onClick={() => initFromSequence(key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 20px",
                  background: "#fff",
                  border: `1px solid ${C.grey}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  borderLeft: `3px solid ${C.red}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.red;
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(200,50,50,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.grey;
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderLeftColor = C.red;
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: C.ink,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {seq.name}
                </span>
                <span
                  style={{
                    fontFamily: "'Newsreader', serif",
                    fontSize: 13,
                    color: C.callout,
                    marginTop: 4,
                  }}
                >
                  {seq.desc}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: C.grey,
                    marginTop: 6,
                  }}
                >
                  {seq.slides.length} slides:{" "}
                  {seq.slides
                    .map((s) =>
                      s.template === "cover"
                        ? "C"
                        : s.template === "cta"
                          ? "CTA"
                          : s.template[0].toUpperCase(),
                    )
                    .join(" → ")}
                </span>
              </button>
            ))}
            <button
              onClick={initCustom}
              style={{
                padding: "16px 20px",
                background: "transparent",
                border: `1px dashed ${C.grey}`,
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: C.callout,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.red;
                e.currentTarget.style.color = C.red;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.grey;
                e.currentTarget.style.color = C.callout;
              }}
            >
              Custom — start from scratch (Cover + CTA, add slides manually)
            </button>
          </div>

          <div
            style={{
              marginTop: 32,
              padding: "12px 16px",
              background: "rgba(200,50,50,0.04)",
              border: "1px solid rgba(200,50,50,0.15)",
              borderRadius: 3,
            }}
          >
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: C.red,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              RULES: 6–12 slides · Cover always first · CTA always last · No
              images · No custom colors · 7 templates only
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentSlide = slides[selectedIdx];
  const templateDef = TEMPLATES[currentSlide.template];
  const showSlideNum = !["cover", "cta", "punchline"].includes(
    currentSlide.template,
  );

  // ─── PREVIEW MODE ───
  if (previewMode) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.dark,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: 24,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 24,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={() => setPreviewMode(false)}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: `1px solid ${C.grey}`,
              borderRadius: 3,
              color: C.paper,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ← Back to Editor
          </button>
        </div>
        <SlideCanvas
          template={slides[selectedIdx].template}
          data={slides[selectedIdx].data}
          slideNum={
            !["cover", "cta", "punchline"].includes(
              slides[selectedIdx].template,
            )
              ? selectedIdx + 1
              : null
          }
          size={Math.min(640, window.innerWidth - 48)}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 24,
            alignItems: "center",
          }}
        >
          <button
            disabled={selectedIdx === 0}
            onClick={() => setSelectedIdx(selectedIdx - 1)}
            style={{
              padding: "8px 20px",
              background: selectedIdx === 0 ? "transparent" : C.paper,
              border: "none",
              borderRadius: 3,
              cursor: selectedIdx === 0 ? "default" : "pointer",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: selectedIdx === 0 ? C.grey : C.ink,
              opacity: selectedIdx === 0 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              color: C.grey,
              padding: "8px 12px",
            }}
          >
            {selectedIdx + 1} / {slides.length}
          </span>
          <button
            disabled={selectedIdx === slides.length - 1}
            onClick={() => setSelectedIdx(selectedIdx + 1)}
            style={{
              padding: "8px 20px",
              background:
                selectedIdx === slides.length - 1 ? "transparent" : C.paper,
              border: "none",
              borderRadius: 3,
              cursor: selectedIdx === slides.length - 1 ? "default" : "pointer",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: selectedIdx === slides.length - 1 ? C.grey : C.ink,
              opacity: selectedIdx === slides.length - 1 ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
        {/* Thumbnail strip */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            overflowX: "auto",
            maxWidth: "100%",
            padding: "4px 0",
          }}
        >
          {slides.map((s, i) => (
            <div
              key={i}
              onClick={() => setSelectedIdx(i)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 2,
                cursor: "pointer",
                border:
                  i === selectedIdx
                    ? `2px solid ${C.red}`
                    : `1px solid ${C.callout}`,
                opacity: i === selectedIdx ? 1 : 0.5,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <SlideCanvas
                template={s.template}
                data={s.data}
                slideNum={null}
                size={48}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── EDITOR MODE ───
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hidden font primers — force browser to download all font faces */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "'Newsreader', serif",
            fontWeight: 400,
            fontStyle: "normal",
          }}
        >
          x
        </span>
        <span
          style={{
            fontFamily: "'Newsreader', serif",
            fontWeight: 500,
            fontStyle: "normal",
          }}
        >
          x
        </span>
        <span
          style={{
            fontFamily: "'Newsreader', serif",
            fontWeight: 600,
            fontStyle: "normal",
          }}
        >
          x
        </span>
        <span
          style={{
            fontFamily: "'Newsreader', serif",
            fontWeight: 400,
            fontStyle: "italic",
          }}
        >
          x
        </span>
        <span
          style={{
            fontFamily: "'Newsreader', serif",
            fontWeight: 500,
            fontStyle: "italic",
          }}
        >
          x
        </span>
        <span
          style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 400 }}
        >
          x
        </span>
        <span
          style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 700 }}
        >
          x
        </span>
        <span
          style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 800 }}
        >
          x
        </span>
        <span
          style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 900 }}
        >
          x
        </span>
        <span
          style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400 }}
        >
          x
        </span>
        <span
          style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
        >
          x
        </span>
      </div>
      {/* Top bar */}
      <div
        style={{
          background: C.ink,
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 900,
              fontSize: 18,
              color: C.paper,
              letterSpacing: "-0.04em",
            }}
          >
            TIGHT MARGINS
          </span>
          <span
            style={{
              width: 1,
              height: 20,
              background: C.callout,
              opacity: 0.3,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: C.grey,
            }}
          >
            {slides.length} slides
          </span>
          {(slides.length < 6 || slides.length > 12) && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: C.red,
              }}
            >
              ⚠ Need{" "}
              {slides.length < 6
                ? `${6 - slides.length} more`
                : `${slides.length - 12} fewer`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => {
              setSlides(null);
              setSelectedIdx(0);
            }}
            style={{
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${C.callout}`,
              borderRadius: 3,
              color: C.grey,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 500,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            New
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            style={{
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${C.grey}`,
              borderRadius: 3,
              color: C.paper,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Preview
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || slides.length < 6 || slides.length > 12}
            style={{
              padding: "6px 16px",
              background: C.red,
              border: "none",
              borderRadius: 3,
              color: C.paper,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              cursor:
                slides.length < 6 || slides.length > 12
                  ? "not-allowed"
                  : "pointer",
              opacity: slides.length < 6 || slides.length > 12 ? 0.4 : 1,
            }}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left: Slide list */}
        <div
          style={{
            width: 200,
            borderRight: `1px solid ${C.grey}`,
            padding: "12px 0",
            overflowY: "auto",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          {slides.map((s, i) => (
            <div
              key={i}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background:
                  i === selectedIdx ? "rgba(200,50,50,0.06)" : "transparent",
                borderLeft:
                  i === selectedIdx
                    ? `3px solid ${C.red}`
                    : "3px solid transparent",
                transition: "all 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: C.red,
                    flexShrink: 0,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontWeight: 600,
                    fontSize: 12,
                    color: C.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {TEMPLATES[s.template].name}
                </span>
                {s.locked && <span style={{ fontSize: 9 }}>🔒</span>}
              </div>
              {s.note && (
                <div
                  style={{
                    fontFamily: "'Newsreader', serif",
                    fontSize: 11,
                    color: C.callout,
                    marginTop: 2,
                    marginLeft: 22,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.note}
                </div>
              )}
            </div>
          ))}
          {slides.length < 12 && (
            <button
              onClick={() => addSlide(slides.length - 2)}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderTop: `1px solid ${C.grey}`,
                cursor: "pointer",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                color: C.callout,
                textAlign: "left",
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = C.red;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = C.callout;
              }}
            >
              + Add Slide
            </button>
          )}
        </div>

        {/* Center: Canvas preview */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e8e5e2",
            padding: 24,
            minWidth: 0,
          }}
        >
          <SlideCanvas
            template={currentSlide.template}
            data={currentSlide.data}
            slideNum={showSlideNum ? selectedIdx + 1 : null}
            size={canvasSize}
          />
        </div>

        {/* Right: Editor panel */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${C.grey}`,
            padding: 20,
            overflowY: "auto",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: `1px solid ${C.grey}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  color: C.ink,
                }}
              >
                Slide {selectedIdx + 1}: {TEMPLATES[currentSlide.template].name}
              </span>
            </div>
            {!currentSlide.locked ? (
              <select
                value={currentSlide.template}
                onChange={(e) => changeTemplate(selectedIdx, e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: C.ink,
                  border: `1px solid ${C.grey}`,
                  borderRadius: 3,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {Object.entries(TEMPLATES)
                  .filter(([k]) => k !== "cover" && k !== "cta")
                  .map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.name}
                    </option>
                  ))}
              </select>
            ) : (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.grey,
                }}
              >
                Position locked —{" "}
                {currentSlide.template === "cover"
                  ? "always first"
                  : "always last"}
              </span>
            )}
          </div>

          {templateDef.fields.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={currentSlide.data[field.key]}
              onChange={(val) => updateSlideData(selectedIdx, field.key, val)}
            />
          ))}

          {!currentSlide.locked && (
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${C.grey}`,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => moveSlide(selectedIdx, -1)}
                disabled={selectedIdx <= 1}
                style={{
                  padding: "6px 10px",
                  background: "transparent",
                  border: `1px solid ${C.grey}`,
                  borderRadius: 3,
                  cursor: selectedIdx <= 1 ? "not-allowed" : "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.callout,
                  opacity: selectedIdx <= 1 ? 0.4 : 1,
                }}
              >
                ↑ Move up
              </button>
              <button
                onClick={() => moveSlide(selectedIdx, 1)}
                disabled={selectedIdx >= slides.length - 2}
                style={{
                  padding: "6px 10px",
                  background: "transparent",
                  border: `1px solid ${C.grey}`,
                  borderRadius: 3,
                  cursor:
                    selectedIdx >= slides.length - 2
                      ? "not-allowed"
                      : "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.callout,
                  opacity: selectedIdx >= slides.length - 2 ? 0.4 : 1,
                }}
              >
                ↓ Move down
              </button>
              <button
                onClick={() => addSlide(selectedIdx)}
                disabled={slides.length >= 12}
                style={{
                  padding: "6px 10px",
                  background: "transparent",
                  border: `1px solid ${C.grey}`,
                  borderRadius: 3,
                  cursor: slides.length >= 12 ? "not-allowed" : "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.callout,
                  opacity: slides.length >= 12 ? 0.4 : 1,
                }}
              >
                + Insert after
              </button>
              <button
                onClick={() => removeSlide(selectedIdx)}
                disabled={slides.length <= 6}
                style={{
                  padding: "6px 10px",
                  background: "transparent",
                  border: `1px solid ${C.red}`,
                  borderRadius: 3,
                  cursor: slides.length <= 6 ? "not-allowed" : "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.red,
                  opacity: slides.length <= 6 ? 0.4 : 1,
                }}
              >
                ✕ Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
