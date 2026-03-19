// ── Shared locale strings for EN / ES briefs ─────────────────────────────────

export type Locale = "en" | "es";

export const T = {
  en: {
    // Banner stat labels
    contractValue: "CONTRACT VALUE",
    bidDeadlineLabel: "BID DEADLINE",
    paymentTermsLabel: "PAYMENT TERMS",
    contractTypeLabel: "CONTRACT TYPE",

    // Section headers — page 1 left
    projectOverview: "Project Overview",
    scopeOfWork: "Scope of Work",
    bidderRequirements: "Bidder Requirements",
    submissionRequirements: "Submission Requirements",
    glossary: "Glossary of Key Terms",

    // Section headers — page 1 right
    keyDates: "Key Dates",
    opportunityRisk: "Opportunity & Risk",
    whatVestraHandles: "What Vestra Handles",

    // Section headers — page 2
    capabilityAssessment: "Capability Self-Assessment",
    decisionGuide: "Decision Guide",
    workItemLabel: (n: number, name: string) => `Work Item ${n}: ${name}`,
    workItemSpecsDefault: "Work Item Specifications",

    // Overview row labels
    owner: "Owner / Agency",
    bidNumber: "Bid / RFP Number",
    naics: "NAICS Code",
    contractType: "Contract Type",
    sbeGoal: "SBE Goal",
    siteAddress: "Site Address",

    // Requirements sub-labels
    licensing: "Licensing:",
    insurance: "Insurance:",
    insType: "Type",
    insMinimum: "Minimum",

    // Date row labels
    bidDeadlineRow: "Bid Deadline",
    preBidMeeting: "Pre-Bid Meeting",
    questionsDue: "Questions Due",
    addendumDate: "Addendum Date",
    constructionStart: "Construction Start",
    substantialCompletion: "Substantial Completion",
    finalCompletion: "Final Completion",

    // 3-col table headers (page 2)
    specCol: "Specification",
    valueCol: "Value",
    sourceCol: "Source",
    itemCol: "Item",
    statusCol: "Status",

    // Spec row labels
    scopeSummaryRow: "Scope Summary",
    materialsRow: "Materials",
    dimensionsRow: "Dimensions / Qty",
    specialReqRow: "Special Requirements",
    rfpDocs: "RFP Docs",

    // Opportunity & Risk
    opportunityLabel: "OPPORTUNITY",
    opportunityPoints: [
      "Publicly funded project with defined scope and payment structure",
      "Opportunity to expand regional track record",
    ],
    riskLabel: "RISK",
    riskPoints: [
      "Liquidated damages clause — confirm schedule feasibility",
      "SBE requirements may limit subcontractor options",
    ],

    // What Vestra Handles
    handlesItems: [
      "Bid document review & compliance check",
      "Scope clarification & questions submission",
      "Subcontractor & supplier coordination",
      "Bid form completion & review",
      "Submission packaging & delivery",
      "Post-award contract support",
    ],

    // CTA
    ctaTitle: "Schedule a Free Consultation",
    ctaWebsite: "www.vestrastrategies.com",
    ctaTagline: "Bid smarter. Win more.",
    ctaReadyTitle: "Ready to Bid?",
    ctaVestraLine: "Vestra Strategies — Bid smarter. Win more.",

    // Page 2 header right
    p2HeaderRight: "Project Specifications & Capability Assessment",

    // Decision guide tiers
    tierBid: "BID",
    tierBidDesc: "Strong match — proceed with submission",
    tierReview: "REVIEW",
    tierReviewDesc: "Assess capability gaps before committing",
    tierPass: "PASS",
    tierPassDesc: "Significant capability gap identified",

    // Footer
    footerBrand: "Vestra Strategies  |  www.vestrastrategies.com",
    page1: "Page 1",
    page2of2: "Page 2 of 2",

    // Null placeholder
    nullFull: "[ See source documents ]",
    nullShort: "[ See docs ]",

    // Glossary
    glossaryItems: [
      { term: "IFB / RFP", def: "Invitation for Bids / Request for Proposals — the owner's solicitation document." },
      { term: "SBE Goal", def: "Small Business Enterprise participation target set by the owner." },
      { term: "Bid Bond", def: "Security deposit guaranteeing you will sign the contract if awarded." },
      { term: "Liquidated Damages", def: "Pre-set daily penalty for failing to complete work on time." },
      { term: "Substantial Completion", def: "Point where the owner can occupy/use the project for its intended purpose." },
    ],

    // Capability checklist
    capabilityItems: [
      { cat: "Licensing & Legal", item: "Valid contractor licence in jurisdiction", status: "Required" },
      { cat: "Licensing & Legal", item: "WSIB / insurance certificates on file", status: "Required" },
      { cat: "Licensing & Legal", item: "Bid bond capacity confirmed with surety", status: "Required" },
      { cat: "Licensing & Legal", item: "Performance/payment bond capacity", status: "Required" },
      { cat: "Technical", item: "Experience with specified work type", status: "Required" },
      { cat: "Technical", item: "Qualified site superintendent available", status: "Required" },
      { cat: "Technical", item: "Subcontractors identified for spec trades", status: "Strongly Recommended" },
      { cat: "Technical", item: "Safety program meets owner requirements", status: "Required" },
      { cat: "Technical", item: "Quality control plan in place", status: "Strongly Recommended" },
      { cat: "Technical", item: "Equipment & tools for scope available", status: "Strongly Recommended" },
      { cat: "Commercial", item: "Can meet SBE participation goal", status: "Strongly Recommended" },
      { cat: "Commercial", item: "Mobilization capacity within schedule", status: "Required" },
      { cat: "Commercial", item: "Cash flow for payment terms acceptable", status: "Required" },
      { cat: "Commercial", item: "References available (3 similar projects)", status: "Strongly Recommended" },
      { cat: "Commercial", item: "Submission forms ready / can be prepared", status: "Required" },
      { cat: "Commercial", item: "Addenda reviewed and acknowledged", status: "Required" },
      { cat: "Commercial", item: "Site visit completed or planned", status: "Strongly Recommended" },
      { cat: "Commercial", item: "Clarification questions submitted on time", status: "Strongly Recommended" },
    ],
  },

  es: {
    contractValue: "VALOR DEL CONTRATO",
    bidDeadlineLabel: "FECHA LÍMITE",
    paymentTermsLabel: "TÉRMINOS DE PAGO",
    contractTypeLabel: "TIPO DE CONTRATO",

    projectOverview: "Resumen del Proyecto",
    scopeOfWork: "Alcance de los Trabajos",
    bidderRequirements: "Requisitos del Licitante",
    submissionRequirements: "Requisitos de Presentación",
    glossary: "Glosario de Términos Clave",

    keyDates: "Fechas Clave",
    opportunityRisk: "Oportunidad y Riesgo",
    whatVestraHandles: "Lo Que Maneja Vestra",

    capabilityAssessment: "Autoevaluación de Capacidad",
    decisionGuide: "Guía de Decisión",
    workItemLabel: (n: number, name: string) => `Partida ${n}: ${name}`,
    workItemSpecsDefault: "Especificaciones de Trabajo",

    owner: "Propietario / Agencia",
    bidNumber: "Número de Licitación / RFP",
    naics: "Código NAICS",
    contractType: "Tipo de Contrato",
    sbeGoal: "Meta SBE",
    siteAddress: "Dirección del Sitio",

    licensing: "Licencias:",
    insurance: "Seguros:",
    insType: "Tipo",
    insMinimum: "Mínimo",

    bidDeadlineRow: "Fecha Límite de Oferta",
    preBidMeeting: "Reunión Previa a la Oferta",
    questionsDue: "Fecha Límite de Preguntas",
    addendumDate: "Fecha del Addendum",
    constructionStart: "Inicio de Construcción",
    substantialCompletion: "Terminación Sustancial",
    finalCompletion: "Terminación Final",

    specCol: "Especificación",
    valueCol: "Valor",
    sourceCol: "Fuente",
    itemCol: "Elemento",
    statusCol: "Estado",

    scopeSummaryRow: "Resumen del Alcance",
    materialsRow: "Materiales",
    dimensionsRow: "Dimensiones / Cantidades",
    specialReqRow: "Requisitos Especiales",
    rfpDocs: "Docs. RFP",

    opportunityLabel: "OPORTUNIDAD",
    opportunityPoints: [
      "Proyecto de financiamiento público con alcance definido y estructura de pago",
      "Oportunidad de ampliar el historial de proyectos en la región",
    ],
    riskLabel: "RIESGO",
    riskPoints: [
      "Cláusula de daños y perjuicios pactados — confirmar viabilidad del calendario",
      "Los requisitos SBE pueden limitar las opciones de subcontratistas",
    ],

    handlesItems: [
      "Revisión de documentos y verificación de cumplimiento",
      "Aclaración del alcance y presentación de preguntas",
      "Coordinación de subcontratistas y proveedores",
      "Elaboración y revisión de formularios de oferta",
      "Preparación y entrega de la presentación",
      "Soporte post-adjudicación del contrato",
    ],

    ctaTitle: "Programe una Consulta Gratuita",
    ctaWebsite: "www.vestrastrategies.com",
    ctaTagline: "Licite mejor. Gane más.",
    ctaReadyTitle: "¿Listo para Licitar?",
    ctaVestraLine: "Vestra Strategies — Licite mejor. Gane más.",

    p2HeaderRight: "Especificaciones del Proyecto y Evaluación de Capacidad",

    tierBid: "LICITAR",
    tierBidDesc: "Correspondencia sólida — proceder con la oferta",
    tierReview: "REVISAR",
    tierReviewDesc: "Evaluar brechas de capacidad antes de comprometerse",
    tierPass: "PASAR",
    tierPassDesc: "Brecha de capacidad significativa identificada",

    footerBrand: "Vestra Strategies  |  www.vestrastrategies.com",
    page1: "Página 1",
    page2of2: "Página 2 de 2",

    nullFull: "[ Ver documentos fuente ]",
    nullShort: "[ Ver docs ]",

    glossaryItems: [
      { term: "IFB / RFP", def: "Solicitud de Ofertas / Solicitud de Propuestas — documento de licitación del propietario." },
      { term: "Meta SBE", def: "Meta de participación de pequeñas empresas establecida por el propietario." },
      { term: "Fianza de Licitación", def: "Depósito de seguridad que garantiza la firma del contrato si se adjudica." },
      { term: "Daños y Perjuicios Pactados", def: "Penalidad diaria preestablecida por no completar el trabajo a tiempo." },
      { term: "Terminación Sustancial", def: "Punto en que el propietario puede ocupar el proyecto para su propósito previsto." },
    ],

    capabilityItems: [
      { cat: "Licencias y Legal", item: "Licencia de contratista válida en la jurisdicción", status: "Requerido" },
      { cat: "Licencias y Legal", item: "Certificados WSIB / seguros disponibles", status: "Requerido" },
      { cat: "Licencias y Legal", item: "Capacidad de fianza de licitación confirmada", status: "Requerido" },
      { cat: "Licencias y Legal", item: "Capacidad de fianza de cumplimiento / pago", status: "Requerido" },
      { cat: "Técnico", item: "Experiencia con el tipo de trabajo especificado", status: "Requerido" },
      { cat: "Técnico", item: "Superintendente de obra calificado disponible", status: "Requerido" },
      { cat: "Técnico", item: "Subcontratistas identificados para especialidades", status: "Muy Recomendado" },
      { cat: "Técnico", item: "Programa de seguridad cumple con requisitos del propietario", status: "Requerido" },
      { cat: "Técnico", item: "Plan de control de calidad implementado", status: "Muy Recomendado" },
      { cat: "Técnico", item: "Equipo y herramientas para el alcance disponibles", status: "Muy Recomendado" },
      { cat: "Comercial", item: "Puede cumplir con la meta de participación SBE", status: "Muy Recomendado" },
      { cat: "Comercial", item: "Capacidad de movilización dentro del calendario", status: "Requerido" },
      { cat: "Comercial", item: "Flujo de efectivo para términos de pago aceptable", status: "Requerido" },
      { cat: "Comercial", item: "Referencias disponibles (3 proyectos similares)", status: "Muy Recomendado" },
      { cat: "Comercial", item: "Formularios de envío listos / se pueden preparar", status: "Requerido" },
      { cat: "Comercial", item: "Addenda revisados y reconocidos", status: "Requerido" },
      { cat: "Comercial", item: "Visita al sitio completada o planificada", status: "Muy Recomendado" },
      { cat: "Comercial", item: "Preguntas de aclaración enviadas a tiempo", status: "Muy Recomendado" },
    ],
  },
} as const;

export type LocaleStrings = typeof T.en;
