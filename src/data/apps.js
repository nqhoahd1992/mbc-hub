/**
 * THE REGISTRY.
 *
 * Adding a tool to MBC Hub means adding one object here - nothing else in the
 * project needs to change. The map puts the station where its `stage` row meets
 * its `flow` lane, and takes its treatment from `status`.
 *
 *   id          stable key, also used by the link list in src/data/flows.js
 *   stage       one of src/data/stages.js, or 'backbone' for a shared service
 *               that every step can call rather than one step owning it
 *   flow        one of src/data/flows.js - what this tool actually moves
 *   status      'live'    - filled station, opens in a new tab
 *               'planned' - hollow station, dashed links, no link to open
 *   keywords    extra search terms that are not already in name/summary
 */
export const APPS = [
  {
    id: 'mbc360',
    name: 'MBc360',
    tagline: 'Product development process',
    summary:
      'Runs a new product from first idea to approved formula, with every review step recorded in one place.',
    url: 'https://mbc360.mbcstaging.com',
    stage: 'develop',
    flow: 'people',
    status: 'live',
    keywords: ['npd', 'formula', 'product development', 'stage gate'],
  },
  {
    id: 'project-app',
    name: 'Project App',
    tagline: 'Company project workflow',
    summary:
      'Creates company projects and change requests, routes them for approval, and keeps the approved scope visible.',
    url: 'https://project.mbcstaging.com',
    stage: 'develop',
    flow: 'people',
    status: 'live',
    keywords: ['change request', 'approval', 'sponsor', 'project manager'],
  },
  {
    id: 'raw-material',
    name: 'Raw Material Procurement App',
    tagline: 'Raw materials, their suppliers, and RM purchasing',
    summary:
      'Maintains the raw material records and the suppliers behind them, and runs raw material purchasing end to end under change control.',
    url: 'https://rm.mbcstaging.com',
    stage: 'source',
    flow: 'material',
    status: 'live',
    keywords: [
      'rm',
      'raw material',
      'ingredient',
      'supplier',
      'specification',
      'change control',
      'master data',
      'sourcing',
    ],
  },
  {
    id: 'procurement',
    name: 'Procurement App',
    tagline: 'Purchasing for everything other than raw materials',
    summary:
      'Turns an approved need into a purchase request, a purchase order, a delivery and a receipt round. Raw materials run their own parallel flow.',
    url: 'https://proc.mbcstaging.com',
    stage: 'source',
    flow: 'material',
    status: 'live',
    keywords: ['purchase order', 'po', 'delivery', 'receiving', 'warehouse'],
  },
  {
    id: 'invoice-ai',
    name: 'Invoice AI',
    tagline: 'Shared invoice extraction service',
    summary:
      'Reads an invoice with OCR and returns the extracted lines over its API. It holds nothing: the invoice and whatever is done with it stay in the tool that called it. A shared engine rather than a step in the cycle, so it sits on the backbone.',
    url: 'https://ocr.mbcstaging.com',
    stage: 'backbone',
    flow: 'information',
    status: 'live',
    keywords: ['ocr', 'invoice', 'credit note', 'accounting', 'extraction', 'api', 'service'],
  },
  {
    id: 'production',
    name: 'Production App',
    tagline: 'Manufacturing process under change control',
    summary:
      'Will define and version the manufacturing process for each product, with every change to a process going through change control. Takes over where raw material procurement stops.',
    url: null,
    stage: 'produce',
    flow: 'people',
    status: 'planned',
    keywords: [
      'manufacturing',
      'production',
      'process',
      'batch',
      'change control',
      'work order',
      'qc',
    ],
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain',
    tagline: 'Inter-region distribution',
    summary:
      'Will plan and track finished product moving between the company market regions. Manufacturing happens in Australia only, so raw materials never travel - distribution starts after production.',
    url: null,
    stage: 'distribute',
    flow: 'material',
    status: 'planned',
    keywords: ['logistics', 'shipment', 'region', 'transfer', 'stock'],
  },
  {
    id: 'marketplace-misa',
    name: 'Marketplace x Misa',
    tagline: 'Sales platform to MISA CRM sync',
    summary:
      'Synchronises product and order data from the sales platforms into MISA CRM so both sides agree.',
    url: 'https://marketplace.mbcstaging.com',
    stage: 'sell',
    flow: 'information',
    status: 'live',
    keywords: ['misa', 'crm', 'shopee', 'lazada', 'sync', 'listing'],
  },
  {
    id: 'ads-tool',
    name: 'Ads Tool',
    tagline: 'In-house advertising console',
    summary:
      'Manages advertising campaigns across the sales platforms and keeps spend next to the result it bought.',
    url: 'https://ads.mbcstaging.com',
    stage: 'sell',
    flow: 'money',
    status: 'live',
    keywords: ['advertising', 'campaign', 'spend', 'marketing', 'roas'],
  },
  {
    id: 'sales-dashboard',
    name: 'Sales Dashboard',
    tagline: 'Sales performance',
    summary:
      'Reports revenue across channels and periods, and is the number the rest of the company quotes.',
    url: 'https://dashboard-sale.mbcstaging.com',
    stage: 'sell',
    flow: 'information',
    status: 'live',
    keywords: ['revenue', 'target', 'report', 'kpi', 'sales'],
  },
  {
    id: 'page-review',
    name: 'Page Review',
    tagline: 'Marketplace review monitoring',
    summary:
      'Collects every customer review across the sales platforms into one queue so nothing goes unanswered.',
    url: 'https://reviewpage.mbcstaging.com',
    stage: 'listen',
    flow: 'information',
    status: 'live',
    keywords: ['rating', 'feedback', 'customer', 'comment', 'reputation'],
  },
  {
    id: 'timesheet',
    name: 'Timesheet',
    tagline: 'Attendance and working hours',
    summary:
      'Records attendance and working hours for every employee, across every stage of the cycle.',
    url: 'https://timesheet.mbcstaging.com',
    stage: 'backbone',
    flow: 'people',
    status: 'live',
    keywords: ['attendance', 'hours', 'payroll', 'hr', 'clock in'],
  },
  {
    id: 'finance',
    name: 'Finance',
    tagline: 'Revenue, cost and cash flow',
    summary:
      'Will bring revenue, cost and cash flow together, fed by every other tool that touches money.',
    url: null,
    stage: 'backbone',
    flow: 'money',
    status: 'planned',
    keywords: ['cash flow', 'ledger', 'cost', 'budget', 'p&l', 'accounting'],
  },
];

export const APP_BY_ID = Object.fromEntries(APPS.map((app) => [app.id, app]));

export const LIVE_APPS = APPS.filter((app) => app.status === 'live');
