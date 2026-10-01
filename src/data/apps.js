/**
 * THE REGISTRY.
 *
 * Adding a tool to MBC Hub means adding one object here - nothing else in the
 * project needs to change. The map puts the station where its `stage` row meets
 * its `flow` lane, and takes its treatment from `status`.
 *
 *   id          stable key, also used by the link list in src/data/flows.js
 *   stage       a step of the cycle from src/data/stages.js, or one of the two
 *               bands under it: 'shared' for a tool another tool calls to do
 *               one job, 'company' for a system run for the whole company
 *   flow        one of src/data/flows.js - what this tool actually moves,
 *               judged by what comes out the other end, not by how it gets
 *               there. Nearly every tool has an approval step or change
 *               control inside it; that alone does not make it 'people'.
 *               Purchasing ends in goods received, so it is 'material'.
 *               Production ends in finished goods, so it is 'material' too.
 *               A tool is 'people' (shown as Process) when the approved
 *               decision or the time worked IS the output.
 *   status      'live'    - filled station, opens in a new tab
 *               'planned' - hollow station, dashed links, no link to open
 *   origin      'external' for another company's product the work runs through.
 *               Omit it for the tools we write ourselves, which are most of
 *               them. It is not a judgement, and it does not mean the tool sits
 *               outside the cycle - every one of them is a step of it. It
 *               answers one question: can we change this ourselves?
 *   keywords    extra search terms that are not already in name/summary
 */
