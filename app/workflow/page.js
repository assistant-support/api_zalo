// // app/workflow/page.js
// // Lấy template cố định & user, truyền xuống client

// import { getSessionUserLite } from '../actions/session.action.js';
// import { getFixedWorkflowTemplateCached } from '../../data/workflow/handledata.db.js';
// import FixedWorkflowClient from './ui/fixed-workflow.client.js';

// export const dynamic = 'force-dynamic';

// export default async function Page() {
//     const [me, template] = await Promise.all([
//         getSessionUserLite().catch(() => null),
//         getFixedWorkflowTemplateCached(),
//     ]);

//     return (
//         <div className="p-4 sm:p-6">
//             <FixedWorkflowClient me={me} template={template} />
//         </div>
//     );
// }
