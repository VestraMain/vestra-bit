import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 120;

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  navy: "#1B3560",
  orange: "#E05738",
  green: "#1D9E75",
  lightGray: "#F2F4F8",
  accent: "#EBF0FA",
  white: "#FFFFFF",
  lightBlue: "#8BA3C7",
  amber: "#D97706",
  red: "#DC2626",
  darkText: "#1B3560",
  mutedText: "#64748B",
};

// ── Page geometry ─────────────────────────────────────────────────────────────
const PAGE = { width: 612, height: 792, margin: 36 };
const BODY_W = PAGE.width - PAGE.margin * 2; // 540
const LEFT_W = Math.round(BODY_W * 0.6); // 324
const RIGHT_W = BODY_W - LEFT_W - 2; // 214
const DIVIDER_X = PAGE.margin + LEFT_W + 1;
const RIGHT_X = DIVIDER_X + 1;

// ── Glossary terms ─────────────────────────────────────────────────────────────
const GLOSSARY = [
  { term: "IFB / RFP", def: "Invitation for Bids / Request for Proposals — the owner's solicitation document." },
  { term: "SBE Goal", def: "Small Business Enterprise participation target set by the owner." },
  { term: "Bid Bond", def: "Security deposit guaranteeing you will sign the contract if awarded." },
  { term: "Liquidated Damages", def: "Pre-set daily penalty for failing to complete work on time." },
  { term: "Substantial Completion", def: "Point where the owner can occupy/use the project for its intended purpose." },
];

// ── Capability checklist ──────────────────────────────────────────────────────
const CAPABILITY_ITEMS = [
  // Category: Licensing & Legal
  { cat: "Licensing & Legal", item: "Valid contractor licence in jurisdiction", status: "Required" },
  { cat: "Licensing & Legal", item: "WSIB / insurance certificates on file", status: "Required" },
  { cat: "Licensing & Legal", item: "Bid bond capacity confirmed with surety", status: "Required" },
  { cat: "Licensing & Legal", item: "Performance/payment bond capacity", status: "Required" },
  // Category: Technical
  { cat: "Technical", item: "Experience with specified work type", status: "Required" },
  { cat: "Technical", item: "Qualified site superintendent available", status: "Required" },
  { cat: "Technical", item: "Subcontractors identified for spec trades", status: "Strongly Recommended" },
  { cat: "Technical", item: "Safety program meets owner requirements", status: "Required" },
  { cat: "Technical", item: "Quality control plan in place", status: "Strongly Recommended" },
  { cat: "Technical", item: "Equipment & tools for scope available", status: "Strongly Recommended" },
  // Category: Commercial
  { cat: "Commercial", item: "Can meet SBE participation goal", status: "Strongly Recommended" },
  { cat: "Commercial", item: "Mobilization capacity within schedule", status: "Required" },
  { cat: "Commercial", item: "Cash flow for payment terms acceptable", status: "Required" },
  { cat: "Commercial", item: "References available (3 similar projects)", status: "Strongly Recommended" },
  { cat: "Commercial", item: "Submission forms ready / can be prepared", status: "Required" },
  { cat: "Commercial", item: "Addenda reviewed and acknowledged", status: "Required" },
  { cat: "Commercial", item: "Site visit completed or planned", status: "Strongly Recommended" },
  { cat: "Commercial", item: "Clarification questions submitted on time", status: "Strongly Recommended" },
];

// ── Supabase client ────────────────────────────────────────────────────────────
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

// ── Helper: null-safe value → "[ See source documents ]" ─────────────────────
function val(v: unknown): { text: string; isNull: boolean } {
  if (v === null || v === undefined || v === "") return { text: "[ See source documents ]", isNull: true };
  return { text: String(v), isNull: false };
}

