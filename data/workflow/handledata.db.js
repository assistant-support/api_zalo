// data/workflows/handledata.db.js
// -------------------------------------------------------------
import { revalidateTag } from 'next/cache';
import { cacheData } from '@/lib/cache-data';
import { connectMongo } from '@/lib/db_connect';

import WorkflowTemplate from '@/models/workflow-template.model.js';
import CustomerWorkflow from '@/models/customer-workflow.model.js';
import Customer from '@/models/customer.model'; 

// -----------------------------
// TAGS
// -----------------------------
export const WF_TAGS = {
    TEMPLATES: 'workflows:templates',
    TEMPLATE: (slug) => `workflows:template:${slug}`,
    CW_LIST: (customerId) => `workflows:cw:list:${customerId}`,
    CW_ONE: (id) => `workflows:cw:${id}`,
    CUSTOMER_ONE: (id) => `customer:${id}`,
    CUSTOMERS: 'customers',
};

export function revalidateWorkflowTemplates() {
    revalidateTag(WF_TAGS.TEMPLATES);
}
export function revalidateWorkflowTemplate(slug) {
    revalidateTag(WF_TAGS.TEMPLATES);
    revalidateTag(WF_TAGS.TEMPLATE(slug));
}
export function revalidateCustomerWorkflows(customerId) {
    revalidateTag(WF_TAGS.CW_LIST(customerId));
}
export function revalidateCustomer(customerId) {
    revalidateTag(WF_TAGS.CUSTOMER_ONE(customerId));
    revalidateTag(WF_TAGS.CUSTOMERS);
}

const FIXED_SLUG = 'fixed-6-steps';

// -----------------------------
// GETTERS (đã sửa keyParts rõ ràng)
// -----------------------------
export async function getWorkflowTemplatesCached() {
    await connectMongo();
    const getList = cacheData(
        async () => {
            const docs = await WorkflowTemplate.find().sort({ createdAt: -1 }).lean();
            return JSON.parse(JSON.stringify(docs));
        },
        ['wf:templates:list', WF_TAGS.TEMPLATES]
    );
    return getList();
}

export async function getWorkflowTemplateBySlugCached(slug) {
    await connectMongo();
    const getOne = cacheData(
        async () => {
            const doc = await WorkflowTemplate.findOne({ slug }).lean();
            return doc ? JSON.parse(JSON.stringify(doc)) : null;
        },
        [`wf:template:${slug}`, WF_TAGS.TEMPLATE(slug)]
    );
    return getOne();
}

export async function getFixedWorkflowTemplateCached() {
    return getWorkflowTemplateBySlugCached(FIXED_SLUG);
}

export async function getCustomerWorkflowsByCustomerCached(customerId) {
    await connectMongo();
    const getList = cacheData(
        async () => {
            const rows = await CustomerWorkflow
                .find({ customerId })
                .sort({ createdAt: -1 })
                .lean();
            return JSON.parse(JSON.stringify(rows));
        },
        [`wf:cw:list:${customerId}`, WF_TAGS.CW_LIST(customerId)]
    );
    return getList();
}

export async function getCustomerWorkflowOneCached(id) {
    await connectMongo();
    const getOne = cacheData(
        async () => {
            const row = await CustomerWorkflow.findById(id).lean();
            return row ? JSON.parse(JSON.stringify(row)) : null;
        },
        [`wf:cw:${id}`, WF_TAGS.CW_ONE(id)]
    );
    return getOne();
}
