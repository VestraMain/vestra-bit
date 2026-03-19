import { T, type Locale } from "./strings";

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
  darkText: "#1B3560",
  mutedText: "#64748B",
};

// ── Page geometry ─────────────────────────────────────────────────────────────
const PAGE = { width: 612, height: 792, margin: 36 };
const BODY_W = PAGE.width - PAGE.margin * 2;
const LEFT_W = Math.round(BODY_W * 0.6);
const RIGHT_W = BODY_W - LEFT_W - 2;
const DIVIDER_X = PAGE.margin + LEFT_W + 1;
const RIGHT_X = DIVIDER_X + 1;

// ── eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildBriefPDF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  projectTitle: string,
  locale: Locale = "en"
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require("pdfkit");
  const S = T[locale];
  // Spanish strings are ~15% longer — expand row heights slightly
  const rowScale = locale === "es" ? 1.15 : 1.0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Drawing helpers ───────────────────────────────────────────────────────
    function fillRect(x: number, y: number, w: number, h: number, color: string) {
      doc.rect(x, y, w, h).fill(color);
    }

    function txt(
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
         .fontSize(fontSize).fillColor(color);
      const tOpts: Record<string, unknown> = { align, lineGap };
      if (width !== undefined) tOpts.width = width;
      doc.text(str, x, y, tOpts);
    }

    function nullTxt(x: number, y: number, width?: number, short = false) {
      txt(short ? S.nullShort : S.nullFull, x, y,
        { color: C.orange, italic: true, width, fontSize: 7.5 });
    }

    function textH(str: string, width: number, fontSize = 8, bold = false): number {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
      return doc.heightOfString(str, { width });
    }

    function sectionHeader(label: string, x: number, y: number, w: number): number {
      const H = Math.round(14 * rowScale);
      fillRect(x, y, w, H, C.navy);
      txt(label.toUpperCase(), x + 4, y + Math.round(H * 0.22),
        { color: C.white, fontSize: 7, bold: true, width: w - 8 });
      return y + H + 3;
    }

    function safeVal(v: unknown): { text: string; isNull: boolean } {
      if (v === null || v === undefined || v === "") return { text: S.nullFull, isNull: true };
      return { text: String(v), isNull: false };
    }

    function kvRow(
      key: string, value: string | null,
      x: number, y: number, w: number,
      highlightBg?: string
    ): number {
      const leftW = Math.round(w * 0.38);
      const rightW = w - leftW;
      const { text: vText, isNull: vNull } = safeVal(value);
      const baseH = Math.max(
        Math.round(14 * rowScale),
        textH(key, leftW - 4, 7.5) + 4,
        textH(vText, rightW - 4, 7.5) + 4
      );
      if (highlightBg) fillRect(x, y, w, baseH, highlightBg);
      else if ((y - PAGE.margin) % 16 < 8) fillRect(x, y, w, baseH, C.lightGray);
      txt(key, x + 3, y + 3, { color: C.navy, fontSize: 7.5, bold: true, width: leftW - 6 });
      if (vNull) nullTxt(x + leftW + 2, y + 3, rightW - 4);
      else txt(vText, x + leftW + 2, y + 3, { color: C.darkText, fontSize: 7.5, width: rightW - 4 });
      return y + baseH;
    }

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    {
      // Header bar
      fillRect(0, 0, PAGE.width, 40, C.navy);
      txt("Vestra BIT", PAGE.margin, 14, { color: C.white, fontSize: 16, bold: true });
      doc.font("Helvetica").fontSize(8).fillColor(C.white);
      doc.text(projectTitle, PAGE.width - PAGE.margin - 260, 12,
        { width: 260, align: "right", lineGap: 1 });

      // Dual rule
      fillRect(0, 40, PAGE.width, 3, C.navy);
      fillRect(0, 43, PAGE.width, 2, C.orange);

      // 4-stat banner
      const BANNER_Y = 45;
      const BANNER_H = 46;
      fillRect(0, BANNER_Y, PAGE.width, BANNER_H, C.navy);
      const stats = [
        { label: S.contractValue,    value: safeVal(data.estimated_value) },
        { label: S.bidDeadlineLabel, value: safeVal(data.bid_deadline) },
        { label: S.paymentTermsLabel, value: safeVal(data.payment_terms) },
        { label: S.contractTypeLabel, value: safeVal(data.contract_type) },
      ];
      const statW = PAGE.width / 4;
      stats.forEach((s, i) => {
        const sx = i * statW;
        if (i > 0) fillRect(sx, BANNER_Y + 8, 1, BANNER_H - 16, C.lightBlue);
        const { text: vt, isNull: vn } = s.value;
        txt(vt.length > 22 ? vt.slice(0, 22) + "…" : vt, sx + 4, BANNER_Y + 7,
          { color: C.orange, italic: vn, fontSize: vn ? 8 : 11, bold: !vn,
            width: statW - 8, align: "center" });
        txt(s.label, sx + 4, BANNER_Y + 26,
          { color: C.lightBlue, fontSize: 6.5, width: statW - 8, align: "center" });
      });

      const BODY_Y = BANNER_Y + BANNER_H + 6;
      const FOOTER_Y = PAGE.height - 28;
      const bodyH = FOOTER_Y - BODY_Y;
      fillRect(DIVIDER_X, BODY_Y, 2, bodyH, C.orange);

      // ── LEFT COLUMN ────────────────────────────────────────────────────────
      let ly = BODY_Y;
      const lx = PAGE.margin;
      const lw = LEFT_W;

      ly = sectionHeader(S.projectOverview, lx, ly, lw);
      ([
        [S.owner,       data.owner],
        [S.bidNumber,   data.bid_number],
        [S.naics,       data.naics_code],
        [S.contractType, data.contract_type],
        [S.sbeGoal,     data.sbe_goal],
        [S.siteAddress, data.site_address],
      ] as [string, string | null][]).forEach(([k, v]) => { ly = kvRow(k, v, lx, ly, lw); });
      ly += 5;

      ly = sectionHeader(S.scopeOfWork, lx, ly, lw);
      const workItems: Array<{ name?: string | null; scope_summary?: string | null }> =
        Array.isArray(data.work_items) ? data.work_items : [];
      if (workItems.length === 0) {
        nullTxt(lx + 3, ly + 2, lw - 6); ly += 16;
      } else {
        workItems.forEach((wi, i) => {
          if (ly + 12 >= FOOTER_Y) return;
          const nv = safeVal(wi.name);
          const sv = safeVal(wi.scope_summary);
          txt(`${i + 1}. ${nv.text}`, lx + 3, ly + 2,
            { color: C.navy, bold: true, fontSize: 7.5, width: lw - 6 });
          ly += textH(nv.text, lw - 12, 7.5, true) + 4;
          if (sv.isNull) { nullTxt(lx + 10, ly, lw - 14); ly += 12; }
          else { const h = textH(sv.text, lw - 14, 7.5);
            txt(sv.text, lx + 10, ly, { fontSize: 7.5, width: lw - 14 }); ly += h + 4; }
        });
      }
      ly += 4;

      ly = sectionHeader(S.bidderRequirements, lx, ly, lw);
      txt(S.licensing, lx + 3, ly + 2, { bold: true, fontSize: 7, color: C.navy, width: lw - 6 });
      ly += Math.round(12 * rowScale);
      const licV = safeVal(data.licensing_requirements);
      if (licV.isNull) { nullTxt(lx + 6, ly, lw - 10); ly += 12; }
      else { const h = textH(licV.text, lw - 10, 7.5);
        txt(licV.text, lx + 6, ly, { fontSize: 7.5, width: lw - 10 }); ly += h + 4; }

      txt(S.insurance, lx + 3, ly + 2, { bold: true, fontSize: 7, color: C.navy, width: lw - 6 });
      ly += Math.round(12 * rowScale);
      const insItems: Array<{ type?: string | null; minimum?: string | null }> =
        Array.isArray(data.insurance_requirements) ? data.insurance_requirements : [];
      if (insItems.length === 0) { nullTxt(lx + 6, ly, lw - 10); ly += 12; }
      else {
        const iLW = Math.round((lw - 6) * 0.6);
        const iRW = lw - 6 - iLW;
        fillRect(lx + 3, ly, lw - 6, 12, C.navy);
        txt(S.insType, lx + 5, ly + 2, { color: C.white, fontSize: 7, bold: true, width: iLW });
        txt(S.insMinimum, lx + 5 + iLW, ly + 2, { color: C.white, fontSize: 7, bold: true, width: iRW });
        ly += 12;
        insItems.forEach((ins, i) => {
          const rh = Math.round(12 * rowScale);
          fillRect(lx + 3, ly, lw - 6, rh, i % 2 === 0 ? C.white : C.lightGray);
          const tv = safeVal(ins.type); const mv = safeVal(ins.minimum);
          if (tv.isNull) nullTxt(lx + 5, ly + 2, iLW);
          else txt(tv.text, lx + 5, ly + 2, { fontSize: 7, width: iLW });
          if (mv.isNull) nullTxt(lx + 5 + iLW, ly + 2, iRW);
          else txt(mv.text, lx + 5 + iLW, ly + 2, { fontSize: 7, width: iRW });
          ly += rh;
        });
      }
      ly += 4;

      if (ly + 40 < FOOTER_Y) {
        ly = sectionHeader(S.submissionRequirements, lx, ly, lw);
        const subV = safeVal(data.submission_forms_required);
        if (subV.isNull) { nullTxt(lx + 3, ly + 2, lw - 6); ly += 14; }
        else { const h = textH(subV.text, lw - 8, 7.5);
          txt(subV.text, lx + 3, ly + 2, { fontSize: 7.5, width: lw - 8 }); ly += h + 6; }
        ly += 2;
      }

      if (ly + 60 < FOOTER_Y) {
        ly = sectionHeader(S.glossary, lx, ly, lw);
        S.glossaryItems.forEach((g, i) => {
          if (ly + 18 >= FOOTER_Y) return;
          const defH = Math.max(Math.round(14 * rowScale), textH(g.def, lw - 82, 7) + 4);
          fillRect(lx, ly, lw, defH, i % 2 === 0 ? C.white : C.lightGray);
          txt(g.term, lx + 3, ly + 3, { bold: true, fontSize: 7, color: C.navy, width: 72 });
          txt(g.def, lx + 78, ly + 3, { fontSize: 7, color: C.mutedText, width: lw - 82 });
          ly += defH;
        });
      }

      // ── RIGHT COLUMN ───────────────────────────────────────────────────────
      let ry = BODY_Y;
      const rx = RIGHT_X;
      const rw = RIGHT_W;

      ry = sectionHeader(S.keyDates, rx, ry, rw);
      ([
        [S.bidDeadlineRow,       data.bid_deadline,       true],
        [S.preBidMeeting,        data.prebid_meeting_date,  false],
        [S.questionsDue,         data.questions_deadline,  false],
        [S.addendumDate,         data.addendum_date,       false],
        [S.constructionStart,    data.construction_start,  false],
        [S.substantialCompletion, data.substantial_completion, false],
        [S.finalCompletion,      data.final_completion,    false],
      ] as [string, string | null, boolean][]).forEach(([k, v, hl]) => {
        const rv = safeVal(v);
        const rowH = Math.round(14 * rowScale);
        const bg = hl ? C.orange : (ry % 20 < 10 ? C.lightGray : C.white);
        fillRect(rx, ry, rw, rowH, bg);
        txt(k, rx + 3, ry + 3,
          { bold: true, fontSize: 7, color: hl ? C.white : C.navy, width: Math.round(rw * 0.52) });
        if (rv.isNull) txt(S.nullShort, rx + Math.round(rw * 0.54), ry + 3,
          { color: hl ? C.white : C.orange, italic: true, fontSize: 7, width: Math.round(rw * 0.44) });
        else txt(rv.text, rx + Math.round(rw * 0.54), ry + 3,
          { color: hl ? C.white : C.darkText, fontSize: 7, width: Math.round(rw * 0.44) });
        ry += rowH;
      });
      ry += 5;

      ry = sectionHeader(S.opportunityRisk, rx, ry, rw);
      fillRect(rx, ry, rw, 4, C.green);
      fillRect(rx, ry + 4, rw, 30, "#E8F5F0");
      txt(S.opportunityLabel, rx + 4, ry + 6, { color: C.green, fontSize: 6.5, bold: true, width: rw - 8 });
      S.opportunityPoints.forEach((pt, i) => {
        txt(`• ${pt}`, rx + 4, ry + 14 + i * 9, { fontSize: 6.5, color: C.darkText, width: rw - 8 });
      });
      ry += 38;
      fillRect(rx, ry, rw, 4, C.orange);
      fillRect(rx, ry + 4, rw, 30, "#FEF3F0");
      txt(S.riskLabel, rx + 4, ry + 6, { color: C.orange, fontSize: 6.5, bold: true, width: rw - 8 });
      S.riskPoints.forEach((pt, i) => {
        txt(`• ${pt}`, rx + 4, ry + 14 + i * 9, { fontSize: 6.5, color: C.darkText, width: rw - 8 });
      });
      ry += 38;
      ry += 4;

      ry = sectionHeader(S.whatVestraHandles, rx, ry, rw);
      S.handlesItems.forEach((h) => {
        if (ry + 11 >= FOOTER_Y) return;
        txt("✓  " + h, rx + 3, ry + 2, { color: C.green, fontSize: 7, width: rw - 6 });
        ry += Math.round(11 * rowScale);
      });
      ry += 4;

      if (ry + 38 <= FOOTER_Y) {
        fillRect(rx, ry, rw, 38, C.navy);
        txt(S.ctaTitle, rx + 4, ry + 6,
          { color: C.white, bold: true, fontSize: 8, width: rw - 8, align: "center" });
        txt(S.ctaWebsite, rx + 4, ry + 20,
          { color: C.orange, bold: true, fontSize: 8, width: rw - 8, align: "center" });
        txt(S.ctaTagline, rx + 4, ry + 30,
          { color: C.lightBlue, fontSize: 6.5, width: rw - 8, align: "center" });
      }

      // Footer
      fillRect(0, FOOTER_Y, PAGE.width, 1, C.orange);
      fillRect(0, FOOTER_Y + 1, PAGE.width, 27, C.navy);
      txt(S.footerBrand, PAGE.margin, FOOTER_Y + 9, { color: C.white, fontSize: 7 });
      txt(S.page1, PAGE.width - PAGE.margin - 30, FOOTER_Y + 9, { color: C.white, fontSize: 7 });
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    doc.addPage({ size: "LETTER", margin: 0 });
    {
      fillRect(0, 0, PAGE.width, 40, C.accent);
      txt("Vestra BIT", PAGE.margin, 14, { color: C.navy, fontSize: 14, bold: true });
      txt(S.p2HeaderRight, PAGE.width - PAGE.margin - 280, 14,
        { color: C.navy, fontSize: 9, width: 280, align: "right" });
      fillRect(0, 40, PAGE.width, 2, C.orange);

      const BODY_Y2 = 44;
      const FOOTER_Y2 = PAGE.height - 28;
      const bodyH2 = FOOTER_Y2 - BODY_Y2;
      fillRect(DIVIDER_X, BODY_Y2, 2, bodyH2, C.orange);

      // ── LEFT: Spec tables ─────────────────────────────────────────────────
      let ly = BODY_Y2 + 4;
      const lx = PAGE.margin;
      const lw = LEFT_W;

      const workItems2: Array<{
        name?: string | null; scope_summary?: string | null;
        materials?: string | null; dimensions_quantities?: string | null;
        special_requirements?: string | null;
      }> = Array.isArray(data.work_items) ? data.work_items : [];

      if (workItems2.length === 0) {
        ly = sectionHeader(S.workItemSpecsDefault, lx, ly, lw);
        nullTxt(lx + 3, ly + 2, lw - 6); ly += 14;
      } else {
        workItems2.forEach((wi, wi_i) => {
          if (ly + 20 >= FOOTER_Y2) return;
          const nv = safeVal(wi.name);
          ly = sectionHeader(S.workItemLabel(wi_i + 1, nv.isNull ? "—" : nv.text), lx, ly, lw);

          const col1 = Math.round(lw * 0.30);
          const col2 = Math.round(lw * 0.50);
          const col3 = lw - col1 - col2;

          fillRect(lx, ly, lw, 12, C.navy);
          txt(S.specCol, lx + 2, ly + 2, { color: C.white, fontSize: 6.5, bold: true, width: col1 });
          txt(S.valueCol, lx + col1 + 2, ly + 2, { color: C.white, fontSize: 6.5, bold: true, width: col2 });
          txt(S.sourceCol, lx + col1 + col2 + 2, ly + 2, { color: C.white, fontSize: 6.5, bold: true, width: col3 });
          ly += 12;

          ([
            [S.scopeSummaryRow, wi.scope_summary ?? null],
            [S.materialsRow, wi.materials ?? null],
            [S.dimensionsRow, wi.dimensions_quantities ?? null],
            [S.specialReqRow, wi.special_requirements ?? null],
          ] as [string, string | null][]).forEach(([specLabel, specVal], si) => {
            if (ly + 10 >= FOOTER_Y2) return;
            const sv = safeVal(specVal);
            const rowH = Math.max(Math.round(12 * rowScale), textH(sv.text, col2 - 4, 7) + 4);
            fillRect(lx, ly, lw, rowH, si % 2 === 0 ? C.white : C.lightGray);
            txt(specLabel, lx + 2, ly + 2, { bold: true, fontSize: 7, color: C.navy, width: col1 - 4 });
            if (sv.isNull) nullTxt(lx + col1 + 2, ly + 2, col2 - 4);
            else txt(sv.text, lx + col1 + 2, ly + 2, { fontSize: 7, width: col2 - 4 });
            txt(S.rfpDocs, lx + col1 + col2 + 2, ly + 2,
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

      ry = sectionHeader(S.capabilityAssessment, rx, ry, rw);
      const itemW = rw - 120;
      const statW = 120;

      fillRect(rx, ry, rw, 12, C.navy);
      txt(S.itemCol, rx + 3, ry + 2, { color: C.white, fontSize: 6.5, bold: true, width: itemW });
      txt(S.statusCol, rx + itemW + 3, ry + 2, { color: C.white, fontSize: 6.5, bold: true, width: statW - 6 });
      ry += 12;

      let lastCat = "";
      S.capabilityItems.forEach((ci, i) => {
        if (ry + 10 >= FOOTER_Y2 - 80) return;
        if (ci.cat !== lastCat) {
          fillRect(rx, ry, rw, 10, C.accent);
          txt(ci.cat.toUpperCase(), rx + 3, ry + 2,
            { color: C.navy, fontSize: 6, bold: true, width: rw - 6 });
          ry += 10;
          lastCat = ci.cat;
        }
        const rowH = Math.round(11 * rowScale);
        fillRect(rx, ry, rw, rowH, i % 2 === 0 ? C.white : C.lightGray);
        txt(ci.item, rx + 3, ry + 2, { fontSize: 6.5, color: C.darkText, width: itemW - 4 });
        const isReq = ci.status === "Required" || ci.status === "Requerido";
        txt(ci.status, rx + itemW + 3, ry + 2,
          { fontSize: 6.5, color: isReq ? C.navy : C.amber, bold: isReq, width: statW - 6 });
        ry += rowH;
      });
      ry += 6;

      if (ry + 60 <= FOOTER_Y2) {
        ry = sectionHeader(S.decisionGuide, rx, ry, rw);
        [
          { color: C.green,   label: S.tierBid,    desc: S.tierBidDesc },
          { color: C.amber,   label: S.tierReview, desc: S.tierReviewDesc },
          { color: "#DC2626", label: S.tierPass,   desc: S.tierPassDesc },
        ].forEach((t) => {
          if (ry + 16 >= FOOTER_Y2) return;
          const rh = Math.round(16 * rowScale);
          fillRect(rx, ry, rw, rh, t.color + "22");
          fillRect(rx, ry, 30, rh, t.color);
          txt(t.label, rx + 2, ry + Math.round(rh * 0.28),
            { color: C.white, bold: true, fontSize: 6.5, width: 26, align: "center" });
          txt(t.desc, rx + 34, ry + Math.round(rh * 0.28),
            { fontSize: 7, color: C.darkText, width: rw - 38 });
          ry += rh + 2;
        });
        ry += 4;
      }

      if (ry + 38 <= FOOTER_Y2) {
        fillRect(rx, ry, rw, 38, C.navy);
        txt(S.ctaReadyTitle, rx + 4, ry + 6,
          { color: C.white, bold: true, fontSize: 9, width: rw - 8, align: "center" });
        txt(S.ctaWebsite, rx + 4, ry + 20,
          { color: C.orange, bold: true, fontSize: 8, width: rw - 8, align: "center" });
        txt(S.ctaVestraLine, rx + 4, ry + 30,
          { color: C.lightBlue, fontSize: 6.5, width: rw - 8, align: "center" });
      }

      fillRect(0, FOOTER_Y2, PAGE.width, 1, C.orange);
      fillRect(0, FOOTER_Y2 + 1, PAGE.width, 27, C.navy);
      txt(S.footerBrand, PAGE.margin, FOOTER_Y2 + 9, { color: C.white, fontSize: 7 });
      txt(S.page2of2, PAGE.width - PAGE.margin - 50, FOOTER_Y2 + 9, { color: C.white, fontSize: 7 });
    }

    doc.end();
  });
}
