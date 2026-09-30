import { FLOW_COLORS } from '../utils/color.js';

/**
 * Axis 2 of the company model: what a tool actually moves.
 *
 * Colour is never the only carrier of meaning - every flow also owns a distinct
 * node silhouette, so the model stays readable without colour vision.
 */
export const FLOWS = [
  {
    id: 'material',
    label: 'Material',
    shape: 'octahedron',
    color: FLOW_COLORS.material,
    description: 'Physical goods: raw materials, stock and shipments.',
  },
  {
    id: 'money',
    label: 'Money',
    shape: 'box',
    color: FLOW_COLORS.money,
    description: 'Cash: cost, invoices, ad spend, revenue.',
  },
  {
    id: 'information',
    label: 'Information',
    shape: 'icosahedron',
    color: FLOW_COLORS.information,
    description: 'Data: product sync, dashboards, customer feedback.',
  },
  {
    // The id stays 'people' so no tool or link has to change; the label says
    // what these tools actually are.
    id: 'people',
    label: 'Process',
    shape: 'tetrahedron',
    color: FLOW_COLORS.people,
    description: 'Decisions and time: phase-gates, projects, approvals, working hours.',
  },
];

export const FLOW_BY_ID = Object.fromEntries(FLOWS.map((flow) => [flow.id, flow]));

/**
 * Directed links between tools. `flow` says which currency travels the link, so
 * a link is lit whenever its flow is selected in the legend.
 * A link whose endpoint is a planned app is drawn as a dashed ghost - this is
 * derived from the app status, not declared here.
 */
export const EDGES = [
  { from: 'page-review', to: 'mbc360', flow: 'information', note: 'Customer feedback feeds the next product.' },
  { from: 'mbc360', to: 'product-app', flow: 'information', note: 'A newly developed product is raised as a change request, and gets its SKU once approved.' },
  { from: 'project-app', to: 'raw-material', flow: 'people', note: 'Every raw material request is raised against a project.' },
  { from: 'project-app', to: 'procurement', flow: 'people', note: 'Every purchase request is raised against a project.' },
  { from: 'product-app', to: 'raw-material', flow: 'information', note: 'Every raw material purchase is raised against the SKU it is for.' },
  { from: 'product-app', to: 'production', flow: 'information', note: 'Production records its output against a SKU from the product list.' },
  { from: 'product-app', to: 'marketplace-misa', flow: 'information', note: 'Internal SKUs are mapped to the matching product listings on each platform.' },
  { from: 'product-app', to: 'page-review', flow: 'information', note: 'Reviews are tied to an internal SKU through its mapping to each platform listing.' },
  { from: 'procurement', to: 'invoice-ai', flow: 'information', note: 'Sends purchase invoices to be read, and keeps the result.' },
  { from: 'raw-material', to: 'invoice-ai', flow: 'information', note: 'Sends raw material invoices to be read, and keeps the result.' },
  { from: 'raw-material', to: 'production', flow: 'material', note: 'Approved materials feed the production process.' },
  { from: 'production', to: 'supply-chain', flow: 'material', note: 'Finished goods are handed to distribution.' },
  { from: 'production', to: 'misa-warehouse', flow: 'material', note: 'Every finished batch is booked into stock against its SKU.' },
  { from: 'supply-chain', to: 'misa-warehouse', flow: 'material', note: 'Stock moving in and out of each market is recorded as goods receipts and issues.' },
  { from: 'marketplace-misa', to: 'sales-dashboard', flow: 'information', note: 'Platform orders are reported as revenue.' },
  { from: 'ads-tool', to: 'sales-dashboard', flow: 'information', note: 'Campaign spend is measured against sales.' },
  { from: 'procurement', to: 'finance', flow: 'money', note: 'Purchase invoices become payables.' },
  { from: 'raw-material', to: 'finance', flow: 'money', note: 'Raw material invoices become payables.' },
  { from: 'ads-tool', to: 'finance', flow: 'money', note: 'Advertising cost lands in the cost ledger.' },
  { from: 'sales-dashboard', to: 'finance', flow: 'money', note: 'Revenue rolls up into cash flow.' },
  { from: 'timesheet', to: 'finance', flow: 'money', note: 'Logged hours become labour cost.' },
  { from: 'marketplace-misa', to: 'page-review', flow: 'information', note: 'Listings are watched for new reviews.' },
];

/**
 * Which flows each tool takes part in: its own, plus every flow it sends or
 * receives. Filtering by "Money" should light the Sales Dashboard even though
 * the dashboard is an Information tool - it is where revenue comes from.
 */
export const FLOWS_BY_APP = (() => {
  const map = new Map();
  const add = (appId, flowId) => {
    if (!map.has(appId)) map.set(appId, new Set());
    map.get(appId).add(flowId);
  };
  for (const edge of EDGES) {
    add(edge.from, edge.flow);
    add(edge.to, edge.flow);
  }
  return map;
})();

/** True when the tool moves this flow itself or is an endpoint of one. */
export function appTouchesFlow(app, flowId) {
  return app.flow === flowId || (FLOWS_BY_APP.get(app.id)?.has(flowId) ?? false);
}