// ── PDFKit builder ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPDF(data: Record<string, any>, projectTitle: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require("pdfkit");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const hex = (color: string) => color;

    function fillRect(x: number, y: number, w: number, h: number, color: string) {
      doc.rect(x, y, w, h).fill(hex(color));
    }

    function text(
      str: string,
      x: number,
      y: number,
      opts: {
        color?: string; fontSize?: number; bold?: boolean; italic?: boolean;
        width?: number; align?: "left" | "right" | "center"; lineGap?: number;
      } = {}
    ) {
      const { color = C.darkText, fontSize = 8, bold = false, italic = false,
        width, align = "left", lineGap = 0 } = opts;
      doc.font(bold ? (italic ? "Helvetica-BoldOblique" : "Helvetica-Bold")
               : (italic ? "Helvetica-Oblique" : "Helvetica"))
         .fontSize(fontSize).fillColor(hex(color));
      const tOpts: Record<string, unknown> = { align, lineGap };
      if (width !== undefined) tOpts.width = width;
      doc.text(str, x, y, tOpts);
    }

    function nullText(x: number, y: number, width?: number) {
      text("[ See source documents ]", x, y, { color: C.orange, italic: true, width, fontSize: 7.5 });
    }

    // measure text height
    function textH(str: string, width: number, fontSize = 8, bold = false): number {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
      return doc.heightOfString(str, { width });
    }

    // Section header bar (navy bg, white text)
    function sectionHeader(label: string, x: number, y: number, w: number): number {
      const H = 14;
      fillRect(x, y, w, H, C.navy);
      text(label.toUpperCase(), x + 4, y + 3, { color: C.white, fontSize: 7, bold: true, width: w - 8 });
      return y + H + 3;
    }

    // Key-value row
    function kvRow(key: string, value: string | null, x: number, y: number, w: number,
      isNull = false, highlightBg?: string): number {
      const leftW = Math.round(w * 0.38);
      const rightW = w - leftW;
      const { text: vText, isNull: vNull } = val(value);
      const effectiveNull = isNull || vNull;

      const rowH = Math.max(14,
        textH(key, leftW - 4, 7.5) + 4,
        textH(vText, rightW - 4, 7.5) + 4
      );

      if (highlightBg) fillRect(x, y, w, rowH, highlightBg);
      else if ((y - PAGE.margin) % 16 < 8) fillRect(x, y, w, rowH, C.lightGray);

      text(key, x + 3, y + 3, { color: C.navy, fontSize: 7.5, bold: true, width: leftW - 6 });
      if (effectiveNull) {
        nullText(x + leftW + 2, y + 3, rightW - 4);
      } else {
        text(vText, x + leftW + 2, y + 3, { color: C.darkText, fontSize: 7.5, width: rightW - 4 });
      }
      return y + rowH;
    }

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    {
      // Header bar
      fillRect(0, 0, PAGE.width, 40, C.navy);
      text("Vestra BIT", PAGE.margin, 14, { color: C.white, fontSize: 16, bold: true });
      const bidName = val(projectTitle).text;
      doc.font("Helvetica").fontSize(8).fillColor(C.white);
      const titleW = 260;
      doc.text(bidName, PAGE.width - PAGE.margin - titleW, 12, { width: titleW, align: "right", lineGap: 1 });

      // Dual rule
      fillRect(0, 40, PAGE.width, 3, C.navy);
      fillRect(0, 43, PAGE.width, 2, C.orange);

      // 4-stat banner
      const BANNER_Y = 45;
      const BANNER_H = 46;
      fillRect(0, BANNER_Y, PAGE.width, BANNER_H, C.navy);
      const stats = [
        { label: "CONTRACT VALUE", value: val(data.estimated_value) },
        { label: "BID DEADLINE", value: val(data.bid_deadline) },
        { label: "PAYMENT TERMS", value: val(data.payment_terms) },
        { label: "CONTRACT TYPE", value: val(data.contract_type) },
      ];
      const statW = PAGE.width / 4;
      stats.forEach((s, i) => {
        const sx = i * statW;
        if (i > 0) fillRect(sx, BANNER_Y + 8, 1, BANNER_H - 16, C.lightBlue);
        const { text: vt, isNull: vn } = s.value;
        text(vt.length > 22 ? vt.slice(0, 22) + "…" : vt,
          sx + 4, BANNER_Y + 7,
          { color: vn ? C.orange : C.orange, italic: vn, fontSize: vn ? 8 : 11, bold: !vn, width: statW - 8, align: "center" });
        text(s.label, sx + 4, BANNER_Y + 26, { color: C.lightBlue, fontSize: 6.5, width: statW - 8, align: "center" });
      });

      // Body start
      const BODY_Y = BANNER_Y + BANNER_H + 6;
      const FOOTER_Y = PAGE.height - 28;
      const bodyH = FOOTER_Y - BODY_Y;

      // Orange divider
      fillRect(DIVIDER_X, BODY_Y, 2, bodyH, C.orange);

      // ── LEFT COLUMN ────────────────────────────────────────────────────────
      let ly = BODY_Y;
      const lx = PAGE.margin;
      const lw = LEFT_W;

      // Project Overview
      ly = sectionHeader("Project Overview", lx, ly, lw);
      const overviewRows: [string, string | null][] = [
        ["Owner / Agency", data.owner],
        ["Bid / RFP Number", data.bid_number],
        ["NAICS Code", data.naics_code],
        ["Contract Type", data.contract_type],
        ["SBE Goal", data.sbe_goal],
        ["Site Address", data.site_address],
      ];
      overviewRows.forEach(([k, v]) => { ly = kvRow(k, v, lx, ly, lw); });
      ly += 5;

      // Scope of Work
      ly = sectionHeader("Scope of Work", lx, ly, lw);
      const workItems: Array<{ name?: string | null; scope_summary?: string | null }> =
        Array.isArray(data.work_items) ? data.work_items : [];
      if (workItems.length === 0) {
        nullText(lx + 3, ly + 2, lw - 6); ly += 16;
      } else {
        workItems.forEach((wi, i) => {
          const nameV = val(wi.name);
          const scopeV = val(wi.scope_summary);
          text(`${i + 1}. ${nameV.text}`, lx + 3, ly + 2,
            { color: C.navy, bold: true, fontSize: 7.5, width: lw - 6 });
          ly += textH(nameV.text, lw - 12, 7.5, true) + 4;
          if (scopeV.isNull) { nullText(lx + 10, ly, lw - 14); ly += 12; }
          else {
            const h = textH(scopeV.text, lw - 14, 7.5);
            text(scopeV.text, lx + 10, ly, { fontSize: 7.5, width: lw - 14 });
            ly += h + 4;
          }
        });
      }
      ly += 4;

      // Bidder Requirements
      ly = sectionHeader("Bidder Requirements", lx, ly, lw);
      // Licensing
      text("Licensing:", lx + 3, ly + 2, { bold: true, fontSize: 7, color: C.navy, width: lw - 6 });
      ly += 12;
      const licV = val(data.licensing_requirements);
      if (licV.isNull) { nullText(lx + 6, ly, lw - 10); ly += 12; }
      else {
        const h = textH(licV.text, lw - 10, 7.5);
        text(licV.text, lx + 6, ly, { fontSize: 7.5, width: lw - 10 }); ly += h + 4;
      }

      // Insurance table
      text("Insurance:", lx + 3, ly + 2, { bold: true, fontSize: 7, color: C.navy, width: lw - 6 });
      ly += 12;
      const insItems: Array<{ type?: string | null; minimum?: string | null }> =
        Array.isArray(data.insurance_requirements) ? data.insurance_requirements : [];
      if (insItems.length === 0) { nullText(lx + 6, ly, lw - 10); ly += 12; }
      else {
        const iLeftW = Math.round((lw - 6) * 0.6);
        const iRightW = lw - 6 - iLeftW;
        fillRect(lx + 3, ly, lw - 6, 12, C.navy);
        text("Type", lx + 5, ly + 2, { color: C.white, fontSize: 7, bold: true, width: iLeftW });
        text("Minimum", lx + 5 + iLeftW, ly + 2, { color: C.white, fontSize: 7, bold: true, width: iRightW });
        ly += 12;
        insItems.forEach((ins, i) => {
          const bg = i % 2 === 0 ? C.white : C.lightGray;
          fillRect(lx + 3, ly, lw - 6, 12, bg);
          const tv = val(ins.type); const mv = val(ins.minimum);
          if (tv.isNull) nullText(lx + 5, ly + 2, iLeftW);
          else text(tv.text, lx + 5, ly + 2, { fontSize: 7, width: iLeftW });
          if (mv.isNull) nullText(lx + 5 + iLeftW, ly + 2, iRightW);
          else text(mv.text, lx + 5 + iLeftW, ly + 2, { fontSize: 7, width: iRightW });
          ly += 12;
        });
      }
      ly += 4;

      // Submission Requirements
      if (ly + 40 < FOOTER_Y) {
        ly = sectionHeader("Submission Requirements", lx, ly, lw);
        const subV = val(data.submission_forms_required);
        if (subV.isNull) { nullText(lx + 3, ly + 2, lw - 6); ly += 14; }
        else {
          const h = textH(subV.text, lw - 8, 7.5);
          text(subV.text, lx + 3, ly + 2, { fontSize: 7.5, width: lw - 8 }); ly += h + 6;
        }
        ly += 2;
      }

      // Glossary
      if (ly + 60 < FOOTER_Y) {
        ly = sectionHeader("Glossary of Key Terms", lx, ly, lw);
        GLOSSARY.forEach((g, i) => {
          if (ly + 18 >= FOOTER_Y) return;
          const bg = i % 2 === 0 ? C.white : C.lightGray;
          const defH = Math.max(14, textH(g.def, lw - 82, 7) + 4);
          fillRect(lx, ly, lw, defH, bg);
          text(g.term, lx + 3, ly + 3, { bold: true, fontSize: 7, color: C.navy, width: 72 });
          text(g.def, lx + 78, ly + 3, { fontSize: 7, color: C.mutedText, width: lw - 82 });
          ly += defH;
        });
      }

      // ── RIGHT COLUMN ───────────────────────────────────────────────────────
      let ry = BODY_Y;
      const rx = RIGHT_X;
      const rw = RIGHT_W;

      // Key Dates
      ry = sectionHeader("Key Dates", rx, ry, rw);
      const dateRows: [string, string | null, boolean][] = [
        ["Bid Deadline", data.bid_deadline, true],
        ["Pre-Bid Meeting", data.prebid_meeting_date, false],
        ["Questions Due", data.questions_deadline, false],
        ["Addendum Date", data.addendum_date, false],
        ["Construction Start", data.construction_start, false],
        ["Substantial Completion", data.substantial_completion, false],
        ["Final Completion", data.final_completion, false],
      ];
      dateRows.forEach(([k, v, highlight]) => {
        const rv = val(v);
        const rowH = 14;
        const bg = highlight ? C.orange : (ry % 20 < 10 ? C.lightGray : C.white);
        fillRect(rx, ry, rw, rowH, bg);
        text(k, rx + 3, ry + 3, {
          bold: true, fontSize: 7, color: highlight ? C.white : C.navy, width: Math.round(rw * 0.52)
        });
        if (rv.isNull) {
          text("[ See docs ]", rx + Math.round(rw * 0.54), ry + 3,
            { color: highlight ? C.white : C.orange, italic: true, fontSize: 7, width: Math.round(rw * 0.44) });
        } else {
          text(rv.text, rx + Math.round(rw * 0.54), ry + 3,
            { color: highlight ? C.white : C.darkText, fontSize: 7, width: Math.round(rw * 0.44) });
        }
        ry += rowH;
      });
      ry += 5;

      // Opportunity & Risk
      ry = sectionHeader("Opportunity & Risk", rx, ry, rw);
      // Green opportunity box
      fillRect(rx, ry, rw, 4, C.green);
      fillRect(rx, ry + 4, rw, 28, "#E8F5F0");
      text("OPPORTUNITY", rx + 4, ry + 6, { color: C.green, fontSize: 6.5, bold: true, width: rw - 8 });
      text("• Publicly funded project with defined scope and payment structure",
        rx + 4, ry + 14, { fontSize: 7, color: C.darkText, width: rw - 8 });
      text("• Opportunity to expand regional track record",
        rx + 4, ry + 22, { fontSize: 7, color: C.darkText, width: rw - 8 });
      ry += 36;
      // Orange risk box
      fillRect(rx, ry, rw, 4, C.orange);
      fillRect(rx, ry + 4, rw, 28, "#FEF3F0");
      text("RISK", rx + 4, ry + 6, { color: C.orange, fontSize: 6.5, bold: true, width: rw - 8 });
      text("• Liquidated damages clause — confirm schedule feasibility",
        rx + 4, ry + 14, { fontSize: 7, color: C.darkText, width: rw - 8 });
      text("• SBE requirements may limit subcontractor options",
        rx + 4, ry + 22, { fontSize: 7, color: C.darkText, width: rw - 8 });
      ry += 36;
      ry += 4;

      // What Vestra Handles
      ry = sectionHeader("What Vestra Handles", rx, ry, rw);
      const handles = [
        "Bid document review & compliance check",
        "Scope clarification & questions submission",
        "Subcontractor & supplier coordination",
        "Bid form completion & review",
        "Submission packaging & delivery",
        "Post-award contract support",
      ];
      handles.forEach((h) => {
        if (ry + 11 >= FOOTER_Y) return;
        text("✓  " + h, rx + 3, ry + 2, { color: C.green, fontSize: 7, width: rw - 6 });
        ry += 11;
      });
      ry += 4;

      // Navy CTA
      if (ry + 38 <= FOOTER_Y) {
        fillRect(rx, ry, rw, 38, C.navy);
        text("Schedule a Free Consultation", rx + 4, ry + 6,
          { color: C.white, bold: true, fontSize: 8, width: rw - 8, align: "center" });
        text("www.vestrastrategies.com", rx + 4, ry + 20,
          { color: C.orange, bold: true, fontSize: 8, width: rw - 8, align: "center" });
        text("Bid smarter. Win more.", rx + 4, ry + 30,
          { color: C.lightBlue, fontSize: 6.5, width: rw - 8, align: "center" });
      }

      // Footer P1
      fillRect(0, FOOTER_Y, PAGE.width, 1, C.orange);
      fillRect(0, FOOTER_Y + 1, PAGE.width, 27, C.navy);
      text("Vestra Strategies  |  www.vestrastrategies.com",
        PAGE.margin, FOOTER_Y + 9, { color: C.white, fontSize: 7 });
      text("Page 1", PAGE.width - PAGE.margin - 30, FOOTER_Y + 9, { color: C.white, fontSize: 7 });
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    doc.addPage({ size: "LETTER", margin: 0 });
    {
      // Header (accent background)
      fillRect(0, 0, PAGE.width, 40, C.accent);
      text("Vestra BIT", PAGE.margin, 14, { color: C.navy, fontSize: 14, bold: true });
      text("Project Specifications & Capability Assessment",
        PAGE.width - PAGE.margin - 280, 14,
        { color: C.navy, fontSize: 9, width: 280, align: "right" });
      fillRect(0, 40, PAGE.width, 2, C.orange);

      const BODY_Y2 = 44;
      const FOOTER_Y2 = PAGE.height - 28;
      const bodyH2 = FOOTER_Y2 - BODY_Y2;

      // Orange divider
      fillRect(DIVIDER_X, BODY_Y2, 2, bodyH2, C.orange);

      // ── LEFT: Spec tables ─────────────────────────────────────────────────
      let ly = BODY_Y2 + 4;
      const lx = PAGE.margin;
      const lw = LEFT_W;

      const workItems: Array<{
        name?: string | null; scope_summary?: string | null;
        materials?: string | null; dimensions_quantities?: string | null;
        special_requirements?: string | null;
      }> = Array.isArray(data.work_items) ? data.work_items : [];

      if (workItems.length === 0) {
        ly = sectionHeader("Work Item Specifications", lx, ly, lw);
        nullText(lx + 3, ly + 2, lw - 6); ly += 14;
      } else {
        workItems.forEach((wi, wi_i) => {
          if (ly + 20 >= FOOTER_Y2) return;
          const nameV = val(wi.name);
          ly = sectionHeader(`Work Item ${wi_i + 1}: ${nameV.isNull ? "—" : nameV.text}`, lx, ly, lw);

          // 3-col table: Specification | Value | Source
          const col1 = Math.round(lw * 0.30);
          const col2 = Math.round(lw * 0.50);
          const col3 = lw - col1 - col2;

          // Header
          fillRect(lx, ly, lw, 12, C.navy);
          text("Specification", lx + 2, ly + 2, { color: C.white, fontSize: 6.5, bold: true, width: col1 });
          text("Value", lx + col1 + 2, ly + 2, { color: C.white, fontSize: 6.5, bold: true, width: col2 });
          text("Source", lx + col1 + col2 + 2, ly + 2, { color: C.white, fontSize: 6.5, bold: true, width: col3 });
          ly += 12;

          const specs: [string, string | null][] = [
            ["Scope Summary", wi.scope_summary ?? null],
            ["Materials", wi.materials ?? null],
            ["Dimensions / Qty", wi.dimensions_quantities ?? null],
            ["Special Requirements", wi.special_requirements ?? null],
          ];

          specs.forEach(([specLabel, specVal], si) => {
            if (ly + 10 >= FOOTER_Y2) return;
            const sv = val(specVal);
            const rowH = Math.max(12, textH(sv.text, col2 - 4, 7) + 4);
            fillRect(lx, ly, lw, rowH, si % 2 === 0 ? C.white : C.lightGray);
            text(specLabel, lx + 2, ly + 2, { bold: true, fontSize: 7, color: C.navy, width: col1 - 4 });
            if (sv.isNull) nullText(lx + col1 + 2, ly + 2, col2 - 4);
            else text(sv.text, lx + col1 + 2, ly + 2, { fontSize: 7, width: col2 - 4 });
            text("RFP Docs", lx + col1 + col2 + 2, ly + 2,
              { fontSize: 6.5, color: C.mutedText, italic: true, width: col3 - 2 });
            ly += rowH;
          });
          ly += 6;
        });
      }

      // ── RIGHT: Capability assessment ──────────────────────────────────────
      let ry = BODY_Y2 + 4;
      const rx = RIGHT_X;
      const rw = RIGHT_W;

      ry = sectionHeader("Capability Self-Assessment", rx, ry, rw);

      const itemW = rw - 120;
      const statW = 120;

      // Table header
      fillRect(rx, ry, rw, 12, C.navy);
      text("Item", rx + 3, ry + 2, { color: C.white, fontSize: 6.5, bold: true, width: itemW });
      text("Status", rx + itemW + 3, ry + 2, { color: C.white, fontSize: 6.5, bold: true, width: statW - 6 });
      ry += 12;

      let lastCat = "";
      CAPABILITY_ITEMS.forEach((ci, i) => {
        if (ry + 10 >= FOOTER_Y2 - 80) return;
        if (ci.cat !== lastCat) {
          fillRect(rx, ry, rw, 10, C.accent);
          text(ci.cat.toUpperCase(), rx + 3, ry + 2,
            { color: C.navy, fontSize: 6, bold: true, width: rw - 6 });
          ry += 10;
          lastCat = ci.cat;
        }
        const bg = i % 2 === 0 ? C.white : C.lightGray;
        fillRect(rx, ry, rw, 11, bg);
        text(ci.item, rx + 3, ry + 2, { fontSize: 6.5, color: C.darkText, width: itemW - 4 });
        const isReq = ci.status === "Required";
        text(ci.status, rx + itemW + 3, ry + 2,
          { fontSize: 6.5, color: isReq ? C.navy : C.amber, bold: isReq, width: statW - 6 });
        ry += 11;
      });
      ry += 6;

      // 3-tier Decision Guide
      if (ry + 60 <= FOOTER_Y2) {
        ry = sectionHeader("Decision Guide", rx, ry, rw);
        const tiers = [
          { color: C.green, label: "BID", desc: "Strong match — proceed with submission" },
          { color: C.amber, label: "REVIEW", desc: "Assess capability gaps before committing" },
          { color: "#DC2626", label: "PASS", desc: "Significant capability gap identified" },
        ];
        tiers.forEach((t) => {
          if (ry + 16 >= FOOTER_Y2) return;
          fillRect(rx, ry, rw, 16, t.color + "22");
          fillRect(rx, ry, 28, 16, t.color);
          text(t.label, rx + 2, ry + 5, { color: C.white, bold: true, fontSize: 7, width: 24, align: "center" });
          text(t.desc, rx + 32, ry + 5, { fontSize: 7, color: C.darkText, width: rw - 36 });
          ry += 18;
        });
        ry += 4;
      }

      // Navy CTA p2
      if (ry + 38 <= FOOTER_Y2) {
        fillRect(rx, ry, rw, 38, C.navy);
        text("Ready to Bid?", rx + 4, ry + 6,
          { color: C.white, bold: true, fontSize: 9, width: rw - 8, align: "center" });
        text("www.vestrastrategies.com", rx + 4, ry + 20,
          { color: C.orange, bold: true, fontSize: 8, width: rw - 8, align: "center" });
        text("Vestra Strategies — Bid smarter. Win more.", rx + 4, ry + 30,
          { color: C.lightBlue, fontSize: 6.5, width: rw - 8, align: "center" });
      }

      // Footer P2
      fillRect(0, FOOTER_Y2, PAGE.width, 1, C.orange);
      fillRect(0, FOOTER_Y2 + 1, PAGE.width, 27, C.navy);
      text("Vestra Strategies  |  www.vestrastrategies.com",
        PAGE.margin, FOOTER_Y2 + 9, { color: C.white, fontSize: 7 });
      text("Page 2 of 2", PAGE.width - PAGE.margin - 50, FOOTER_Y2 + 9, { color: C.white, fontSize: 7 });
    }

    doc.end();
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json().catch(() => ({})) as { projectId?: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data: project, error: fetchErr } = await supabase
    .from("projects").select("*").eq("id", projectId).single();
  if (fetchErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Mark generating
  await supabase.from("projects").update({ status: "generating" }).eq("id", projectId);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractedData = (project.extracted_data as Record<string, any>) ?? {};
    const pdfBuffer = await buildPDF(extractedData, project.title ?? "Unnamed Project");

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${projectId}/brief-en.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("project-files")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    // Save output_files + mark complete
    const existingOutputs = (project.output_files as Record<string, string>) ?? {};
    await supabase.from("projects").update({
      status: "complete",
      output_files: { ...existingOutputs, en_pdf: storagePath },
    }).eq("id", projectId);

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    await supabase.from("projects").update({ status: "review" }).eq("id", projectId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