export const APPS = [
  {
    id: 'mbc360',
    name: 'MBc360',
    tagline: 'Development & quality phase-gates',
    summary:
      'Will run a new product through the product development and quality phase-gates, from first idea to approved formula, with every gate decision recorded in one place. A product that clears the gates is raised as a change request in the Product App, which issues its SKU once approved.',
    url: null,
    stage: 'develop',
    flow: 'people',
    status: 'planned',
    keywords: ['npd', 'formula', 'product development', 'stage gate', 'phase gate', 'quality', 'qa'],
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
    id: 'product-app',
    name: 'Product App',
    tagline: 'SKU list under change control',
    summary:
      'Will hold the list of SKUs the company has, with every change to a SKU going through change control. Raw material purchasing references the SKU it buys for, production references the SKU it makes, and the sales tools map each platform listing back to a SKU.',
    url: null,
    stage: 'develop',
    flow: 'information',
    status: 'planned',
    keywords: ['sku', 'product', 'master data', 'catalogue', 'change control', 'item list'],
  },
  {
    id: 'cosmetri',
    name: 'Cosmetri',
    tagline: 'Raw material and formulation records',
    summary:
      'Holds the raw material and formulation records the development side works from. Nothing starts here: a raw material is created, changed or withdrawn under change control in the Raw Material Procurement App, and only then entered here, so the two can never disagree about what a material is. MBc360 reads what it holds while running a product through the phase-gates.',
    url: 'https://www.app1-env.cosmetri.com',
    stage: 'develop',
    flow: 'information',
    status: 'live',
    origin: 'external',
    keywords: [
      'cosmetri',
      'formulation',
      'formula',
      'inci',
      'regulatory',
      'compliance',
      'raw material',
      'change control',
    ],
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
    tagline: 'Suppliers and purchasing outside RM and packaging',
    summary:
      'Keeps its own supplier records, and turns an approved need into a purchase request, a purchase order, a delivery and a receipt round. Its suppliers are everyone the company buys from except the raw material and packaging suppliers, which belong to the two apps running the same flow in parallel.',
    url: 'https://proc.mbcstaging.com',
    stage: 'source',
    flow: 'material',
    status: 'live',
    keywords: [
      'purchase order',
      'po',
      'delivery',
      'receiving',
      'warehouse',
      'supplier',
      'vendor',
      'master data',
    ],
  },
  {
    id: 'packaging',
    name: 'Packaging Procurement App',
    tagline: 'Packaging materials, their suppliers, and packaging purchasing',
    summary:
      'Will maintain the packaging material records and the suppliers behind them, and run packaging purchasing end to end under change control. Packaging is part of what the product is made of, so it runs the same way raw materials do: bought against the SKU it is for, then handed to production.',
    url: null,
    stage: 'source',
    flow: 'material',
    status: 'planned',
    keywords: [
      'packaging',
      'pk',
      'carton',
      'box',
      'label',
      'bottle',
      'cap',
      'supplier',
      'specification',
      'change control',
      'master data',
      'sourcing',
    ],
  },
  {
    id: 'invoice-ai',
    name: 'Invoice AI',
    tagline: 'Shared invoice extraction service',
    summary:
      'Reads an invoice with OCR and returns the extracted lines over its API. It holds nothing: the invoice and whatever is done with it stay in the tool that called it. No line on the map reaches it: a tool calling it is asking a question, not handing work on, and drawing those calls would put them on a par with the goods and the money that do move through the company.',
    url: 'https://ocr.mbcstaging.com',
    stage: 'shared',
    flow: 'information',
    status: 'live',
    keywords: ['ocr', 'invoice', 'credit note', 'accounting', 'extraction', 'api', 'service'],
  },
  {
    id: 'invoice-template',
    name: 'Invoice Template App',
    tagline: 'Invoice layouts kept in one place',
    summary:
      'Holds the invoice templates: the layout, and which fields each one prints. Whoever raises an invoice takes the template from here, so an invoice looks the same whichever tool it was raised in. Like the rest of the shared tools it is picked up when it is needed rather than being a step of the cycle, and no line on the map reaches it.',
    url: 'https://invoice-template.mbcstaging.com',
    stage: 'shared',
    flow: 'information',
    status: 'live',
    keywords: [
      'invoice',
      'template',
      'layout',
      'format',
      'pdf',
      'print',
      'branding',
      'document',
    ],
  },
  {
    id: 'production',
    name: 'Production App',
    tagline: 'Manufacturing process under change control',
    summary:
      'Will define and version the manufacturing process for each product, with every change to a process going through change control. Takes over where raw material procurement stops.',
    url: null,
    stage: 'produce',
    flow: 'material',
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
      'Will plan and track finished product moving between the company market regions.',
    url: null,
    stage: 'distribute',
    flow: 'material',
    status: 'planned',
    keywords: ['logistics', 'shipment', 'region', 'transfer', 'stock'],
  },
  {
    id: 'misa-warehouse',
    name: 'MISA Warehouse',
    tagline: 'Stock balance by SKU, every market',
    summary:
      'The MISA AMIS warehouse module, holding the stock balance of every SKU across all markets. What production makes is booked into it, and every stock movement in and out of a market through Supply Chain is recorded against it.',
    url: 'https://amisapp.misa.vn/warehouse',
    stage: 'distribute',
    flow: 'material',
    status: 'live',
    origin: 'external',
    keywords: ['misa', 'amis', 'warehouse', 'inventory', 'stock balance', 'stock', 'goods receipt', 'goods issue'],
  },
  {
    id: 'marketplace-misa',
    name: 'Marketplace x Misa CRM',
    tagline: 'Sales platform to MISA CRM sync',
    summary:
      'Fetches product and order data straight from the e-commerce platform APIs and synchronises it into MISA CRM so both sides agree. Each platform listing is mapped to an internal SKU from the Product App.',
    url: 'https://marketplace.mbcstaging.com',
    stage: 'sell',
    flow: 'information',
    status: 'live',
    keywords: ['misa', 'crm', 'shopee', 'lazada', 'sync', 'listing', 'e-commerce', 'api', 'sku mapping'],
  },
  {
    id: 'misa-crm',
    name: 'MISA CRM',
    tagline: 'Every order, from every channel',
    summary:
      'The MISA AMIS CRM module, holding every order the company takes: the e-commerce orders pushed across from Marketplace x Misa CRM, and the B2B orders alongside them. An order landing here is what raises the goods issue in MISA Warehouse that draws the stock balance down.',
    url: 'https://amisapp.misa.vn/crm',
    stage: 'sell',
    flow: 'information',
    status: 'live',
    origin: 'external',
    keywords: [
      'misa',
      'amis',
      'crm',
      'order',
      'sales order',
      'b2b',
      'wholesale',
      'customer',
      'e-commerce',
    ],
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
      'Reports revenue across channels and periods, counted from the orders MISA CRM holds, and is the number the rest of the company quotes.',
    url: 'https://dashboard-sale.mbcstaging.com',
    stage: 'sell',
    flow: 'information',
    status: 'live',
    keywords: ['revenue', 'target', 'report', 'kpi', 'sales'],
  },
  {
    id: 'page-review',
    name: 'Page Review',
    tagline: 'Where a customer rates the product',
    summary:
      'The page a customer lands on to rate a product and say what they thought of it. Nothing is counted here: every rating left on it is passed to Review Hub, which is where the reading is done.',
    url: 'https://reviewpage.mbcstaging.com',
    stage: 'listen',
    flow: 'information',
    status: 'live',
    keywords: [
      'rating',
      'review page',
      'feedback',
      'customer',
      'comment',
      'survey',
      'star',
    ],
  },
  {
    id: 'review-hub',
    name: 'Review Hub',
    tagline: 'What customers said, counted',
    summary:
      'Counts what customers said and reports it, pulled from wherever the saying happens: the sales platform APIs, the review platforms the company is listed on - Klaviyo, productreview.com.au - and the ratings left on Page Review. A dashboard rather than a queue: it reads and counts, it does not answer anyone.',
    url: 'https://reviews.mbcstaging.com',
    stage: 'listen',
    flow: 'information',
    status: 'live',
    keywords: [
      'dashboard',
      'statistics',
      'rating',
      'feedback',
      'customer',
      'comment',
      'reputation',
      'crawl',
      'api',
      'marketplace',
      'platform',
      'klaviyo',
      'productreview',
    ],
  },
  {
    id: 'timesheet',
    name: 'Timesheet',
    tagline: 'Attendance and working hours',
    summary:
      'Records attendance and working hours for every employee, across every stage of the cycle.',
    url: 'https://timesheet.mbcstaging.com',
    stage: 'company',
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
    stage: 'company',
    flow: 'money',
    status: 'planned',
    keywords: ['cash flow', 'ledger', 'cost', 'budget', 'p&l', 'accounting'],
  },
];

/**
 * The badges printed on a tool's label, in order.
 *
 * A badge says something about the tool itself - whether it exists yet, and
 * whether we wrote it - never about what it does. What it does is the tagline.
 */
export function badgesFor(app) {
  const badges = [];
  if (app.status === 'planned') badges.push('planned');
  if (app.origin === 'external') badges.push('external');
  return badges;
}

export const APP_BY_ID = Object.fromEntries(APPS.map((app) => [app.id, app]));

export const LIVE_APPS = APPS.filter((app) => app.status === 'live');
